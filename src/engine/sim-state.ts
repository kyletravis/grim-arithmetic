import type { DegreeOfSuccess } from './degree-of-success';
import type { SimulationCombatant } from './simulation-types';

/**
 * Damage event being applied to a combatant.
 *
 * Degree determines whether a PC entering dying takes Dying 1 (normal hit) or
 * Dying 2 (critical hit). Damage is the post-resistance, post-weakness amount
 * the sampler already adjusted.
 */
export interface DamageApplication {
  damage: number;
  degree: DegreeOfSuccess;
}

/**
 * Result of applying damage to a combatant.
 *
 * The combatant field is a new immutable object; the input is never mutated.
 * becameDowned and becameDead are edge transitions (false if the target was
 * already in that state going into the call) so the caller can recognize the
 * first-down round for metrics.
 */
export interface AppliedDamageResult {
  combatant: SimulationCombatant;
  damageAbsorbed: number;
  becameDowned: boolean;
  becameDead: boolean;
}

/**
 * Apply a damage event to a SimulationCombatant and return the next state.
 *
 * Rules (mirrors docs/ARITHMETIC.md v0.3.0 dying severity model):
 *   1. Temp HP absorbs first, then current HP, never below 0.
 *   2. PC at 0 HP not yet dying:
 *        normal hit -> dying = 1 + wounded
 *        crit hit   -> dying = 2 + wounded
 *      Sets downed = true.
 *   3. PC at 0 HP already dying:
 *        normal hit -> dying += 1
 *        crit hit   -> dying += 2
 *   4. Death threshold = max(1, 4 - doomed). PC marked dead when
 *      dying >= threshold.
 *   5. Enemy at 0 HP is marked dead directly (no dying spiral in v0.6.0).
 *   6. Already-dead targets are a no-op.
 *
 * Recovery checks, healing, and persistent damage are deferred to v0.8.0+.
 */
export function applyDamage(
  target: SimulationCombatant,
  application: DamageApplication
): AppliedDamageResult {
  if (target.dead) {
    return { combatant: target, damageAbsorbed: 0, becameDowned: false, becameDead: false };
  }

  if (application.damage <= 0) {
    return { combatant: target, damageAbsorbed: 0, becameDowned: false, becameDead: false };
  }

  const wasDying = target.dying > 0 || target.downed;
  const wasDowned = target.downed;

  let remaining = application.damage;
  let temp = target.hp.temp;
  if (temp > 0) {
    const absorbedFromTemp = Math.min(temp, remaining);
    temp -= absorbedFromTemp;
    remaining -= absorbedFromTemp;
  }

  const current = Math.max(0, target.hp.current - remaining);
  const nextBase: SimulationCombatant = {
    ...target,
    hp: { ...target.hp, current, temp }
  };

  if (current > 0) {
    return {
      combatant: nextBase,
      damageAbsorbed: application.damage,
      becameDowned: false,
      becameDead: false
    };
  }

  // HP reached 0.
  if (target.side === 'enemy') {
    return {
      combatant: { ...nextBase, downed: true, dead: true },
      damageAbsorbed: application.damage,
      becameDowned: !wasDowned,
      becameDead: true
    };
  }

  const dyingIncrement = application.degree === 'criticalSuccess' ? 2 : 1;
  const dying = wasDying ? target.dying + dyingIncrement : dyingIncrement + target.wounded;
  const deathThreshold = Math.max(1, 4 - target.doomed);
  const dead = dying >= deathThreshold;

  return {
    combatant: {
      ...nextBase,
      dying,
      downed: true,
      dead
    },
    damageAbsorbed: application.damage,
    becameDowned: !wasDowned,
    becameDead: dead
  };
}

/**
 * Doomed-adjusted death threshold for a given combatant.
 *
 * Exported so tactics profiles and result aggregators can report consistent
 * thresholds without re-deriving the rule.
 */
export function deathThresholdFor(combatant: SimulationCombatant): number {
  return Math.max(1, 4 - combatant.doomed);
}
