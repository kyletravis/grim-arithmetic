import { AttackSnapshot, CombatantSnapshot, SystemAdapter } from './base-adapter';

type UnknownRecord = Record<string, unknown>;

type TokenLike = {
  id?: string;
  name?: string;
  document?: {
    disposition?: number;
  };
  actor?: ActorLike;
};

type ActorLike = {
  id?: string;
  name?: string;
  type?: string;
  system?: UnknownRecord;
  itemTypes?: {
    condition?: ConditionLike[];
  };
  items?: unknown;
};

type ConditionLike = {
  slug?: string;
  value?: number;
  system?: unknown;
};

type ItemLike = {
  id?: string;
  name?: string;
  type?: string;
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
      traits: toStringArray(traits.value),
      assumptions: []
    };
  }

  getAttacksFromToken(token: TokenLike): AttackSnapshot[] {
    const actor = token.actor;
    const items = getActorItems(actor);

    return items
      .filter((item) => item.type === 'melee')
      .map((item): AttackSnapshot | null => {
        const system = asRecord(item.system);
        const attackBonus = getAttackBonus(system);
        const damageFormula = getPrimaryDamageFormula(system);
        if (!isNumber(attackBonus) || typeof damageFormula !== 'string') return null;

        const traits = toStringArray(asRecord(system.traits).value);

        return {
          id: item.id ?? '',
          name: item.name ?? 'Unknown Strike',
          attackBonus,
          damageFormula,
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
  return optionalNumber(condition.value) ?? optionalNumber(asRecord(asRecord(condition.system).value).value) ?? 0;
}

function getActorItems(actor: ActorLike | undefined): ItemLike[] {
  const items = actor?.items;
  if (Array.isArray(items)) return items.filter(isItemLike);

  const contents = asRecord(items).contents;
  if (Array.isArray(contents)) return contents.filter(isItemLike);

  if (isRecord(items) && typeof items.filter === 'function') {
    const filtered = (items.filter as (predicate: (item: ItemLike) => boolean) => unknown)(isItemLike);
    return Array.isArray(filtered) ? filtered : [];
  }

  return [];
}

function isItemLike(value: unknown): value is ItemLike {
  return isRecord(value);
}

function getAttackBonus(system: UnknownRecord): number | undefined {
  return optionalNumberLike(asRecord(system.bonus).value) ?? optionalNumberLike(asRecord(system.attack).value);
}

function getPrimaryDamageFormula(system: UnknownRecord): string | undefined {
  const damageRolls = asRecord(system.damageRolls);
  const firstRoll = Object.values(damageRolls).find(isRecord);
  if (!firstRoll) return undefined;

  const damage = firstRoll.damage;
  const formula = firstRoll.formula;
  if (typeof damage === 'string') return damage;
  if (typeof formula === 'string') return formula;
  return undefined;
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalNumber(value: unknown): number | undefined {
  return isNumber(value) ? value : undefined;
}

function optionalNumberLike(value: unknown): number | undefined {
  if (isNumber(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.trim().replace(/^\+/, ''));
  return isNumber(parsed) ? parsed : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const slug = asRecord(entry).slug;
      return typeof slug === 'string' ? slug : null;
    })
    .filter((entry): entry is string => typeof entry === 'string');
}
