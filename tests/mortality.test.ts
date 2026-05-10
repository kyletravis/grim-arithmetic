import { describe, expect, it } from 'vitest';
import { immediateDownRisk } from '../src/engine/mortality';

describe('immediateDownRisk', () => {
  it('returns zero down probability when average hit and crit cannot down target', () => {
    const result = immediateDownRisk({
      hp: 30,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+2',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.downProbability).toBe(0);
    expect(result.assumptions).toContain('Uses average damage, not full dice distribution.');
  });

  it('returns crit chance as down probability when only crit average damage downs target', () => {
    const result = immediateDownRisk({
      hp: 12,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+2',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.downProbability).toBeGreaterThan(0);
    expect(result.topRiskDrivers[0]).toContain('crit');
  });

  it('supports three strike MAP sequences', () => {
    const result = immediateDownRisk({
      hp: 20,
      ac: 20,
      attackBonus: 12,
      damageFormula: '1d8+6',
      strikes: 3,
      mapType: 'normal'
    });

    expect(result.hitChanceByStrike).toHaveLength(3);
    expect(result.critChanceByStrike).toHaveLength(3);
  });
});
