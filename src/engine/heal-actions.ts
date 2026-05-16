import { degreeOfSuccess, type DegreeOfSuccess } from './degree-of-success';
import { damageDistribution } from './dice';
import type { Rng } from './prng';
import type { SimulationCombatant } from './simulation-types';

/** Method of healing. */
export type HealKind =
  | 'battle-medicine'
  | 'heal-spell-1action'
  | 'heal-spell-2action'
  | 'heal-spell-3action'
  | 'heal-cantrip-1action'
  | 'heal-cantrip-2action';

export interface HealSampleInput {
  kind: HealKind;
  /** PF2e character level of the healer (for cantrip scaling). */
  healerLevel?: number;
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
 * Sample a healing action's outcome using the seeded RNG. Pure function;
 * the caller (orchestrator / tactics) applies the heal to the target.
 *
 * PF2e formulas (rc.4 simplification — proficiency bonuses approximate
 * the rulebook scaling but do not yet model treat-wounds-medicine-feats
 * like Continual Recovery or Risky Surgery):
 *
 *  - Battle Medicine: Medicine check vs DC.
 *    crit-success: 4d8 + 8 healed.
 *    success:      2d8 + 4 healed.
 *    failure:      0 healed.
 *    crit-failure: 0 healed, target takes 1d8 damage.
 *  - Heal spell 1-action: 1d10 single target.
 *  - Heal spell 2-action: 1d8 + 8 per rank.
 *  - Heal spell 3-action: 1d8 + 8 per rank (AoE; sim ignores positioning).
 *  - Heal cantrip 1-action: 1d10 single target (cantrip never adds modifiers).
 *  - Heal cantrip 2-action: (1 + ceil(level/2)) * d8 (heightened scaling).
 *
 * Returns the rolled heal amount; the caller writes it to the target.
 */
export function sampleHealAction(input: HealSampleInput, rng: Rng): HealSampleResult {
  switch (input.kind) {
    case 'battle-medicine': {
      const dc = input.medicineDC ?? 15;
      const modifier = input.medicineModifier ?? 0;
      const die = rng.nextInt(1, 20);
      const total = die + modifier;
      const degree = degreeOfSuccess({ die, total, dc });
      switch (degree) {
        case 'criticalSuccess':
          return { healedAmount: rollFormula('4d8+8', rng), degree };
        case 'success':
          return { healedAmount: rollFormula('2d8+4', rng), degree };
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
    case 'heal-spell-1action':
      return { healedAmount: rollFormula('1d10', rng) };
    case 'heal-spell-2action': {
      const rank = Math.max(1, input.spellRank ?? 1);
      return { healedAmount: rollFormula(`${rank}d8+${rank * 8}`, rng) };
    }
    case 'heal-spell-3action': {
      const rank = Math.max(1, input.spellRank ?? 1);
      return { healedAmount: rollFormula(`${rank}d8+${rank * 8}`, rng) };
    }
    case 'heal-cantrip-1action':
      return { healedAmount: rollFormula('1d10', rng) };
    case 'heal-cantrip-2action': {
      const level = Math.max(1, input.healerLevel ?? 1);
      const diceCount = 1 + Math.ceil(level / 2);
      return { healedAmount: rollFormula(`${diceCount}d8`, rng) };
    }
  }
}

/**
 * Apply a heal to a combatant. Returns a new immutable state with HP
 * raised by `amount`, clamped at max HP.
 *
 * Heal spells cast on a dying target also remove dying (per PF2e rules);
 * the caller signals this via `clearsDying = true` (set by the heal-spell
 * tactics path; Battle Medicine does NOT clear dying).
 */
export function applyHeal(
  target: SimulationCombatant,
  amount: number,
  options: { clearsDying?: boolean } = {}
): SimulationCombatant {
  if (amount <= 0 && !options.clearsDying) return target;
  const healed = Math.min(target.hp.max, target.hp.current + Math.max(0, amount));
  const next: SimulationCombatant = {
    ...target,
    hp: { ...target.hp, current: healed }
  };
  if (options.clearsDying && next.dying > 0) {
    next.dying = 0;
    // Dying gets cleared, but the PC may still be at 0 HP if the heal
    // didn't restore HP. The orchestrator decides if downed flips back.
    if (healed > 0) next.downed = false;
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
