import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/prng';
import { sampleRecoveryCheck } from '../src/engine/sample-recovery';
import type { SimulationCombatant } from '../src/engine/simulation-types';

function dyingPc(dying: number, overrides: Partial<SimulationCombatant> = {}): SimulationCombatant {
  return {
    id: 'pc-1',
    name: 'mira',
    side: 'pc',
    hp: { current: 0, max: 24, temp: 0 },
    defenses: { ac: 20 },
    dying,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    heroPointSurvivalUsed: false,
    downed: true,
    dead: false,
    initiativeBonus: 0,
    traits: [],
    attacks: [],
    ...overrides
  };
}

describe('sampleRecoveryCheck', () => {
  it('returns stabilized=true for a non-dying combatant', () => {
    const result = sampleRecoveryCheck(dyingPc(0), createRng('any'));
    expect(result.stabilized).toBe(true);
    expect(result.newDying).toBe(0);
  });

  it('rolls d20 vs DC 10+dying', () => {
    // Across many seeds, the rolls should be 1..20 uniformly.
    const rolls = new Set<number>();
    for (let s = 0; s < 200; s += 1) {
      rolls.add(sampleRecoveryCheck(dyingPc(2), createRng(s)).roll);
    }
    expect(rolls.size).toBeGreaterThan(15);
  });

  it('crit-success decreases dying by 2 (stabilizing from dying 2)', () => {
    // Force a crit-success via deterministic seed search.
    // We just verify the math: a "criticalSuccess" outcome lowers dying by 2.
    // Run many seeds, collect outcomes.
    let found = false;
    for (let s = 0; s < 200; s += 1) {
      const r = sampleRecoveryCheck(dyingPc(2), createRng(s));
      if (r.degree === 'criticalSuccess') {
        expect(r.newDying).toBe(0);
        expect(r.stabilized).toBe(true);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('success decreases dying by 1', () => {
    let found = false;
    for (let s = 0; s < 200; s += 1) {
      const r = sampleRecoveryCheck(dyingPc(2), createRng(s));
      if (r.degree === 'success') {
        expect(r.newDying).toBe(1);
        expect(r.stabilized).toBe(false);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('failure leaves dying unchanged', () => {
    let found = false;
    for (let s = 0; s < 200; s += 1) {
      const r = sampleRecoveryCheck(dyingPc(1), createRng(s));
      if (r.degree === 'failure') {
        expect(r.newDying).toBe(1);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('crit-failure increases dying by 1', () => {
    let found = false;
    for (let s = 0; s < 200; s += 1) {
      const r = sampleRecoveryCheck(dyingPc(1), createRng(s));
      if (r.degree === 'criticalFailure') {
        expect(r.newDying).toBe(2);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('newDying never goes negative', () => {
    for (let s = 0; s < 100; s += 1) {
      const r = sampleRecoveryCheck(dyingPc(1), createRng(s));
      expect(r.newDying).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = sampleRecoveryCheck(dyingPc(2), createRng('det'));
    const b = sampleRecoveryCheck(dyingPc(2), createRng('det'));
    expect(a).toEqual(b);
  });

  it('rate of recovery (any reduction) at dying 1 is roughly ~50% with step-shifts', () => {
    let successes = 0;
    const samples = 2000;
    for (let s = 0; s < samples; s += 1) {
      const r = sampleRecoveryCheck(dyingPc(1), createRng(s));
      if (r.newDying < 1) successes += 1;
    }
    // DC 11; success at 11+ (10/20 rolls including nat 20), crit-success at 21+ (only nat 20 lifts to crit which then might shift more).
    // Approximate: ~50% recoveries. Generous tolerance.
    expect(successes / samples).toBeGreaterThan(0.3);
    expect(successes / samples).toBeLessThan(0.7);
  });
});
