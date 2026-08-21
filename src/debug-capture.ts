import { isDebugLoggingEnabled } from './settings';
import { asRecord, getActorItems, isRecord, type UnknownRecord } from './systems/record-utils';

export type DebugTokenLike = {
  id?: string;
  name?: string;
  document?: {
    disposition?: number;
  };
  actor?: {
    id?: string;
    name?: string;
    type?: string;
    system?: unknown;
    itemTypes?: unknown;
    items?: unknown;
  };
};

export function buildDebugCapture(token: DebugTokenLike): unknown {
  const actor = token.actor;
  const system = asRecord(actor?.system);

  return {
    token: {
      id: token.id,
      name: token.name,
      disposition: token.document?.disposition
    },
    actor: actor
      ? {
          id: actor.id,
          name: actor.name,
          type: actor.type,
          system: buildActorSystemCapture(system),
          pc: actor.type === 'character' ? buildPcCapture(system, actor) : undefined,
          itemTypes: pickItemTypes(actor.itemTypes),
          meleeItems: getActorItems(actor.items)
            .filter((item) => item.type === 'melee')
            .map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              system: {
                bonus: asRecord(item.system).bonus,
                attack: asRecord(item.system).attack,
                damageRolls: asRecord(item.system).damageRolls,
                traits: asRecord(item.system).traits
              }
            }))
        }
      : null
  };
}

export function logDebugCapture(token?: DebugTokenLike): unknown | null {
  if (!token) return null;

  const isGM = typeof game !== 'undefined' && game.user?.isGM === true;
  if (!isGM) return null;

  if (!isDebugLoggingEnabled()) return null;

  const capture = buildDebugCapture(token);
  console.log('Grim Arithmetic | Debug capture', capture);
  return capture;
}

export interface LiveFixture {
  token: UnknownRecord;
  expect?: { disposition?: string; minAttacks?: number; attackBonusAtLeast?: number };
}

/**
 * Build a JSON-safe fixture from a live token, pruned to exactly what the
 * PF2e adapter reads. Used by `exportLiveFixture()` so GMs can capture a
 * real actor's data and drop it into tests/fixtures/live/ for regression
 * coverage. Only character stats are kept — no biography/notes fields.
 */
export function buildLiveFixture(token: DebugTokenLike): LiveFixture {
  const actor = token.actor;
  const system = asRecord(actor?.system);
  const attributes = asRecord(system.attributes);
  const actions = Array.isArray(system.actions) ? system.actions.filter(isRecord) : [];
  const itemTypes = asRecord(actor?.itemTypes);
  const keepItemTypes = new Set([
    'melee',
    'weapon',
    'spell',
    'spellcastingEntry',
    'feat',
    'condition'
  ]);
  const items = getActorItems(actor?.items)
    .filter((i) => typeof i.type === 'string' && keepItemTypes.has(i.type))
    .map((i) => ({
      id: i.id ?? (i as { _id?: string })._id,
      name: i.name,
      type: i.type,
      system: pruneItemSystem(asRecord(i.system))
    }));
  return {
    token: {
      id: token.id,
      name: token.name,
      document: { disposition: token.document?.disposition },
      actor: actor
        ? {
            id: actor.id,
            name: actor.name,
            type: actor.type,
            system: withoutUndefined({
              attributes: withoutUndefined({
                hp: attributes.hp,
                ac: attributes.ac,
                perception: attributes.perception,
                resistances: attributes.resistances,
                weaknesses: attributes.weaknesses,
                immunities: attributes.immunities
              }),
              perception: system.perception,
              abilities: system.abilities,
              skills: { medicine: asRecord(system.skills).medicine },
              saves: system.saves,
              traits: system.traits,
              resources: { heroPoints: asRecord(system.resources).heroPoints },
              details: { level: asRecord(system.details).level },
              resistances: system.resistances,
              weaknesses: system.weaknesses,
              immunities: system.immunities,
              actions: actions.map((a) =>
                withoutUndefined({
                  slug: a.slug,
                  label: a.label,
                  totalModifier: a.totalModifier,
                  damageFormula: a.damageFormula,
                  traits: a.traits,
                  item: (() => {
                    const it = asRecord(a.item);
                    return {
                      id: it.id,
                      name: it.name,
                      system: pruneItemSystem(asRecord(it.system))
                    };
                  })()
                })
              )
            }),
            itemTypes: {
              condition: (Array.isArray(itemTypes.condition) ? itemTypes.condition : [])
                .filter(isRecord)
                .map((c) => ({ slug: c.slug, value: c.value, system: c.system }))
            },
            items
          }
        : null
    }
  };
}

function pruneItemSystem(system: UnknownRecord): UnknownRecord {
  return withoutUndefined({
    slug: system.slug,
    bonus: system.bonus,
    attack: system.attack,
    damageRolls: system.damageRolls,
    damage: system.damage,
    runes: system.runes,
    traits: system.traits,
    equipped: system.equipped,
    range: system.range,
    weaponType: system.weaponType,
    level: system.level,
    location: system.location,
    prepared: system.prepared,
    slots: system.slots,
    slotsRemaining: system.slotsRemaining,
    isCantrip: system.isCantrip
  });
}

function buildPcCapture(
  system: UnknownRecord,
  actor: NonNullable<DebugTokenLike['actor']>
): UnknownRecord {
  const actions = Array.isArray(system.actions) ? system.actions : [];
  return withoutUndefined({
    perception: system.perception,
    abilities: system.abilities,
    medicine: asRecord(system.skills).medicine,
    level: asRecord(system.details).level,
    heroPoints: asRecord(asRecord(system.resources).heroPoints).value,
    actions: actions.filter(isRecord).map((action) => {
      const item = asRecord(action.item);
      const itemSystem = asRecord(item.system);
      return withoutUndefined({
        slug: action.slug,
        label: action.label,
        totalModifier: action.totalModifier,
        damageType: typeof action.damage,
        damageFormula: action.damageFormula,
        traits: action.traits,
        item: {
          id: item.id,
          name: item.name,
          system: withoutUndefined({
            damage: itemSystem.damage,
            runes: itemSystem.runes,
            traits: itemSystem.traits,
            equipped: itemSystem.equipped,
            range: itemSystem.range,
            bonus: itemSystem.bonus
          })
        }
      });
    }),
    weapons: getActorItems(actor.items)
      .filter((item) => item.type === 'weapon')
      .map((item) => ({ id: item.id, name: item.name, system: asRecord(item.system) }))
  });
}

function buildActorSystemCapture(system: UnknownRecord): UnknownRecord {
  const legacyDamageAdjustments = withoutUndefined({
    immunities: system.immunities,
    weaknesses: system.weaknesses,
    resistances: system.resistances
  });

  return withoutUndefined({
    attributes: pickAttributes(system),
    saves: system.saves,
    traits: system.traits,
    legacyDamageAdjustments:
      Object.keys(legacyDamageAdjustments).length > 0 ? legacyDamageAdjustments : undefined
  });
}

function pickAttributes(system: UnknownRecord): unknown {
  const attributes = asRecord(system.attributes);
  return withoutUndefined({
    hp: attributes.hp,
    ac: attributes.ac,
    immunities: attributes.immunities,
    weaknesses: attributes.weaknesses,
    resistances: attributes.resistances
  });
}

function withoutUndefined(record: UnknownRecord): UnknownRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function pickItemTypes(itemTypes: unknown): unknown {
  const record = asRecord(itemTypes);
  return {
    condition: record.condition
  };
}
