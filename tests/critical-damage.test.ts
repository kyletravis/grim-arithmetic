import { describe, expect, it } from 'vitest';
import {
  criticalDistribution,
  describeCritModel,
  parseCritTraits
} from '../src/engine/critical-damage';

describe('parseCritTraits', () => {
  it('reads deadly-dX and scales dice with striking', () => {
    expect(parseCritTraits(['deadly-d10'], 1)).toEqual({ deadlyDie: 10, deadlyDice: 1 });
    expect(parseCritTraits(['deadly-d10'], 2)).toEqual({ deadlyDie: 10, deadlyDice: 1 });
    expect(parseCritTraits(['deadly-d10'], 3)).toEqual({ deadlyDie: 10, deadlyDice: 2 });
    expect(parseCritTraits(['deadly-d10'], 4)).toEqual({ deadlyDie: 10, deadlyDice: 3 });
  });
  it('reads fatal-dX and ignores fatal-aim', () => {
    expect(parseCritTraits(['fatal-d12'], 1)).toEqual({ fatalDie: 12, deadlyDice: 0 });
    expect(parseCritTraits(['fatal-aim-d12'], 1)).toEqual({ deadlyDice: 0 });
  });
});

describe('criticalDistribution', () => {
  it('plain double when no traits', () => {
    const d = criticalDistribution('1d4+2');
    expect([d.min, d.max]).toEqual([6, 12]);
  });
  it('deadly adds one die after doubling', () => {
    const d = criticalDistribution('1d4+2', ['deadly-d6']);
    expect([d.min, d.max]).toEqual([7, 18]);
    expect(d.mean).toBeCloseTo(9 + 3.5);
  });
  it('fatal swaps the weapon die and adds one fatal die after doubling', () => {
    const d = criticalDistribution('1d8+4', ['fatal-d10']);
    // 2*(1d10+4) + 1d10 → min 2*5+1=11, max 2*14+10=38
    expect([d.min, d.max]).toEqual([11, 38]);
  });
  it('describes the model', () => {
    expect(describeCritModel('1d8+4', [])).toBe(
      'Critical damage is modeled as simple double damage of the supported formula total.'
    );
    expect(describeCritModel('1d8+4', ['deadly-d10'])).toContain('deadly d10');
  });
});
