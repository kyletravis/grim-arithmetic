import { DegreeOfSuccess, degreeOfSuccess } from './degree-of-success';

export interface AttackProbabilityInput {
  attackBonus: number;
  ac: number;
}

export interface AttackOutcomeProbabilities {
  criticalSuccess: number;
  success: number;
  failure: number;
  criticalFailure: number;
}

export function attackOutcomeProbabilities(input: AttackProbabilityInput): AttackOutcomeProbabilities {
  const counts: Record<DegreeOfSuccess, number> = {
    criticalSuccess: 0,
    success: 0,
    failure: 0,
    criticalFailure: 0
  };

  for (let die = 1; die <= 20; die += 1) {
    const degree = degreeOfSuccess({
      die,
      total: die + input.attackBonus,
      dc: input.ac
    });
    counts[degree] += 1;
  }

  return {
    criticalSuccess: counts.criticalSuccess / 20,
    success: counts.success / 20,
    failure: counts.failure / 20,
    criticalFailure: counts.criticalFailure / 20
  };
}
