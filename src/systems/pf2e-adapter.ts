import { AttackSnapshot, CombatantSnapshot, DamageAdjustmentValue, PcCapabilities, SystemAdapter } from './base-adapter';

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
    spell?: unknown;
    spellcastingEntry?: unknown;
    feat?: unknown;
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
    const initiativeBonus =
      optionalNumber(asRecord(system.perception).value) ??
      optionalNumber(asRecord(attributes.perception).value);

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

    const items = getActorItems(actor);

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

/**
 * PC Strike extraction for v0.6.0-rc.3 PC action modeling.
 *
 * PCs do not expose pre-compiled melee items; their Strikes live in
 * `actor.system.actions` (the PF2e-compiled strike list with totalModifier
 * baked in). When that list is empty or unusable, fall back to walking
 * `actor.items` of `type === 'weapon'` for equipped weapons and synthesize
 * a best-effort Strike. The fallback under-reports attack bonus (no
 * proficiency / ability mod), so we mark that with a caveat in
 * `assumptions`.
 */
function getAttacksFromPcActor(actor: ActorLike): AttackSnapshot[] {
  const system = asRecord(actor.system);
  const actionsRaw = system.actions;
  const actions: unknown[] = Array.isArray(actionsRaw) ? actionsRaw : [];

  const fromActions = actions
    .map((entry): AttackSnapshot | null => extractAttackFromPcAction(entry))
    .filter((attack): attack is AttackSnapshot => attack !== null);

  if (fromActions.length > 0) return fromActions;

  const items = getActorItems(actor);
  return items
    .filter((item) => item.type === 'weapon')
    .filter(isWeaponEquipped)
    .map((item): AttackSnapshot | null => extractAttackFromWeaponItem(item))
    .filter((attack): attack is AttackSnapshot => attack !== null);
}

function extractAttackFromPcAction(action: unknown): AttackSnapshot | null {
  if (!isRecord(action)) return null;

  const attackBonus =
    optionalNumberLike(action.totalModifier) ??
    optionalNumberLike(action.attackBonus) ??
    optionalNumberLike(action.mod) ??
    optionalNumberLike(asRecord(action.attack).totalModifier);
  if (attackBonus === undefined) return null;

  const damageFormula = extractActionDamageFormula(action);
  if (!damageFormula) return null;

  const damageType = extractActionDamageType(action);
  const traits = toStringArray(action.traits);
  const item = asRecord(action.item);
  const id =
    (typeof action.slug === 'string' && action.slug) ||
    (typeof action.id === 'string' && action.id) ||
    (typeof item.id === 'string' && item.id) ||
    '';
  const name =
    (typeof action.label === 'string' && action.label) ||
    (typeof action.name === 'string' && action.name) ||
    (typeof item.name === 'string' && item.name) ||
    'Unknown Strike';

  return {
    id,
    name,
    attackBonus,
    damageFormula,
    damageType,
    traits,
    mapType: traits.includes('agile') ? 'agile' : 'normal',
    assumptions: ['PC Strike extracted from actor.system.actions; conditional modifiers (status, MAP-adjacent feats) may be missing.']
  };
}

function extractActionDamageFormula(action: UnknownRecord): string | undefined {
  if (typeof action.damageFormula === 'string') return action.damageFormula;
  if (typeof action.damage === 'string') return action.damage;
  if (isRecord(action.damage)) {
    const damage = action.damage;
    if (typeof damage.formula === 'string') return damage.formula;
    if (typeof damage.damage === 'string') return damage.damage;
  }
  return undefined;
}

function extractActionDamageType(action: UnknownRecord): string | undefined {
  if (typeof action.damageType === 'string') return action.damageType;
  if (isRecord(action.damage)) {
    const damage = action.damage;
    if (typeof damage.damageType === 'string') return damage.damageType;
    if (typeof damage.type === 'string') return damage.type;
  }
  return undefined;
}

