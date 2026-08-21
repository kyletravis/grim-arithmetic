import { degreeOfSuccess, type DegreeOfSuccess } from './degree-of-success';
import { damageDistribution } from './dice';
import type { Rng } from './prng';
import type { SimulationCombatant } from './simulation-types';

/** Method of healing. */
export type HealKind = 'battle-medicine' | 'heal-spell-1action' | 'heal-spell-2action';

export interface HealSampleInput {
  kind: HealKind;
  /** Heal spell rank (1-10). For spell variants only. */
  spellRank?: number;
  /** Medicine check modifier. For battle-medicine only. */
  medicineModifier?: number;
  /** Medicine DC. For battle-medicine only. */
  medicineDC?: number;
}

export interface HealSampleResult {
  /** HP healed (clamped to non-negative). */
  healedAmount: number;
  /** Battle Medicine roll degree, when applicable. */
  degree?: DegreeOfSuccess;
  /** Damage dealt to the target as a side effect (crit-fail Battle Medicine). */
  collateralDamage?: number;
}

/**
 * PF2e Treat Wounds / Battle Medicine table: a higher DC heals more but
 * requires the matching Medicine proficiency rank.
 */
const BATTLE_MEDICINE_TABLE: ReadonlyArray<{
  dc: 15 | 20 | 30 | 40;
  minRank: number;
  bonus: number;
}> = [
  { dc: 15, minRank: 1, bonus: 0 },
  { dc: 20, minRank: 2, bonus: 10 },
  { dc: 30, minRank: 3, bonus: 30 },
  { dc: 40, minRank: 4, bonus: 50 }
];

/** Highest DC the healer's proficiency allows AND hits (total >= DC) on at least 50% of d20 rolls, i.e. DC - modifier <= 11. */
export function selectBattleMedicineDc(
  rank: number | undefined,
  modifier: number | undefined
): 15 | 20 | 30 | 40 {
  const r = rank ?? 1;
  const m = modifier ?? 0;
  let chosen: 15 | 20 | 30 | 40 = 15;
  for (const row of BATTLE_MEDICINE_TABLE) {
    if (r >= row.minRank && row.dc - m <= 11) chosen = row.dc;
  }
  return chosen;
}

/** Healing bonus granted by the Treat Wounds table for a given DC. */
export function battleMedicineBonusFor(dc: number): number {
  return BATTLE_MEDICINE_TABLE.find((row) => row.dc === dc)?.bonus ?? 0;
}

/**
 * Sample a healing action's outcome using the seeded RNG. Pure function;
 * the caller (orchestrator / tactics) applies the heal to the target.
 *
 * PF2e formulas:
 *
 *  - Battle Medicine: Medicine check against a DC from the Treat Wounds
 *    table (DC 15 / 20 / 30 / 40 for trained / expert / master / legendary,
 *    granting +0 / +10 / +30 / +50 healing).
 *    crit-success: 4d8 + table bonus healed.
 *    success:      2d8 + table bonus healed.
 *    failure:      0 healed.
 *    crit-failure: 0 healed, target takes 1d8 damage.
 *  - Heal spell 1-action (touch): rank d8.
 *  - Heal spell 2-action (30 ft): rank d8 + 8 per rank.
 *
 * Returns the rolled heal amount; the caller writes it to the target.
 */
export function sampleHealAction(input: HealSampleInput, rng: Rng): HealSampleResult {
  switch (input.kind) {
    case 'battle-medicine': {
      const dc = input.medicineDC ?? 15;
      const bonus = battleMedicineBonusFor(dc);
      const modifier = input.medicineModifier ?? 0;
      const die = rng.nextInt(1, 20);
      const total = die + modifier;
      const degree = degreeOfSuccess({ die, total, dc });
      switch (degree) {
        case 'criticalSuccess':
          return { healedAmount: rollFormula(withBonus('4d8', bonus), rng), degree };
        case 'success':
          return { healedAmount: rollFormula(withBonus('2d8', bonus), rng), degree };
        case 'failure':
          return { healedAmount: 0, degree };
        case 'criticalFailure':
          return {
            healedAmount: 0,
            degree,
            collateralDamage: rollFormula('1d8', rng)
          };
      }
      // exhaustive — unreachable
      return { healedAmount: 0, degree };
    }
    case 'heal-spell-1action': {
      const rank = Math.max(1, input.spellRank ?? 1);
      return { healedAmount: rollFormula(`${rank}d8`, rng) };
    }
    case 'heal-spell-2action': {
      const rank = Math.max(1, input.spellRank ?? 1);
      return { healedAmount: rollFormula(`${rank}d8+${rank * 8}`, rng) };
    }
  }
}

function withBonus(dice: string, bonus: number): string {
  return bonus > 0 ? `${dice}+${bonus}` : dice;
}

/**
 * Apply a heal to a combatant. Returns a new immutable state with HP
 * raised by `amount`, clamped at max HP.
 *
 * PF2e: any healing that brings a dying creature to 1+ HP removes the dying
 * condition and wakes them; losing the dying condition increases wounded by
 * 1. A creature that is unconscious at 0 HP without dying (e.g. stabilized
 * by a Hero Point) simply wakes, with no extra wounded.
 */
export function applyHeal(target: SimulationCombatant, amount: number): SimulationCombatant {
  if (amount <= 0) return target;
  const healed = Math.min(target.hp.max, target.hp.current + amount);
  const next: SimulationCombatant = { ...target, hp: { ...target.hp, current: healed } };
  if (healed > 0 && (target.dying > 0 || target.downed)) {
    // PF2e: you lose dying and wake the moment you have 1+ HP; losing dying raises wounded.
    if (target.dying > 0) next.wounded = target.wounded + 1;
    next.dying = 0;
    next.downed = false;
  }
  return next;
}

function rollFormula(formula: string, rng: Rng): number {
  const dist = damageDistribution(formula);
  const u = rng.next();
  let cumulative = 0;
  for (const outcome of dist.outcomes) {
    cumulative += outcome.probability;
    if (u < cumulative) return outcome.damage;
  }
  return dist.outcomes[dist.outcomes.length - 1].damage;
}
