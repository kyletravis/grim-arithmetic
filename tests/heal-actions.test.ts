import { describe, expect, it } from 'vitest';
import {
  applyHeal,
  battleMedicineBonusFor,
  sampleHealAction,
  selectBattleMedicineDc
} from '../src/engine/heal-actions';
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

describe('Battle Medicine (Treat Wounds table)', () => {
  it('selectBattleMedicineDc picks the highest allowed DC hit on >= 50% of rolls', () => {
    expect(selectBattleMedicineDc(1, 8)).toBe(15); // trained: only DC 15 allowed
    expect(selectBattleMedicineDc(2, 10)).toBe(20); // 20-10=10 <= 11
    expect(selectBattleMedicineDc(2, 5)).toBe(15); // 20-5=15 > 11 -> fall back
    expect(selectBattleMedicineDc(3, 15)).toBe(20); // 30-15=15 > 11
    expect(selectBattleMedicineDc(3, 19)).toBe(30);
    expect(selectBattleMedicineDc(4, 29)).toBe(40);
    expect(selectBattleMedicineDc(undefined, undefined)).toBe(15);
  });

  it('bonus by DC', () => {
    expect([15, 20, 30, 40].map(battleMedicineBonusFor)).toEqual([0, 10, 30, 50]);
  });

  it('success heals 2d8+bonus, crit 4d8+bonus, crit-fail deals 1d8', () => {
    const seen = { success: [] as number[], crit: [] as number[] };
    for (let s = 0; s < 400; s += 1) {
      const r = sampleHealAction(
        { kind: 'battle-medicine', medicineModifier: 20, medicineDC: 20 },
        createRng(s)
      );
      if (r.degree === 'success') seen.success.push(r.healedAmount);
      if (r.degree === 'criticalSuccess') seen.crit.push(r.healedAmount);
    }
    expect(Math.min(...seen.success)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...seen.success)).toBeLessThanOrEqual(26);
    expect(Math.min(...seen.crit)).toBeGreaterThanOrEqual(14);
    expect(Math.max(...seen.crit)).toBeLessThanOrEqual(42);
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
    const a = sampleHealAction(
      { kind: 'battle-medicine', medicineModifier: 5, medicineDC: 15 },
      createRng('det')
    );
    const b = sampleHealAction(
      { kind: 'battle-medicine', medicineModifier: 5, medicineDC: 15 },
      createRng('det')
    );
    expect(a).toEqual(b);
  });
});

describe('Heal spell', () => {
  it('1-action heals rank d8', () => {
    const values = new Set<number>();
    for (let s = 0; s < 300; s += 1) {
      values.add(
        sampleHealAction({ kind: 'heal-spell-1action', spellRank: 3 }, createRng(s)).healedAmount
      );
    }
    expect(Math.min(...values)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...values)).toBeLessThanOrEqual(24);
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
      r1Sum += sampleHealAction(
        { kind: 'heal-spell-2action', spellRank: 1 },
        createRng(`rank1-${i}`)
      ).healedAmount;
      r5Sum += sampleHealAction(
        { kind: 'heal-spell-2action', spellRank: 5 },
        createRng(`rank5-${i}`)
      ).healedAmount;
    }
    expect(r5Sum).toBeGreaterThan(r1Sum * 3);
  });
});

describe('applyHeal (PF2e dying rules)', () => {
  it('restores HP up to max', () => {
    const result = applyHeal(pc({ hp: { current: 5, max: 24, temp: 0 } }), 10);
    expect(result.hp.current).toBe(15);
  });

  it('does not exceed max HP', () => {
    const result = applyHeal(pc({ hp: { current: 20, max: 24, temp: 0 } }), 100);
    expect(result.hp.current).toBe(24);
  });

  it('any heal to >= 1 HP clears dying, wakes the PC, and adds wounded', () => {
    const healed = applyHeal(
      pc({ hp: { current: 0, max: 24, temp: 0 }, dying: 2, downed: true, wounded: 0 }),
      5
    );
    expect(healed).toMatchObject({ hp: { current: 5 }, dying: 0, downed: false, wounded: 1 });
  });

  it('a hero-point-stabilized PC (dying 0, downed) wakes without extra wounded', () => {
    const healed = applyHeal(
      pc({ hp: { current: 0, max: 24, temp: 0 }, dying: 0, downed: true, wounded: 1 }),
      3
    );
    expect(healed).toMatchObject({ dying: 0, downed: false, wounded: 1 });
  });

  it('zero heal is a no-op', () => {
    const target = pc({ dying: 1, downed: true, hp: { current: 0, max: 24, temp: 0 } });
    expect(applyHeal(target, 0)).toBe(target);
  });
});
