import { describe, expect, it } from 'vitest';
import { attackOutcomeProbabilities } from '../src/engine/attack-probability';
import { damageDistribution } from '../src/engine/dice';
import {
  applyDamageAdjustment,
  buildDamageAdjustmentSummary
} from '../src/engine/mortality';
import { createRng } from '../src/engine/prng';
import { sampleStrike, type StrikeSampleInput } from '../src/engine/sample-strike';

const baseInput: StrikeSampleInput = {
  attackerId: 'enemy-1',
  defenderId: 'pc-1',
  attackId: 'claw',
  attackName: 'Claw',
  attackBonus: 10,
  mapPenalty: 0,
  defenderAc: 20,
  damageFormula: '1d8+4'
};

describe('sampleStrike determinism', () => {
  it('produces identical results for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i += 1) {
      expect(sampleStrike(baseInput, a)).toEqual(sampleStrike(baseInput, b));
    }
  });

  it('produces diverging results for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    let differences = 0;
    for (let i = 0; i < 100; i += 1) {
      const ra = sampleStrike(baseInput, a);
      const rb = sampleStrike(baseInput, b);
      if (ra.dieRoll !== rb.dieRoll || ra.damage !== rb.damage) differences += 1;
    }
    expect(differences).toBeGreaterThan(50);
  });
});

describe('sampleStrike degree distribution', () => {
  it('matches analytic outcome probabilities over many samples', () => {
    const analytic = attackOutcomeProbabilities({ attackBonus: 10, ac: 20 });
    const rng = createRng('convergence-degree');
    const counts = { criticalSuccess: 0, success: 0, failure: 0, criticalFailure: 0 };
    const samples = 20000;
    for (let i = 0; i < samples; i += 1) {
      counts[sampleStrike(baseInput, rng).degree] += 1;
    }
    const tolerance = 0.015;
    expect(counts.criticalSuccess / samples).toBeCloseTo(analytic.criticalSuccess, tolerance);
    expect(counts.success / samples).toBeCloseTo(analytic.success, tolerance);
    expect(counts.failure / samples).toBeCloseTo(analytic.failure, tolerance);
    expect(counts.criticalFailure / samples).toBeCloseTo(analytic.criticalFailure, tolerance);
  });
});

describe('sampleStrike damage values', () => {
  it('damage is 0 on miss / critical failure', () => {
    const rng = createRng('miss-test');
    const lowAttackInput: StrikeSampleInput = { ...baseInput, attackBonus: -50 };
    for (let i = 0; i < 200; i += 1) {
      const result = sampleStrike(lowAttackInput, rng);
      if (result.degree === 'failure' || result.degree === 'criticalFailure') {
        expect(result.damage).toBe(0);
      }
    }
  });

  it('crit damage averages roughly twice normal damage over many samples', () => {
    // High attack bonus pushes most outcomes to success/crit so both branches
    // are well-sampled. We only assert ordering and rough doubling.
    const rng = createRng('crit-doubling');
    const highAttack: StrikeSampleInput = { ...baseInput, attackBonus: 25 };
    const samples = 20000;
    let normalSum = 0;
    let normalCount = 0;
    let critSum = 0;
    let critCount = 0;
    for (let i = 0; i < samples; i += 1) {
      const r = sampleStrike(highAttack, rng);
      if (r.degree === 'success') {
        normalSum += r.damage;
        normalCount += 1;
      } else if (r.degree === 'criticalSuccess') {
        critSum += r.damage;
        critCount += 1;
      }
    }
    expect(normalCount).toBeGreaterThan(1000);
    expect(critCount).toBeGreaterThan(1000);
    const normalMean = normalSum / normalCount;
    const critMean = critSum / critCount;
    expect(critMean / normalMean).toBeCloseTo(2, 0.1);
  });

  it('damage distribution on hits converges to the analytic PMF', () => {
    const rng = createRng('damage-pmf-converge');
    // baseInput (attackBonus +10 vs AC 20) gives ~50% non-crit hits, so 30k
    // samples produce ~15k normal-success rolls — plenty to converge against
    // the analytic 1d8+4 PMF.
    const analytic = damageDistribution('1d8+4');
    const counts = new Map<number, number>();
    let successCount = 0;
    const samples = 30000;
    for (let i = 0; i < samples; i += 1) {
      const r = sampleStrike(baseInput, rng);
      if (r.degree === 'success') {
        counts.set(r.damage, (counts.get(r.damage) ?? 0) + 1);
        successCount += 1;
      }
    }
    expect(successCount).toBeGreaterThan(5000);
    for (const outcome of analytic.outcomes) {
      const empirical = (counts.get(outcome.damage) ?? 0) / successCount;
      expect(empirical).toBeCloseTo(outcome.probability, 1);
    }
  });
});

