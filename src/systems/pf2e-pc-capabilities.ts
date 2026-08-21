import { isDebugLoggingEnabled } from '../settings';
import { PcCapabilities } from './base-adapter';
import type { Pf2eActorLike } from './pf2e-adapter';
import {
  asRecord,
  isRecord,
  optionalNumberLike,
  toItemLikes,
  toStringArray,
  type ItemLike,
  type UnknownRecord
} from './record-utils';

function isItemLike(value: unknown): value is ItemLike {
  return isRecord(value);
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
export function extractPcCapabilities(actor: Pf2eActorLike): PcCapabilities | undefined {
  const system = asRecord(actor.system);
  const skills = asRecord(system.skills);
  const medicine = asRecord(skills.medicine);
  const medicineModifier =
    optionalNumberLike(medicine.totalModifier) ??
    optionalNumberLike(medicine.mod) ??
    optionalNumberLike(medicine.value);
  const medicineRank = optionalNumberLike(medicine.rank);
  const medicineDC = medicineDcForRank(medicineRank);
  const hasBattleMedicine = detectBattleMedicineFeat(actor);
  const { healSpellSlots, healCantripLevel } = extractHealCapability(actor);

  if (isDebugLoggingEnabled()) {
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

function extractHealCapability(actor: Pf2eActorLike): {
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
    const preparationKind =
      typeof preparedKind.value === 'string' ? (preparedKind.value as string) : undefined;
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
        optionalNumberLike(system.level) ??
        optionalNumberLike(asRecord(system.location).heightenedLevel);
      const count =
        optionalNumberLike(system.slotsRemaining) ?? optionalNumberLike(system.uses) ?? 1;
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

function getActorItemsOfType(actor: Pf2eActorLike | undefined, type: string): ItemLike[] {
  if (!actor) return [];
  const itemTypes = asRecord(actor.itemTypes);
  const typed = itemTypes[type];
  if (Array.isArray(typed) && typed.length > 0) {
    return typed.filter(isItemLike);
  }
  const all = toItemLikes(actor.items);
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

function extractCasterLevelFromActor(actor: Pf2eActorLike): number | undefined {
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

function detectBattleMedicineFeat(actor: Pf2eActorLike): boolean {
  const items = getActorItemsOfType(actor, 'feat');
  for (const item of items) {
    const system = asRecord(item.system);
    const slug =
      typeof system.slug === 'string' ? system.slug : item.name?.toLowerCase().replace(/\s+/g, '-');
    if (slug === 'battle-medicine') return true;
  }
  return false;
}

function logHealingExtractionDebug(
  actor: Pf2eActorLike,
  extractedSlots: Record<number, number>,
  extractedCantripLevel: number | null
): void {
  const allItems = toItemLikes(actor.items);
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
