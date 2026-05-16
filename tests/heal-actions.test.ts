import { describe, expect, it } from 'vitest';
import { applyHeal, sampleHealAction } from '../src/engine/heal-actions';
import { createRng } from '../src/engine/prng';
import type { SimulationCombatant } from '../src/engine/simulation-types';

function pc(overrides: Partial<SimulationCombatant> = {}): SimulationCombatant {
  return {
    id: 'pc-1',
    name: 'mira',
    side: 'pc',
    hp: { current: 10, max: 24, temp: 0 },
    defenses: { ac: 20 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    heroPointSurvivalUsed: false,
    downed: false,
    dead: false,
    initiativeBonus: 0,
    traits: [],
    attacks: [],
    ...overrides
  };
}

describe('sampleHealAction: Battle Medicine', () => {
  it('produces a non-zero heal on success degrees', () => {
    // Across 200 seeds with a high Medicine modifier, most are success.
    let successCount = 0;
    let totalHealed = 0;
    for (let s = 0; s < 200; s += 1) {
      const r = sampleHealAction(
        { kind: 'battle-medicine', medicineModifier: 20, medicineDC: 15 },
        createRng(s)
      );
      if (r.degree === 'success' || r.degree === 'criticalSuccess') {
        successCount += 1;
        totalHealed += r.healedAmount;
      }
    }
    expect(successCount).toBeGreaterThan(150);
    expect(totalHealed / successCount).toBeGreaterThan(8); // success mean is 2d8+4 ~= 13
  });

  it('emits collateral damage on crit-failure', () => {
    let found = false;
    for (let s = 0; s < 200; s += 1) {
      const r = sampleHealAction(
        { kind: 'battle-medicine', medicineModifier: -50, medicineDC: 50 },
        createRng(s)
      );
      if (r.degree === 'criticalFailure') {
        expect(r.healedAmount).toBe(0);
        expect(r.collateralDamage).toBeGreaterThanOrEqual(1);
        expect(r.collateralDamage).toBeLessThanOrEqual(8);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = sampleHealAction({ kind: 'battle-medicine', medicineModifier: 5, medicineDC: 15 }, createRng('det'));
    const b = sampleHealAction({ kind: 'battle-medicine', medicineModifier: 5, medicineDC: 15 }, createRng('det'));
    expect(a).toEqual(b);
  });
});

describe('sampleHealAction: Heal spell variants', () => {
  it('1-action heals 1d10', () => {
    const rng = createRng('1a');
    for (let i = 0; i < 50; i += 1) {
      const r = sampleHealAction({ kind: 'heal-spell-1action' }, rng);
      expect(r.healedAmount).toBeGreaterThanOrEqual(1);
      expect(r.healedAmount).toBeLessThanOrEqual(10);
    }
  });

  it('2-action heals 1d8+8 per rank (rank 1)', () => {
    const rng = createRng('2a');
    let total = 0;
    for (let i = 0; i < 200; i += 1) {
      const r = sampleHealAction({ kind: 'heal-spell-2action', spellRank: 1 }, rng);
      expect(r.healedAmount).toBeGreaterThanOrEqual(9);
      expect(r.healedAmount).toBeLessThanOrEqual(16);
      total += r.healedAmount;
    }
    expect(total / 200).toBeCloseTo(12.5, 0); // (1+8) to (8+8) = avg 12.5
  });

  it('2-action scales with rank', () => {
    let r1Sum = 0;
    let r5Sum = 0;
    for (let i = 0; i < 100; i += 1) {
      r1Sum += sampleHealAction({ kind: 'heal-spell-2action', spellRank: 1 }, createRng(`rank1-${i}`)).healedAmount;
      r5Sum += sampleHealAction({ kind: 'heal-spell-2action', spellRank: 5 }, createRng(`rank5-${i}`)).healedAmount;
    }
    expect(r5Sum).toBeGreaterThan(r1Sum * 3);
  });

  it('cantrip 2-action scales with healer level', () => {
    const level1 = sampleHealAction({ kind: 'heal-cantrip-2action', healerLevel: 1 }, createRng('cant1'));
    const level10 = sampleHealAction({ kind: 'heal-cantrip-2action', healerLevel: 10 }, createRng('cant10'));
    // Level 1: 2d8 (max 16), Level 10: 1 + ceil(10/2) = 6, so 6d8 (max 48)
    expect(level10.healedAmount).toBeGreaterThan(level1.healedAmount);
  });
});

describe('applyHeal', () => {
  it('restores HP up to max', () => {
    const result = applyHeal(pc({ hp: { current: 5, max: 24, temp: 0 } }), 10);
    expect(result.hp.current).toBe(15);
  });

  it('does not exceed max HP', () => {
    const result = applyHeal(pc({ hp: { current: 20, max: 24, temp: 0 } }), 100);
    expect(result.hp.current).toBe(24);
  });

  it('clears dying when clearsDying option is true and heal > 0', () => {
    const target = pc({ hp: { current: 0, max: 24, temp: 0 }, dying: 2, downed: true });
    const result = applyHeal(target, 5, { clearsDying: true });
    expect(result.dying).toBe(0);
    expect(result.downed).toBe(false);
    expect(result.hp.current).toBe(5);
  });

  it('does not modify combatant when heal is 0 and clearsDying is false', () => {
    const target = pc();
    expect(applyHeal(target, 0)).toBe(target);
  });

  it('does not affect dying when clearsDying option is omitted', () => {
    const target = pc({ hp: { current: 0, max: 24, temp: 0 }, dying: 2 });
    const result = applyHeal(target, 5);
    expect(result.dying).toBe(2);
    expect(result.hp.current).toBe(5);
  });
});
