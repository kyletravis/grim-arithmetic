import { describe, expect, it } from 'vitest';
import { attackOutcomeProbabilities } from '../src/engine/attack-probability';

describe('attackOutcomeProbabilities', () => {
  it('returns probabilities that sum to 1', () => {
    const result = attackOutcomeProbabilities({ attackBonus: 10, ac: 20 });
    const total = result.criticalSuccess + result.success + result.failure + result.criticalFailure;
    expect(total).toBeCloseTo(1);
  });

  it('has a 5 percent natural 20 crit floor when otherwise only a success', () => {
    const result = attackOutcomeProbabilities({ attackBonus: 0, ac: 20 });
    expect(result.criticalSuccess).toBeCloseTo(0.05);
  });

  it('returns higher crit chance when attack bonus greatly exceeds AC', () => {
    const result = attackOutcomeProbabilities({ attackBonus: 20, ac: 20 });
    expect(result.criticalSuccess).toBeGreaterThan(0.5);
  });
});
