import type { DamageDistribution } from './dice';

/**
 * Double every damage value in a distribution (PF2e critical hit: double the
 * whole damage total, not the dice). Returns a fresh distribution; the input
 * is never mutated, so frozen/memoized inputs are safe.
 */
export function doubleDistribution(distribution: DamageDistribution): DamageDistribution {
  return {
    min: distribution.min * 2,
    max: distribution.max * 2,
    mean: distribution.mean * 2,
    outcomes: distribution.outcomes.map((outcome) => ({
      damage: outcome.damage * 2,
      probability: outcome.probability
    }))
  };
}
