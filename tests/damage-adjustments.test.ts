import { describe, expect, it } from 'vitest';
import { immediateDownRisk } from '../src/engine/mortality';

describe('v0.4.0 damage adjustments', () => {
  it('applies matching resistance to exact normal and crit damage distributions', () => {
    const result = immediateDownRisk({
      hp: 7,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d4+2',
      strikes: 1,
      mapType: 'normal',
      damageType: 'fire',
      targetAdjustments: {
        resistances: [{ type: 'fire', value: 3 }],
        weaknesses: [],
        immunities: []
      }
    });

    expect(result.damage).toMatchObject({ min: 0, max: 3, average: '1.5', critMin: 3, critMax: 9 });
    expect(result.downProbability).toBeCloseTo(0.025);
    expect(result.damageAdjustment).toMatchObject({
      damageType: 'fire',
      resistance: 3,
      weakness: 0,
      immune: false,
      note: 'Applied fire resistance 3.'
    });
  });

  it('applies matching weakness after resistance and minimum-zero damage', () => {
    const result = immediateDownRisk({
      hp: 7,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d4+2',
      strikes: 1,
      mapType: 'normal',
      damageType: 'cold',
      targetAdjustments: {
        resistances: [{ type: 'cold', value: 10 }],
        weaknesses: [{ type: 'cold', value: 5 }],
        immunities: []
      }
    });

    expect(result.damage).toMatchObject({ min: 5, max: 5, average: '5.0', critMin: 5, critMax: 7 });
    expect(result.damageAdjustment.note).toBe('Applied cold resistance 10 and cold weakness 5.');
  });

  it('sets matching immune damage to zero and never silently adjusts unknown damage types', () => {
    const immune = immediateDownRisk({
      hp: 1,
      ac: 20,
      attackBonus: 30,
      damageFormula: '1d4+2',
      strikes: 1,
      mapType: 'normal',
      damageType: 'poison',
      targetAdjustments: {
        resistances: [],
        weaknesses: [{ type: 'poison', value: 5 }],
        immunities: ['poison']
      }
    });

    expect(immune.downProbability).toBe(0);
    expect(immune.damage).toMatchObject({ min: 0, max: 0, average: '0.0', critMin: 0, critMax: 0 });
    expect(immune.damageAdjustment.note).toBe('Applied poison immunity; modeled damage is 0.');

    const unknown = immediateDownRisk({
      hp: 7,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d4+2',
      strikes: 1,
      mapType: 'normal',
      targetAdjustments: {
        resistances: [{ type: 'fire', value: 3 }],
        weaknesses: [{ type: 'fire', value: 5 }],
        immunities: ['fire']
      }
    });

    expect(unknown.damageAdjustment).toMatchObject({
      damageType: 'unknown',
      resistance: 0,
      weakness: 0,
      immune: false,
      note: 'Damage type unknown; no resistance, weakness, or immunity applied.'
    });
    expect(unknown.damage).toMatchObject({ min: 3, max: 6, average: '4.5', critMin: 6, critMax: 12 });
  });
});