function isWeaponEquipped(item: ItemLike): boolean {
  const system = asRecord(item.system);
  const equipped = asRecord(system.equipped);
  if (equipped.carryType === 'held') return true;
  const handsHeld = optionalNumberLike(equipped.handsHeld);
  if (handsHeld !== undefined && handsHeld > 0) return true;
  return false;
}

function extractAttackFromWeaponItem(item: ItemLike): AttackSnapshot | null {
  const system = asRecord(item.system);
  const damage = asRecord(system.damage);
  const dice = optionalNumberLike(damage.dice) ?? 1;
  const die = optionalNumberLike(damage.die) ?? 6;
  const modifier = optionalNumberLike(damage.modifier) ?? 0;
  if (dice < 1 || die < 2) return null;

  const damageFormula =
    modifier > 0
      ? `${dice}d${die}+${modifier}`
      : modifier < 0
        ? `${dice}d${die}${modifier}`
        : `${dice}d${die}`;
  const damageType =
    typeof damage.damageType === 'string'
      ? damage.damageType
      : typeof damage.type === 'string'
        ? damage.type
        : undefined;

  const attackBonus = optionalNumberLike(asRecord(system.bonus).value) ?? 0;
  const traits = toStringArray(asRecord(system.traits).value);

  return {
    id: item.id ?? '',
    name: item.name ?? 'Unknown Weapon',
    attackBonus,
    damageFormula,
    damageType,
    traits,
    mapType: traits.includes('agile') ? 'agile' : 'normal',
    assumptions: [
      'PC Strike fallback from weapon item: attack bonus excludes character proficiency and ability modifiers.'
    ]
  };
}

/**
 * Phase I-A extraction: Medicine skill + Battle Medicine feat.
 *
 * PF2e exposes Medicine as one of `system.skills` (with `.value` or
 * `.totalModifier`) on the actor system; the modifier already includes
 * proficiency + ability + item bonus where applicable. Battle Medicine
 * is a feat item; we detect it by slug.
 *
 * Medicine DC is derived from PF2e's proficiency-rank table: trained 15,
 * expert 20, master 30, legendary 40 (rc.4 default; future iterations
 * may scale by character level instead).
 */
function extractPcCapabilities(actor: ActorLike): PcCapabilities | undefined {
  const system = asRecord(actor.system);
  const skills = asRecord(system.skills);
  const medicine = asRecord(skills.medicine);
  const medicineModifier =
    optionalNumberLike(medicine.totalModifier) ?? optionalNumberLike(medicine.value);
  const medicineRank = optionalNumberLike(medicine.rank);
  const medicineDC = medicineDcForRank(medicineRank);
  const hasBattleMedicine = detectBattleMedicineFeat(actor);
  const { healSpellSlots, healCantripLevel } = extractHealCapability(actor);

  if (isAdapterDebugLoggingEnabled()) {
    logHealingExtractionDebug(actor, healSpellSlots, healCantripLevel);
  }

  const hasAnySignal =
    medicineModifier !== undefined ||
    hasBattleMedicine ||
    Object.keys(healSpellSlots).length > 0 ||
    healCantripLevel !== null;

  if (!hasAnySignal) {
    return { medicineDC, healCantripLevel: null };
  }
  return {
    medicineModifier,
    hasBattleMedicine,
    medicineDC,
    healSpellSlots: Object.keys(healSpellSlots).length > 0 ? healSpellSlots : undefined,
    healCantripLevel
  };
}

