import type { AttackSnapshot } from './base-adapter';
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

export const PC_STRIKE_ASSUMPTION_ACTIONS =
  'PC Strike extracted from actor.system.actions; conditional modifiers (status, MAP-adjacent feats) may be missing.';
export const PC_STRIKE_ASSUMPTION_SYNTHESIZED =
  'PC Strike damage synthesized from weapon dice × striking rune + ability modifier; weapon specialization, property runes, and conditional modifiers are not included.';
export const PC_STRIKE_ASSUMPTION_FALLBACK =
  'PC Strike fallback from weapon item: attack bonus excludes character proficiency and ability modifiers.';

/**
 * PC Strike extraction for v0.6.0-rc.3 PC action modeling.
 *
 * PCs do not expose pre-compiled melee items; their Strikes live in
 * `actor.system.actions` (the PF2e-compiled strike list with totalModifier
 * baked in). Live PF2e strikes carry `damage` as a roll *function* rather
 * than a formula string, so when no formula is available we synthesize one
 * from the backing weapon item. When that list is empty or unusable, fall
 * back to walking `actor.items` of `type === 'weapon'` for equipped weapons
 * and synthesize a best-effort Strike. The fallback under-reports attack
 * bonus (no proficiency / ability mod), so we mark that with a caveat in
 * `assumptions`.
 */
export function getAttacksFromPcActor(actor: Pf2eActorLike): AttackSnapshot[] {
  const system = asRecord(actor.system);
  const actionsRaw = system.actions;
  const actions: unknown[] = Array.isArray(actionsRaw) ? actionsRaw : [];

  const fromActions = preferReadyActions(actions)
    .map((entry): AttackSnapshot | null => extractAttackFromPcAction(entry, actor))
    .filter((attack): attack is AttackSnapshot => attack !== null);

  if (fromActions.length > 0) return fromActions;

  const items = toItemLikes(actor.items);
  return items
    .filter((item) => item.type === 'weapon')
    .filter(isWeaponEquipped)
    .map((item): AttackSnapshot | null => extractAttackFromWeaponItem(item))
    .filter((attack): attack is AttackSnapshot => attack !== null);
}

/**
 * PF2e flags the strikes of currently-held weapons `ready`. When any strike
 * carries the flag, the unflagged ones belong to stowed weapons the PC cannot
 * Strike with this turn, so drop them. Data without the flag keeps every
 * strike (older PF2e versions and hand-built fixtures).
 */
function preferReadyActions(actions: readonly unknown[]): unknown[] {
  const ready = actions.filter((entry) => isRecord(entry) && entry.ready === true);
  return ready.length > 0 ? ready : [...actions];
}

function extractAttackFromPcAction(action: unknown, actor: Pf2eActorLike): AttackSnapshot | null {
  if (!isRecord(action)) return null;

  const attackBonus =
    optionalNumberLike(action.totalModifier) ??
    optionalNumberLike(action.attackBonus) ??
    optionalNumberLike(action.mod) ??
    optionalNumberLike(asRecord(action.attack).totalModifier);
  if (attackBonus === undefined) return null;

  const traits = strikeTraits(action);
  let damageFormula = extractActionDamageFormula(action);
  let damageType = extractActionDamageType(action);
  let assumption = PC_STRIKE_ASSUMPTION_ACTIONS;
  if (!damageFormula) {
    const synthesized = synthesizeDamageFromStrikeItem(action, actor, traits);
    if (!synthesized) return null;
    damageFormula = synthesized.formula;
    damageType = damageType ?? synthesized.damageType;
    assumption = PC_STRIKE_ASSUMPTION_SYNTHESIZED;
  }

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
    assumptions: [assumption]
  };
}

/** Strike traits live on the action and/or the backing weapon item; merge both, de-duplicated. */
function strikeTraits(action: UnknownRecord): string[] {
  const itemSystem = asRecord(asRecord(action.item ?? action.weapon).system);
  const merged = toStringArray(action.traits).concat(
    toStringArray(asRecord(itemSystem.traits).value)
  );
  return [...new Set(merged)];
}

interface SynthesizedDamage {
  formula: string;
  damageType?: string;
}

/** PF2e: dice count = base dice + striking rune value; die like "d8" or 8. */
function synthesizeDamageFromStrikeItem(
  action: UnknownRecord,
  actor: Pf2eActorLike,
  traits: string[]
): SynthesizedDamage | undefined {
  const item = asRecord(action.item ?? action.weapon);
  const system = asRecord(item.system);
  const damage = asRecord(system.damage);
  const baseDice = optionalNumberLike(damage.dice);
  const die = parseDie(damage.die);
  if (baseDice === undefined || baseDice < 1 || die === undefined) return undefined;
  const striking = optionalNumberLike(asRecord(system.runes).striking) ?? 0;
  const dice = baseDice + Math.max(0, Math.floor(striking));
  const abilityMod = abilityModifierFor(actor, traits, system);
  const flat = abilityMod + (optionalNumberLike(damage.modifier) ?? 0);
  const formula =
    flat > 0 ? `${dice}d${die}+${flat}` : flat < 0 ? `${dice}d${die}${flat}` : `${dice}d${die}`;
  const damageType = typeof damage.damageType === 'string' ? damage.damageType : undefined;
  return { formula, damageType };
}

function parseDie(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 2) return value;
  if (typeof value === 'string') {
    const match = value.trim().match(/^d?(\d+)$/);
    if (match) {
      const parsed = Number(match[1]);
      if (parsed >= 2) return parsed;
    }
  }
  return undefined;
}

/**
 * STR for melee/thrown damage (finesse only affects the attack roll, not damage);
 * DEX when the actor has the thief racket, the weapon is finesse, and DEX is
 * higher; ranged: 0 unless thrown (STR) or propulsive (half STR if positive).
 */
function abilityModifierFor(
  actor: Pf2eActorLike,
  traits: string[],
  weaponSystem: UnknownRecord
): number {
  const abilities = asRecord(asRecord(actor.system).abilities);
  const str = optionalNumberLike(asRecord(abilities.str).mod) ?? 0;
  const dex = optionalNumberLike(asRecord(abilities.dex).mod) ?? 0;
  const range = optionalNumberLike(weaponSystem.range);
  const isRanged = range !== undefined && range > 0;
  const isThrown = traits.some((t) => t === 'thrown' || t.startsWith('thrown-'));
  if (isRanged && !isThrown) {
    if (traits.includes('propulsive')) return str > 0 ? Math.floor(str / 2) : str;
    return 0;
  }
  if (traits.includes('finesse') && dex > str && hasThiefRacket(actor)) return dex;
  return str;
}

/** PF2e stores the rogue thief racket as a class-feature item (slug `thief-racket`). */
function hasThiefRacket(actor: Pf2eActorLike): boolean {
  return toItemLikes(actor.items).some((item) => {
    const slug = asRecord(item.system).slug;
    const normalized =
      typeof slug === 'string' ? slug : item.name?.toLowerCase().replace(/\s+/g, '-');
    return normalized === 'thief-racket' || normalized === 'thief';
  });
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
    assumptions: [PC_STRIKE_ASSUMPTION_FALLBACK]
  };
}
