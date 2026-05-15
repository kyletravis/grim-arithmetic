import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ITERATIONS,
  DEFAULT_MAX_ROUNDS,
  MAX_ITERATIONS,
  type EncounterSetup,
  type IterationResult,
  type SimulationCombatant,
  type SimulationConfig,
  type SimulationResult,
  type TacticsProfileId
} from '../src/engine/simulation-types';

describe('simulation-types constants', () => {
  it('exposes default iteration count', () => {
    expect(DEFAULT_ITERATIONS).toBe(5000);
  });

  it('exposes the engine-level iteration cap', () => {
    expect(MAX_ITERATIONS).toBe(10000);
  });

  it('exposes a default max rounds for runaway protection', () => {
    expect(DEFAULT_MAX_ROUNDS).toBeGreaterThan(0);
  });
});

describe('simulation-types shapes', () => {
  it('SimulationCombatant accepts a minimal PC shape', () => {
    const combatant: SimulationCombatant = {
      id: 'pc-1',
      name: 'Mira',
      side: 'pc',
      hp: { current: 24, max: 24, temp: 0 },
      defenses: { ac: 21 },
      dying: 0,
      wounded: 0,
      doomed: 0,
      heroPoints: 1,
      downed: false,
      dead: false,
      initiativeBonus: 6,
      traits: ['human'],
      attacks: []
    };
    expect(combatant.side).toBe('pc');
  });

  it('SimulationCombatant accepts a minimal enemy shape with attacks', () => {
    const combatant: SimulationCombatant = {
      id: 'enemy-1',
      name: 'Troll Mauler',
      side: 'enemy',
      hp: { current: 60, max: 60, temp: 0 },
      defenses: { ac: 19 },
      dying: 0,
      wounded: 0,
      doomed: 0,
      heroPoints: 0,
      downed: false,
      dead: false,
      initiativeBonus: 4,
      traits: ['troll'],
      attacks: [
        {
          id: 'claw',
          name: 'Claw',
          attackBonus: 13,
          damageFormula: '1d8+5',
          damageType: 'slashing',
          traits: [],
          mapType: 'normal',
          assumptions: []
        }
      ]
    };
    expect(combatant.attacks).toHaveLength(1);
  });

  it('EncounterSetup composes PCs and enemies with caveats', () => {
    const setup: EncounterSetup = {
      pcs: [],
      enemies: [],
      caveats: ['no participants']
    };
    expect(setup.caveats).toEqual(['no participants']);
  });

  it('SimulationConfig accepts the documented profile ids', () => {
    const profiles: TacticsProfileId[] = [
      'random-legal',
      'spread-damage',
      'focus-fire',
      'predator',
      'boss-cinematic'
    ];
    for (const profile of profiles) {
      const config: SimulationConfig = {
        iterations: 1000,
        tacticsProfile: profile,
        maxRounds: DEFAULT_MAX_ROUNDS
      };
      expect(config.tacticsProfile).toBe(profile);
    }
  });

  it('IterationResult requires per-pair damage attribution', () => {
    const result: IterationResult = {
      iterationIndex: 0,
      roundsElapsed: 3,
      firstDownRound: 2,
      tpk: false,
      perCombatant: [],
      damageByPair: { 'enemy-1->pc-1': 8 }
    };
    expect(result.damageByPair['enemy-1->pc-1']).toBe(8);
  });

  it('SimulationResult aggregates the headline metrics', () => {
    const result: SimulationResult = {
      iterationsRequested: 1000,
      iterationsCompleted: 1000,
      seed: 'campaign-7',
      tacticsProfile: 'focus-fire',
      aborted: false,
      anyPcDownProbability: 0.62,
      tpkProbability: 0.11,
      meanFirstDownRound: 2.4,
      medianFirstDownRound: 2,
      perPc: [],
      perEnemy: [],
      caveats: []
    };
    expect(result.aborted).toBe(false);
  });
});
