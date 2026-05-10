import { describe, expect, it } from 'vitest';
import { averageDamage } from '../src/engine/dice';

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
