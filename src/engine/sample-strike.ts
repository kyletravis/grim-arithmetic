import type { DamageAdjustments } from '../systems/base-adapter';
import type { DegreeOfSuccess } from './degree-of-success';
import { degreeOfSuccess } from './degree-of-success';
import type { DamageDistribution } from './dice';
import { damageDistribution } from './dice';
import {
  applyDamageAdjustment,
  buildDamageAdjustmentSummary,
  doubleDistribution
} from './mortality';
import type { Rng } from './prng';

/**
 * Inputs for a single seeded Strike sample.
 *
 * The caller (round orchestrator) is responsible for computing the appropriate
 * mapPenalty for which strike this is (0 / -5 / -10 for normal, 0 / -4 / -8
 * for agile, etc.). The sampler does not track MAP escalation itself.
 */
export interface StrikeSampleInput {
  attackerId: string;
  defenderId: string;
  attackId: string;
  attackName: string;
  attackBonus: number;
  mapPenalty: number;
  defenderAc: number;
  damageFormula: string;
  damageType?: string;
  defenderAdjustments?: DamageAdjustments;
}

/** Outcome of a single seeded Strike sample. */
export interface StrikeSampleResult {
  attackerId: string;
  defenderId: string;
  attackId: string;
  attackName: string;
  degree: DegreeOfSuccess;
  /** The d20 die face that came up. */
  dieRoll: number;
  /** Post-adjustment damage. 0 on failure / critical failure. */
  damage: number;
}

/**
 * Sample one Strike using a seeded RNG.
 *
 *  1. Draw d20 face via rng.nextInt(1, 20).
 *  2. Apply existing PF2e degree-of-success rules (nat-1 / nat-20 step-shift
 *     handled by the shared helper).
 *  3. On success or critical success, sample damage from the exact PMF that
 *     the analytic engine already constructs (damageDistribution +
 *     doubleDistribution + applyDamageAdjustment) using inverse-CDF over
 *     rng.next().
 *  4. Apply defender resistance / weakness / immunity via the same
 *     helper used by the v0.5.0 panel.
 *
 * Identical seeds produce identical outputs.
 *
 * Performance: PMFs are rebuilt per call. The round orchestrator can cache
 * per-(attack × defender) PMFs across rounds if profiling shows it matters.
 */
export function sampleStrike(input: StrikeSampleInput, rng: Rng): StrikeSampleResult {
  const die = rng.nextInt(1, 20);
  const total = die + input.attackBonus + input.mapPenalty;
  const degree = degreeOfSuccess({ die, total, dc: input.defenderAc });

  let damage = 0;
  if (degree === 'success' || degree === 'criticalSuccess') {
    const baseDamage = damageDistribution(input.damageFormula);
    const adjustment = buildDamageAdjustmentSummary(input.damageType, input.defenderAdjustments);
    const distribution =
      degree === 'criticalSuccess'
        ? applyDamageAdjustment(doubleDistribution(baseDamage), adjustment)
        : applyDamageAdjustment(baseDamage, adjustment);
    damage = sampleFromDistribution(distribution, rng);
  }

  return {
    attackerId: input.attackerId,
    defenderId: input.defenderId,
    attackId: input.attackId,
    attackName: input.attackName,
    degree,
    dieRoll: die,
    damage
  };
}

function sampleFromDistribution(distribution: DamageDistribution, rng: Rng): number {
  const u = rng.next();
  let cumulative = 0;
  for (const outcome of distribution.outcomes) {
    cumulative += outcome.probability;
    if (u < cumulative) return outcome.damage;
  }
  // Floating-point safety net: the last outcome catches the unlikely u === 1
  // rounding edge.
  return distribution.outcomes[distribution.outcomes.length - 1].damage;
}
