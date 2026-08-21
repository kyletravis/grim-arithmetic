import {
  AttackSnapshot,
  CombatantSnapshot,
  DamageAdjustmentValue,
  SystemAdapter
} from './base-adapter';
import { extractPcCapabilities } from './pf2e-pc-capabilities';
import { getAttacksFromPcActor } from './pf2e-pc-strikes';
import {
  asRecord,
  isNumber,
  isRecord,
  optionalNumber,
  optionalNumberLike,
  toItemLikes,
  toStringArray,
  type UnknownRecord
} from './record-utils';

export type Pf2eTokenLike = {
  id?: string;
  name?: string;
  document?: {
    disposition?: number;
  };
  actor?: Pf2eActorLike;
};

type TokenLike = Pf2eTokenLike;

export type Pf2eActorLike = {
  id?: string;
  name?: string;
  type?: string;
  system?: UnknownRecord;
  itemTypes?: {
    condition?: ConditionLike[];
    spell?: unknown;
    spellcastingEntry?: unknown;
    feat?: unknown;
  };
  items?: unknown;
};

type ActorLike = Pf2eActorLike;

type ConditionLike = {
  slug?: string;
  value?: number;
  system?: unknown;
};

const FOUNDRY_HOSTILE_DISPOSITION = -1;

export class Pf2eAdapter implements SystemAdapter<TokenLike> {
  id = 'pf2e';
  label = 'Pathfinder Second Edition';

  getCombatantFromToken(token: TokenLike): CombatantSnapshot | null {
    const actor = token.actor;
    if (!actor) return null;

    const system = asRecord(actor.system);
    const attributes = asRecord(system.attributes);
    const hp = asRecord(attributes.hp);
    const ac = asRecord(attributes.ac);
    const hpValue = hp.value;
    const hpMax = hp.max;
    const acValue = ac.value;

    if (!isNumber(hpValue) || !isNumber(hpMax) || !isNumber(acValue)) return null;

    const saves = asRecord(system.saves);
    const resources = asRecord(system.resources);
    const heroPoints = asRecord(resources.heroPoints);
    const traits = asRecord(system.traits);
    const perception = asRecord(system.perception);
    const legacyPerception = asRecord(attributes.perception);
    const initiativeBonus =
      optionalNumber(perception.mod) ??
      optionalNumber(perception.totalModifier) ??
      optionalNumber(perception.value) ??
      optionalNumber(legacyPerception.value);

    return {
      id: token.id ?? actor.id ?? '',
      name: token.name ?? actor.name ?? 'Unknown Combatant',
      disposition: getDisposition(token, actor),
      hp: {
        current: hpValue,
        max: hpMax,
        temp: optionalNumber(hp.temp)
      },
      defenses: {
        ac: acValue,
        fort: optionalNumber(asRecord(saves.fortitude).value),
        reflex: optionalNumber(asRecord(saves.reflex).value),
        will: optionalNumber(asRecord(saves.will).value)
      },
      deathState: {
        dying: getConditionValue(actor, 'dying'),
        wounded: getConditionValue(actor, 'wounded'),
        doomed: getConditionValue(actor, 'doomed'),
        heroPoints: optionalNumber(heroPoints.value)
      },
      damageAdjustments: {
        resistances: getAdjustmentValues(attributes.resistances ?? system.resistances),
        weaknesses: getAdjustmentValues(attributes.weaknesses ?? system.weaknesses),
        immunities: getImmunities(attributes.immunities ?? system.immunities)
      },
      initiativeBonus,
      pcCapabilities: actor.type === 'character' ? extractPcCapabilities(actor) : undefined,
      traits: toStringArray(traits.value),
      assumptions: []
    };
  }

  getAttacksFromToken(token: TokenLike): AttackSnapshot[] {
    const actor = token.actor;
    if (!actor) return [];

    if (actor.type === 'character') {
      return getAttacksFromPcActor(actor);
    }

    const items = toItemLikes(actor.items);

    return items
      .filter((item) => item.type === 'melee')
      .map((item): AttackSnapshot | null => {
        const system = asRecord(item.system);
        const attackBonus = getAttackBonus(system);
        const damageRoll = getPrimaryDamageRoll(system);
        const damageFormula = getDamageFormula(damageRoll);
        if (!isNumber(attackBonus) || typeof damageFormula !== 'string') return null;

        const traits = toStringArray(asRecord(system.traits).value);

        return {
          id: item.id ?? '',
          name: item.name ?? 'Unknown Strike',
          attackBonus,
          damageFormula,
          damageType: getDamageType(damageRoll),
          traits,
          mapType: traits.includes('agile') ? 'agile' : 'normal',
          assumptions: ['PF2e Strike extraction is first-pass and may miss conditional modifiers.']
        };
      })
      .filter((attack): attack is AttackSnapshot => attack !== null);
  }
}

function getDisposition(token: TokenLike, actor: ActorLike): CombatantSnapshot['disposition'] {
  if (actor.type === 'character') return 'pc';
  if (token.document?.disposition === FOUNDRY_HOSTILE_DISPOSITION) return 'enemy';
  return 'neutral';
}

function getConditionValue(actor: ActorLike, slug: string): number {
  const condition = actor.itemTypes?.condition?.find((entry) => entry.slug === slug);
  if (!condition) return 0;
  return (
    optionalNumber(condition.value) ??
    optionalNumber(asRecord(asRecord(condition.system).value).value) ??
    0
  );
}

function getAttackBonus(system: UnknownRecord): number | undefined {
  return (
    optionalNumberLike(asRecord(system.bonus).value) ??
    optionalNumberLike(asRecord(system.attack).value)
  );
}

function getPrimaryDamageRoll(system: UnknownRecord): UnknownRecord | undefined {
  const damageRolls = asRecord(system.damageRolls);
  return Object.values(damageRolls).find(isRecord);
}

function getDamageFormula(firstRoll: UnknownRecord | undefined): string | undefined {
  if (!firstRoll) return undefined;

  const damage = firstRoll.damage;
  const formula = firstRoll.formula;
  if (typeof damage === 'string') return damage;
  if (typeof formula === 'string') return formula;
  return undefined;
}

function getDamageType(firstRoll: UnknownRecord | undefined): string | undefined {
  if (!firstRoll) return undefined;
  const damageType = firstRoll.damageType ?? firstRoll.type ?? firstRoll.category;
  return typeof damageType === 'string' ? damageType : undefined;
}

function getAdjustmentValues(value: unknown): DamageAdjustmentValue[] {
  const entries = Array.isArray(value) ? value : Object.values(asRecord(value));

  return entries
    .filter(isRecord)
    .map((entry) => {
      const type = entry.type ?? entry.slug ?? entry.label;
      const amount = optionalNumberLike(entry.value) ?? optionalNumberLike(entry.amount);
      if (typeof type !== 'string' || amount === undefined) return null;
      return { type, value: amount };
    })
    .filter((entry): entry is DamageAdjustmentValue => entry !== null);
}

function getImmunities(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : Object.values(asRecord(value));

  return entries
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const record = asRecord(entry);
      const type = record.type ?? record.slug ?? record.label;
      return typeof type === 'string' ? type : null;
    })
    .filter((entry): entry is string => typeof entry === 'string');
}