function extractHealCapability(actor: ActorLike): {
  healSpellSlots: Record<number, number>;
  healCantripLevel: number | null;
} {
  const spellItems = getActorItemsOfType(actor, 'spell');
  const entryItems = getActorItemsOfType(actor, 'spellcastingEntry');
  const slots: Record<number, number> = {};
  let cantripLevel: number | null = null;

  const healSpellIds = new Set<string>();
  let foundHealSpell = false;
  for (const item of spellItems) {
    const system = asRecord(item.system);
    if (spellSlug(item, system) !== 'heal') continue;

    foundHealSpell = true;
    const itemId = getItemId(item);
    if (itemId) healSpellIds.add(itemId);

    if (isCantripSpell(system)) {
      const level = optionalNumberLike(system.casterLevel) ?? extractCasterLevelFromActor(actor);
      cantripLevel = level ?? cantripLevel ?? 1;
    }
  }

  let entrySlotsFound = false;
  for (const item of entryItems) {
    const system = asRecord(item.system);
    const preparedKind = asRecord(system.prepared);
    const preparationKind = typeof preparedKind.value === 'string'
      ? (preparedKind.value as string)
      : undefined;
    const entrySlots = asRecord(system.slots);

    for (const [slotKey, slotData] of Object.entries(entrySlots)) {
      const rank = parseSlotRank(slotKey);
      if (rank === undefined) continue;
      const slotRecord = asRecord(slotData);

      const preparedList = readPreparedList(slotRecord.prepared);

      let preparedHealCount = 0;
      for (const prep of preparedList) {
        const prepRecord = asRecord(prep);
        const spellId = prepRecord.id;
        if (typeof spellId !== 'string') continue;
        if (!healSpellIds.has(spellId)) continue;
        if (prepRecord.expended === true) continue;
        preparedHealCount += 1;
      }

      if (preparedHealCount > 0) {
        entrySlotsFound = true;
        if (rank === 0) {
          if (cantripLevel === null) {
            cantripLevel = extractCasterLevelFromActor(actor) ?? 1;
          }
        } else {
          slots[rank] = (slots[rank] ?? 0) + preparedHealCount;
        }
        continue;
      }

      if (preparationKind === 'spontaneous' && foundHealSpell && rank >= 1) {
        const remaining = optionalNumberLike(slotRecord.value);
        if (remaining !== undefined && remaining > 0) {
          slots[rank] = (slots[rank] ?? 0) + remaining;
          entrySlotsFound = true;
        }
      }
    }
  }

  if (!entrySlotsFound) {
    for (const item of spellItems) {
      const system = asRecord(item.system);
      if (spellSlug(item, system) !== 'heal') continue;
      if (isCantripSpell(system)) continue;

      const rank =
        optionalNumberLike(system.level) ?? optionalNumberLike(asRecord(system.location).heightenedLevel);
      const count = optionalNumberLike(system.slotsRemaining) ?? optionalNumberLike(system.uses) ?? 1;
      if (typeof rank === 'number' && rank >= 1 && count > 0) {
        slots[rank] = (slots[rank] ?? 0) + count;
      }
    }
  }

  return { healSpellSlots: slots, healCantripLevel: cantripLevel };
}

function readPreparedList(prepared: unknown): unknown[] {
  if (Array.isArray(prepared)) return prepared;
  if (prepared === undefined || prepared === null) return [];
  if (typeof prepared !== 'object') return [];
  return Object.values(prepared as UnknownRecord);
}

function getItemId(item: ItemLike): string | undefined {
  if (typeof item.id === 'string' && item.id.length > 0) return item.id;
  const raw = item as unknown as { _id?: string };
  if (typeof raw._id === 'string' && raw._id.length > 0) return raw._id;
  return undefined;
}

function getActorItemsOfType(actor: ActorLike | undefined, type: string): ItemLike[] {
  if (!actor) return [];
  const itemTypes = asRecord(actor.itemTypes);
  const typed = itemTypes[type];
  if (Array.isArray(typed) && typed.length > 0) {
    return typed.filter(isItemLike);
  }
  const all = getActorItems(actor);
  return all.filter((item) => item.type === type);
}

function spellSlug(item: ItemLike, system: UnknownRecord): string | undefined {
  if (typeof system.slug === 'string') return system.slug;
  return item.name?.toLowerCase().replace(/\s+/g, '-');
}

function parseSlotRank(key: string): number | undefined {
  const match = key.match(/^slot(\d+)$/);
  if (!match) return undefined;
  return Number(match[1]);
}

