import { degreeOfSuccess, type DegreeOfSuccess } from './degree-of-success';
import type { Rng } from './prng';
import type { SimulationCombatant } from './simulation-types';

/** Outcome of a single PF2e recovery check. */
export interface RecoveryOutcome {
  /** The raw d20 result. */
  roll: number;
  /** Step-shifted PF2e degree of success. */
  degree: DegreeOfSuccess;
  /** Combatant's new dying value after applying the outcome. */
  newDying: number;
  /** True when the combatant successfully exits dying (newDying === 0). */
  stabilized: boolean;
}

/**
 * Roll a PF2e recovery check for a dying combatant.
 *
 * PF2e rules: at the start of a dying combatant's turn, roll a flat
 * check vs DC 10 + dying value. The four degrees of success map to:
 *   - crit-success: dying -= 2 (stabilizes at 0, restores wakefulness)
 *   - success:      dying -= 1
 *   - failure:      no change
 *   - crit-failure: dying += 1 (and may cross the death threshold)
 *
 * Nat 1 / nat 20 step-shift through the existing degreeOfSuccess helper.
 *
 * Note: this function does not write back to the combatant. The caller
 * (run-iteration.ts) applies `newDying` and the resulting wake/death
 * transitions.
 */
export function sampleRecoveryCheck(combatant: SimulationCombatant, rng: Rng): RecoveryOutcome {
  if (combatant.dying <= 0) {
    return { roll: 0, degree: 'success', newDying: 0, stabilized: true };
  }
  const dc = 10 + combatant.dying;
  const roll = rng.nextInt(1, 20);
  const degree = degreeOfSuccess({ die: roll, total: roll, dc });

  let delta = 0;
  switch (degree) {
    case 'criticalSuccess':
      delta = -2;
      break;
    case 'success':
      delta = -1;
      break;
    case 'failure':
      delta = 0;
      break;
    case 'criticalFailure':
      delta = 1;
      break;
  }

  const newDying = Math.max(0, combatant.dying + delta);
  return {
    roll,
    degree,
    newDying,
    stabilized: newDying === 0
  };
}
