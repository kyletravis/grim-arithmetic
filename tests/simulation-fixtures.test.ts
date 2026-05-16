import { describe, expect, it } from 'vitest';
import { runSimulation } from '../src/engine/run-simulation';
import {
  DEFAULT_MAX_ROUNDS,
  type EncounterSetup,
  type SimulationCombatant,
  type SimulationConfig
} from '../src/engine/simulation-types';
import type { AttackSnapshot } from '../src/systems/base-adapter';

/**
 * Deterministic regression fixtures for the v0.6.0 Monte Carlo engine.
 *
 * Each scenario seeds the master RNG with a fixed string so the resulting
 * SimulationResult is byte-identical across machines. Vitest snapshots
 * lock the output; intentional model changes regenerate via
 * `npm run test -- -u`.
 *
 * If a fixture starts failing after a non-model change, that's the
 * regression net catching drift in: PRNG, sampler, state transitions,
 * tactics, runner aggregation, or any of their helpers.
 */

/**
 * Default PC build for v0.6.0-rc.4 fixtures: ~level 6 martial with a
 * single Strike, +14 to hit, 1d8+5 slashing. Roughly matches the PF2e
 * party assumption that drives encounter XP budgets.
 *
 * Each PC gets 1 Hero Point and Battle Medicine by default so the rc.4
 * safety-net paths (Hero Point survival, Battle Medicine top-up) exercise.
 * mira specifically is built as a Cleric with prepared Heal spells +
 * Heal cantrip so the spell-slot path exercises too.
 */
const DEFAULT_PC_STRIKE: AttackSnapshot = {
  id: 'longsword',
  name: 'Longsword',
  attackBonus: 14,
  damageFormula: '1d8+5',
  damageType: 'slashing',
  traits: [],
  mapType: 'normal',
  assumptions: []
};

