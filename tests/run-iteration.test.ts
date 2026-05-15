import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/prng';
import { runIteration } from '../src/engine/run-iteration';
import type {
  EncounterSetup,
  SimulationCombatant,
  SimulationConfig
} from '../src/engine/simulation-types';
import { DEFAULT_MAX_ROUNDS } from '../src/engine/simulation-types';
import type { AttackSnapshot } from '../src/systems/base-adapter';

function makePc(id: string, overrides: Partial<SimulationCombatant> = {}): SimulationCombatant {
  return {
    id,
    name: id,
    side: 'pc',
    hp: { current: 22, max: 24, temp: 0 },
    defenses: { ac: 20 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 6,
    traits: [],
    attacks: [],
    ...overrides
  };
}

function makeEnemy(
  id: string,
  attacks: AttackSnapshot[],
  overrides: Partial<SimulationCombatant> = {}
): SimulationCombatant {
  return {
    id,
    name: id,
    side: 'enemy',
    hp: { current: 40, max: 40, temp: 0 },
    defenses: { ac: 19 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 4,
    traits: [],
    attacks,
    ...overrides
  };
}

function makeAttack(overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
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

function makeSetup(overrides: Partial<EncounterSetup> = {}): EncounterSetup {
  return {
    pcs: [makePc('mira'), makePc('seam')],
    enemies: [makeEnemy('boss', [makeAttack()])],
    caveats: [],
    ...overrides
  };
}

function makeConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    iterations: 1000,
    tacticsProfile: 'focus-fire',
    maxRounds: DEFAULT_MAX_ROUNDS,
    seed: 'iteration-test',
    ...overrides
  };
}

describe('runIteration determinism', () => {
  it('same setup + same config + same seed yields byte-identical result', () => {
    const setup = makeSetup();
    const config = makeConfig();
    const a = runIteration(setup, config, createRng('determinism-1'), 0);
    const b = runIteration(setup, config, createRng('determinism-1'), 0);
    expect(a).toEqual(b);
  });

  it('different seeds produce different iteration outcomes', () => {
    // Boost PC HP well above expected damage so the result does not just cap
    // at the PC's starting HP every iteration; this surfaces the per-strike
    // variance the sampler produces across seeds.
    const setup = makeSetup({
      pcs: [makePc('mira', { hp: { current: 200, max: 200, temp: 0 } })]
    });
    const config = makeConfig();
    const results = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const result = runIteration(setup, config, createRng(seed), 0);
      results.add(JSON.stringify(result.damageByPair));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('runIteration termination', () => {
  it('returns within maxRounds when fights are stalemate-like', () => {
    // Tiny attack bonus + huge AC => almost no damage, encounter cannot resolve.
    const setup = makeSetup({
      pcs: [makePc('mira', { defenses: { ac: 40 } })],
      enemies: [makeEnemy('boss', [makeAttack({ attackBonus: -50, damageFormula: '1d4' })])]
    });
    const config = makeConfig({ maxRounds: 5 });
    const result = runIteration(setup, config, createRng('stalemate'), 0);
    expect(result.roundsElapsed).toBeLessThanOrEqual(5);
    expect(result.tpk).toBe(false);
  });

  it('flags TPK when every PC is downed', () => {
    // Massive damage forces a quick TPK.
    const setup = makeSetup({
      pcs: [
        makePc('mira', { hp: { current: 2, max: 24, temp: 0 } }),
        makePc('seam', { hp: { current: 2, max: 24, temp: 0 } })
      ],
      enemies: [makeEnemy('boss', [makeAttack({ attackBonus: 20, damageFormula: '5d10+10' })])]
    });
    const config = makeConfig({ tacticsProfile: 'spread-damage' });
    const result = runIteration(setup, config, createRng('tpk-seed'), 0);
    expect(result.tpk).toBe(true);
    expect(result.firstDownRound).not.toBeNull();
  });

  it('terminates early when all enemies die (sanity, even though PCs do nothing)', () => {
    // No PCs alive at start; enemy has no legal targets and the loop exits
    // immediately after the initiative roll.
    const setup = makeSetup({
      pcs: [makePc('mira', { dead: true, downed: true, hp: { current: 0, max: 24, temp: 0 } })],
      enemies: [makeEnemy('boss', [makeAttack()])]
    });
    const config = makeConfig({ maxRounds: 10 });
    const result = runIteration(setup, config, createRng('early-pc-out'), 0);
    expect(result.tpk).toBe(true);
  });

  it('records firstDownRound on the round the first PC drops', () => {
    const setup = makeSetup({
      pcs: [makePc('mira', { hp: { current: 4, max: 24, temp: 0 } })],
      enemies: [makeEnemy('boss', [makeAttack({ attackBonus: 20, damageFormula: '4d10' })])]
    });
    const config = makeConfig({ maxRounds: 5 });
    const result = runIteration(setup, config, createRng('first-down'), 0);
    expect(result.firstDownRound).toBe(1);
  });
});

describe('runIteration metrics', () => {
  it('damageByPair attributes damage to specific (enemy, pc) keys', () => {
    const setup = makeSetup({
      pcs: [makePc('mira', { hp: { current: 30, max: 30, temp: 0 } })],
      enemies: [makeEnemy('boss', [makeAttack({ attackBonus: 15 })])]
    });
    const config = makeConfig({ tacticsProfile: 'focus-fire' });
    const result = runIteration(setup, config, createRng('attribution'), 0);
    const totalAttributed = Object.values(result.damageByPair).reduce((a, b) => a + b, 0);
    const totalReceived = result.perCombatant
      .filter((c) => c.side === 'pc')
      .reduce((a, c) => a + c.damageTaken, 0);
    expect(totalAttributed).toBe(totalReceived);
  });

  it('captureEvents true populates the event log; false leaves it undefined', () => {
    const setup = makeSetup();
    const configOn = makeConfig({ captureEvents: true });
    const configOff = makeConfig({ captureEvents: false });
    const on = runIteration(setup, configOn, createRng('events-on'), 0);
    const off = runIteration(setup, configOff, createRng('events-off'), 0);
    expect(on.events).toBeDefined();
    expect(off.events).toBeUndefined();
  });

  it('iterationIndex is propagated to the result', () => {
    const setup = makeSetup();
    const config = makeConfig();
    const result = runIteration(setup, config, createRng('index'), 42);
    expect(result.iterationIndex).toBe(42);
  });
});