describe('sampleStrike resistance, weakness, immunity', () => {
  it('applies resistance identically to the analytic adjustment', () => {
    const rng = createRng('resistance-convergence');
    // Use baseline attack bonus so 'success' (not 'criticalSuccess') is the
    // dominant hit branch and the normal-damage PMF is well-sampled.
    const input: StrikeSampleInput = {
      ...baseInput,
      damageType: 'slashing',
      defenderAdjustments: {
        resistances: [{ type: 'slashing', value: 3 }],
        weaknesses: [],
        immunities: []
      }
    };
    const analyticBase = damageDistribution('1d8+4');
    const summary = buildDamageAdjustmentSummary('slashing', input.defenderAdjustments);
    const analyticAdjusted = applyDamageAdjustment(analyticBase, summary);
    const counts = new Map<number, number>();
    let successCount = 0;
    const samples = 30000;
    for (let i = 0; i < samples; i += 1) {
      const r = sampleStrike(input, rng);
      if (r.degree === 'success') {
        counts.set(r.damage, (counts.get(r.damage) ?? 0) + 1);
        successCount += 1;
      }
    }
    expect(successCount).toBeGreaterThan(5000);
    for (const outcome of analyticAdjusted.outcomes) {
      const empirical = (counts.get(outcome.damage) ?? 0) / successCount;
      expect(empirical).toBeCloseTo(outcome.probability, 1);
    }
  });

  it('immunity drives sampled damage to 0', () => {
    const rng = createRng('immunity');
    const input: StrikeSampleInput = {
      ...baseInput,
      attackBonus: 30,
      damageType: 'fire',
      defenderAdjustments: {
        resistances: [],
        weaknesses: [],
        immunities: ['fire']
      }
    };
    for (let i = 0; i < 200; i += 1) {
      const r = sampleStrike(input, rng);
      expect(r.damage).toBe(0);
    }
  });

  it('weakness inflates sampled damage relative to base', () => {
    const baseAttack: StrikeSampleInput = { ...baseInput, attackBonus: 30 };
    const weakAttack: StrikeSampleInput = {
      ...baseAttack,
      damageType: 'cold',
      defenderAdjustments: {
        resistances: [],
        weaknesses: [{ type: 'cold', value: 5 }],
        immunities: []
      }
    };
    const baseRng = createRng('weakness-base');
    const weakRng = createRng('weakness-weak');
    let baseSum = 0;
    let weakSum = 0;
    for (let i = 0; i < 5000; i += 1) {
      baseSum += sampleStrike(baseAttack, baseRng).damage;
      weakSum += sampleStrike(weakAttack, weakRng).damage;
    }
    expect(weakSum).toBeGreaterThan(baseSum);
  });
});

describe('sampleStrike MAP', () => {
  it('a -5 MAP penalty reduces success share vs an unpenalized strike', () => {
    const inputA: StrikeSampleInput = { ...baseInput };
    const inputB: StrikeSampleInput = { ...baseInput, mapPenalty: -5 };
    const rngA = createRng('map-zero');
    const rngB = createRng('map-five');
    let hitsA = 0;
    let hitsB = 0;
    for (let i = 0; i < 5000; i += 1) {
      const a = sampleStrike(inputA, rngA);
      if (a.degree !== 'failure' && a.degree !== 'criticalFailure') hitsA += 1;
      const b = sampleStrike(inputB, rngB);
      if (b.degree !== 'failure' && b.degree !== 'criticalFailure') hitsB += 1;
    }
    expect(hitsA).toBeGreaterThan(hitsB);
  });
});
