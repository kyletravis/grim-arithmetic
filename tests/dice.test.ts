import { describe, expect, it } from 'vitest';
import { averageDamage, damageDistribution } from '../src/engine/dice';

describe('averageDamage', () => {
  it('calculates average for a single die', () => {
    expect(averageDamage('1d8')).toBeCloseTo(4.5);
  });

  it('calculates average for dice plus modifier', () => {
    expect(averageDamage('2d8+6')).toBeCloseTo(15);
  });

  it('ignores whitespace', () => {
    expect(averageDamage('2d6 + 4')).toBeCloseTo(11);
  });

  it('handles multiple dice terms', () => {
    expect(averageDamage('1d12+1d6+3')).toBeCloseTo(13);
  });

  it('throws for unsupported formulas', () => {
    expect(() => averageDamage('2d8[persistent,fire]+4')).toThrow();
  });
});

describe('damageDistribution', () => {
  it('builds an exact probability mass function for a single die', () => {
    const distribution = damageDistribution('1d4');

    expect(distribution.min).toBe(1);
    expect(distribution.max).toBe(4);
    expect(distribution.mean).toBeCloseTo(2.5);
    expect(distribution.outcomes).toEqual([
      { damage: 1, probability: 0.25 },
      { damage: 2, probability: 0.25 },
      { damage: 3, probability: 0.25 },
      { damage: 4, probability: 0.25 }
    ]);
  });

  it('convolves multiple dice and applies a flat modifier', () => {
    const distribution = damageDistribution('2d6+4');

    expect(distribution.min).toBe(6);
    expect(distribution.max).toBe(16);
    expect(distribution.mean).toBeCloseTo(11);
    expect(distribution.outcomes.find((outcome) => outcome.damage === 11)?.probability).toBeCloseTo(6 / 36);
  });

  it('supports mixed dice terms, flat modifiers, and whitespace variants', () => {
    const distribution = damageDistribution('1d12 + 1d6 + 3');

    expect(distribution.min).toBe(5);
    expect(distribution.max).toBe(21);
    expect(distribution.mean).toBeCloseTo(13);
    expect(distribution.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
  });

  it('supports flat damage formulas as degenerate distributions', () => {
    expect(damageDistribution('4')).toEqual({
      min: 4,
      max: 4,
      mean: 4,
      outcomes: [{ damage: 4, probability: 1 }]
    });
  });

  it('throws for unsupported tagged or conditional formulas', () => {
    expect(() => damageDistribution('2d8[persistent,fire]+4')).toThrow('Unsupported damage formula');
    expect(() => damageDistribution('1d8+1d6 precision')).toThrow('Unsupported damage formula');
  });
});
