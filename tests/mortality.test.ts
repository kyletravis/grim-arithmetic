import { describe, expect, it } from 'vitest';
import { immediateDownRisk } from '../src/engine/mortality';

describe('immediateDownRisk', () => {
  it('returns zero down probability when no exact damage roll can down target', () => {
    const result = immediateDownRisk({
      hp: 30,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+2',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.downProbability).toBe(0);
    expect(result.assumptions).toContain('Uses exact damage distributions for supported formulas.');
  });

  it('uses exact crit damage distribution instead of average crit thresholds', () => {
    const result = immediateDownRisk({
      hp: 7,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d4+2',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.downProbability).toBeCloseTo(0.0375);
    expect(result.damage).toMatchObject({ min: 3, max: 6, average: '4.5', critMin: 6, critMax: 12 });
    expect(result.topRiskDrivers[0]).toContain('Only some crit damage rolls can down the PC');
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

  it('counts cumulative exact damage rolls that down the target across multiple strikes', () => {
    const result = immediateDownRisk({
      hp: 10,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d4+2',
      strikes: 2,
      mapType: 'none'
    });

    expect(result.downProbability).toBeCloseTo(0.165625);
  });

  it('reports exact distribution summary and swinginess for supported formulas', () => {
    const result = immediateDownRisk({
      hp: 12,
      ac: 20,
      attackBonus: 10,
      damageFormula: '2d6+4',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.damage).toEqual({
      min: 6,
      max: 16,
      average: '11.0',
      critMin: 12,
      critMax: 32,
      swinginess: 'High swing: damage range is 11 around an average of 11.0.'
    });
  });

  it.each([
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5]
  ])('reports wounded %i dying severity for normal and critical downing hits', (wounded, normalDying, critDying) => {
    const result = immediateDownRisk({
      hp: 7,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d4+2',
      strikes: 1,
      mapType: 'normal',
      wounded,
      doomed: 0,
      assumeHeroPointAvailable: false
    });

    expect(result.dyingSeverity).toMatchObject({
      wounded,
      doomed: 0,
      deathThreshold: 4,
      normalDownDying: normalDying,
      critDownDying: critDying
    });
  });

  it('flags crit-downs that reach the doomed-adjusted death threshold', () => {
    const result = immediateDownRisk({
      hp: 10,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+6',
      strikes: 1,
      mapType: 'normal',
      wounded: 1,
      doomed: 1,
      assumeHeroPointAvailable: false
    });

    expect(result.dyingSeverity.deathThreshold).toBe(3);
    expect(result.dyingSeverity.immediateDeathFlag).toContain('Crit-down would reach Dying 3');
    expect(result.dyingSeverity.immediateDeathFlag).toContain('doomed-adjusted death threshold');
  });

  it('caveats Hero Point death prevention without turning it into permanent death probability', () => {
    const result = immediateDownRisk({
      hp: 10,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+6',
      strikes: 1,
      mapType: 'normal',
      wounded: 2,
      doomed: 0,
      assumeHeroPointAvailable: true
    });

    expect(result.dyingSeverity.heroPointNote).toContain('Hero Point prevention is assumed available');
    expect(result.notModeled).toContain('Permanent death probability.');
  });
});