function isCantripSpell(system: UnknownRecord): boolean {
  const traits = asRecord(system.traits);
  const traitValues = toStringArray(traits.value);
  if (traitValues.includes('cantrip')) return true;
  if (system.isCantrip === true) return true;
  const level = optionalNumberLike(system.level);
  return level === 0;
}

function extractCasterLevelFromActor(actor: ActorLike): number | undefined {
  const system = asRecord(actor.system);
  const details = asRecord(system.details);
  const level = asRecord(details.level);
  return optionalNumberLike(level.value) ?? optionalNumberLike(details.level);
}

function medicineDcForRank(rank: number | undefined): number {
  switch (rank) {
    case 4:
      return 40;
    case 3:
      return 30;
    case 2:
      return 20;
    case 1:
      return 15;
    default:
      return 15;
  }
}

function detectBattleMedicineFeat(actor: ActorLike): boolean {
  const items = getActorItemsOfType(actor, 'feat');
  for (const item of items) {
    const system = asRecord(item.system);
    const slug = typeof system.slug === 'string' ? system.slug : item.name?.toLowerCase().replace(/\s+/g, '-');
    if (slug === 'battle-medicine') return true;
  }
  return false;
}

function isAdapterDebugLoggingEnabled(): boolean {
  if (typeof game === 'undefined') return false;
  try {
    return Boolean(
      (game as { settings?: { get?: (module: string, key: string) => unknown } })
        .settings
        ?.get?.('grim-arithmetic', 'debugLogging') ?? false
    );
  } catch {
    return false;
  }
}

function logHealingExtractionDebug(
  actor: ActorLike,
  extractedSlots: Record<number, number>,
  extractedCantripLevel: number | null
): void {
  const allItems = getActorItems(actor);
  const itemTypes = asRecord(actor.itemTypes);

  const typeCounts: Record<string, number> = {};
  for (const item of allItems) {
    const t = typeof item.type === 'string' ? item.type : '(no-type)';
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }

  const itemTypeKeys = Object.keys(itemTypes);
  const itemTypeArrayLengths: Record<string, number> = {};
  for (const key of itemTypeKeys) {
    const v = itemTypes[key];
    if (Array.isArray(v)) itemTypeArrayLengths[key] = v.length;
  }

  const spellItems = getActorItemsOfType(actor, 'spell');
  const entryItems = getActorItemsOfType(actor, 'spellcastingEntry');

  const healSpells = spellItems
    .filter((item) => spellSlug(item, asRecord(item.system)) === 'heal')
    .map((item) => ({
      id: getItemId(item),
      name: item.name,
      slug: asRecord(item.system).slug,
      level: asRecord(item.system).level,
      isCantrip: asRecord(item.system).isCantrip,
      traits: asRecord(asRecord(item.system).traits).value,
      slotsRemaining: asRecord(item.system).slotsRemaining,
      location: asRecord(item.system).location
    }));

  const entries = entryItems.map((item) => {
    const system = asRecord(item.system);
    const slotsMap = asRecord(system.slots);
    const slotSummaries: Record<string, unknown> = {};
    for (const [key, data] of Object.entries(slotsMap)) {
      const sd = asRecord(data);
      const prepared = readPreparedList(sd.prepared);
      slotSummaries[key] = {
        max: sd.max,
        value: sd.value,
        preparedCount: prepared.length,
        preparedSample: prepared.slice(0, 5).map((p) => asRecord(p))
      };
    }
    return {
      id: getItemId(item),
      name: item.name,
      preparedKind: asRecord(system.prepared).value,
      tradition: asRecord(system.tradition).value,
      slotKeys: Object.keys(slotsMap),
      slotSummaries
    };
  });

  console.log('Grim Arithmetic | extraction probe', {
    actor: actor.name,
    actorType: actor.type,
    totalItems: allItems.length,
    itemTypeCounts: typeCounts,
    itemTypesArrayLengths: itemTypeArrayLengths,
    healSpells,
    spellcastingEntries: entries,
    extractedSlots,
    extractedCantripLevel
  });
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