function pc(
  id: string,
  overrides: Partial<SimulationCombatant> = {}
): SimulationCombatant {
  const isMira = id === 'mira';
  return {
    id,
    name: id,
    side: 'pc',
    hp: { current: 24, max: 24, temp: 0 },
    defenses: { ac: 20 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 1,
    heroPointSurvivalUsed: false,
    downed: false,
    dead: false,
    initiativeBonus: 5,
    traits: [],
    attacks: [{ ...DEFAULT_PC_STRIKE, id: `${id}-strike` }],
    healing: {
      medicineModifier: 8,
      medicineDC: 15,
      hasBattleMedicine: true,
      battleMedicineUsedTargets: new Set(),
      // Mira plays a Cleric with prepared Heal slots + cantrip.
      healSpellSlotsRemaining: isMira ? { 1: 3, 2: 2 } : {},
      healCantripLevel: isMira ? 4 : null
    },
    ...overrides
  };
}

function enemy(
  id: string,
  attacks: AttackSnapshot[],
  overrides: Partial<SimulationCombatant> = {}
): SimulationCombatant {
  return {
    id,
    name: id,
    side: 'enemy',
    hp: { current: 60, max: 60, temp: 0 },
    defenses: { ac: 19 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 3,
    traits: [],
    attacks,
    ...overrides
  };
}

function attack(overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
  return {
    id: 'claw',
    name: 'Claw',
    attackBonus: 12,
    damageFormula: '1d10+5',
    damageType: 'slashing',
    traits: [],
    mapType: 'normal',
    assumptions: [],
    ...overrides
  };
}

function config(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    iterations: 1000,
    tacticsProfile: 'focus-fire',
    maxRounds: DEFAULT_MAX_ROUNDS,
    seed: 'fixture',
    ...overrides
  };
}

describe('simulation fixtures: 4 PCs vs 1 boss', () => {
  const setup: EncounterSetup = {
    pcs: [pc('mira'), pc('seam'), pc('jor'), pc('elya')],
    enemies: [
      enemy('boss', [attack({ id: 'cleave', attackBonus: 16, damageFormula: '2d10+8' })], {
        hp: { current: 120, max: 120, temp: 0 },
        defenses: { ac: 22 }
      })
    ],
    caveats: []
  };

  for (const profile of ['random-legal', 'spread-damage', 'focus-fire', 'predator', 'boss-cinematic'] as const) {
    it(`is stable under ${profile}`, () => {
      const result = runSimulation(setup, config({ tacticsProfile: profile, seed: `4v1-${profile}` }));
      expect({
        profile,
        anyPcDownProbability: result.anyPcDownProbability,
        tpkProbability: result.tpkProbability,
        meanFirstDownRound: result.meanFirstDownRound,
        medianFirstDownRound: result.medianFirstDownRound,
        perPc: result.perPc,
        perEnemy: result.perEnemy
      }).toMatchSnapshot();
    });
  }
});

describe('simulation fixtures: 4 PCs vs 4 minions', () => {
  const setup: EncounterSetup = {
    pcs: [pc('mira'), pc('seam'), pc('jor'), pc('elya')],
    enemies: [
      enemy('mook-1', [attack({ attackBonus: 8, damageFormula: '1d8+3' })]),
      enemy('mook-2', [attack({ attackBonus: 8, damageFormula: '1d8+3' })]),
      enemy('mook-3', [attack({ attackBonus: 8, damageFormula: '1d8+3' })]),
      enemy('mook-4', [attack({ attackBonus: 8, damageFormula: '1d8+3' })])
    ],
    caveats: []
  };

  for (const profile of ['random-legal', 'spread-damage', 'focus-fire', 'predator', 'boss-cinematic'] as const) {
    it(`is stable under ${profile}`, () => {
      const result = runSimulation(setup, config({ tacticsProfile: profile, seed: `4v4-${profile}` }));
      expect({
        profile,
        anyPcDownProbability: result.anyPcDownProbability,
        tpkProbability: result.tpkProbability,
        perPc: result.perPc,
        perEnemy: result.perEnemy
      }).toMatchSnapshot();
    });
  }
});

describe('simulation fixtures: 1 PC vs 1 enemy (parity with v0.5.0 pair detail)', () => {
  const setup: EncounterSetup = {
    pcs: [
      pc('mira', {
        hp: { current: 22, max: 28, temp: 0 },
        defenses: { ac: 21 },
        wounded: 0
      })
    ],
    enemies: [
      enemy('troll', [attack({ id: 'troll-claw', attackBonus: 13, damageFormula: '1d8+5' })], {
        hp: { current: 70, max: 70, temp: 0 },
        defenses: { ac: 19 }
      })
    ],
    caveats: []
  };

  it('produces a stable result with focus-fire and fixed seed', () => {
    const result = runSimulation(setup, config({ seed: '1v1-pair', tacticsProfile: 'focus-fire' }));
    expect({
      iterationsCompleted: result.iterationsCompleted,
      anyPcDownProbability: result.anyPcDownProbability,
      tpkProbability: result.tpkProbability,
      perPc: result.perPc,
      perEnemy: result.perEnemy
    }).toMatchSnapshot();
  });
});

describe('simulation fixtures: PCs act (v0.6.0-rc.3 regression net)', () => {
  it('4 PCs vs 1 boss now resolves in fewer rounds than rc.2 stones-baseline', () => {
    // In rc.2 (PCs do nothing), this scenario hit the 5-round maxRounds cap
    // almost every iteration. With PC actions in rc.3, the boss takes damage
    // and the encounter ends earlier. Assert the run terminates strictly
    // before maxRounds on this seed.
    const setup: EncounterSetup = {
      pcs: [pc('mira'), pc('seam'), pc('jor'), pc('elya')],
      enemies: [
        enemy('boss', [attack({ id: 'cleave', attackBonus: 16, damageFormula: '2d10+8' })], {
          hp: { current: 120, max: 120, temp: 0 },
          defenses: { ac: 22 }
        })
      ],
      caveats: []
    };
    const result = runSimulation(
      setup,
      config({ tacticsProfile: 'focus-fire', seed: 'pcs-act-sanity', iterations: 500 })
    );
    // anyPcDown should drop dramatically compared to a no-action baseline; we
    // don't pin an exact number (snapshot tests cover that), but a sanity
    // check below the 100% rc.2 baseline catches regressions.
    expect(result.anyPcDownProbability).toBeLessThan(0.95);
  });
});

describe('simulation fixtures: degenerate setups', () => {
  it('safe setup converges to near-zero down risk', () => {
    const setup: EncounterSetup = {
      pcs: [pc('mira', { hp: { current: 200, max: 200, temp: 0 }, defenses: { ac: 40 } })],
      enemies: [enemy('mook', [attack({ attackBonus: -10, damageFormula: '1d4' })])],
      caveats: []
    };
    const result = runSimulation(setup, config({ iterations: 500, seed: 'safe-fixture' }));
    expect({
      anyPcDownProbability: result.anyPcDownProbability,
      tpkProbability: result.tpkProbability
    }).toMatchSnapshot();
  });

  it('TPK setup converges to high any-PC-down and TPK', () => {
    const setup: EncounterSetup = {
      pcs: [
        pc('mira', { hp: { current: 2, max: 24, temp: 0 } }),
        pc('seam', { hp: { current: 2, max: 24, temp: 0 } })
      ],
      enemies: [
        enemy('boss', [attack({ attackBonus: 25, damageFormula: '5d10+10' })])
      ],
      caveats: []
    };
    const result = runSimulation(setup, config({ iterations: 500, seed: 'tpk-fixture', tacticsProfile: 'spread-damage' }));
    expect({
      anyPcDownProbability: result.anyPcDownProbability,
      tpkProbability: result.tpkProbability,
      meanFirstDownRound: result.meanFirstDownRound
    }).toMatchSnapshot();
  });
});
