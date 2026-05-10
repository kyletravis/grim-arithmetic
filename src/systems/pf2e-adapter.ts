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
    void token;
    return [];
  }
}

function getDisposition(token: TokenLike, actor: ActorLike): CombatantSnapshot['disposition'] {
  if (actor.type === 'character') return 'pc';
  if (token.document?.disposition === FOUNDRY_HOSTILE_DISPOSITION) return 'enemy';
  return 'neutral';
}

function getConditionValue(actor: ActorLike, slug: string): number {
  return actor.itemTypes?.condition?.find((condition) => condition.slug === slug)?.value ?? 0;
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}
