import { describe, expect, it } from 'vitest';
import { runSimulation } from '../src/engine/run-simulation';
import {
  MaxIterationsExceededError,
  throttleProgress,
  validateSimulationConfig
} from '../src/engine/simulation-guardrails';
import {
  DEFAULT_MAX_ROUNDS,
  MAX_ITERATIONS,
  type EncounterSetup,
  type SimulationCombatant,
  type SimulationConfig
} from '../src/engine/simulation-types';
import type { AttackSnapshot } from '../src/systems/base-adapter';

function makePc(id: string, overrides: Partial<SimulationCombatant> = {}): SimulationCombatant {
  return {
    id,
    name: id,
    side: 'pc',
    hp: { current: 24, max: 24, temp: 0 },
    defenses: { ac: 20 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 4,
    traits: [],
    attacks: [],
    ...overrides
  };
}

function makeEnemy(attacks: AttackSnapshot[]): SimulationCombatant {
  return {
    id: 'boss',
    name: 'boss',
    side: 'enemy',
    hp: { current: 40, max: 40, temp: 0 },
    defenses: { ac: 18 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 4,
    traits: [],
    attacks
  };
}

function makeAttack(overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
  return {
    id: 'claw',
    name: 'Claw',
    attackBonus: 10,
    damageFormula: '1d10+5',
    damageType: 'slashing',
    traits: [],
    mapType: 'normal',
    assumptions: [],
    ...overrides
  };
}

function makeSetup(): EncounterSetup {
  return {
    pcs: [makePc('mira')],
    enemies: [makeEnemy([makeAttack()])],
    caveats: []
  };
}

function baseConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    iterations: 1000,
    tacticsProfile: 'focus-fire',
    maxRounds: DEFAULT_MAX_ROUNDS,
    seed: 'guardrail',
    ...overrides
  };
}

describe('validateSimulationConfig', () => {
  it('accepts a valid config', () => {
    expect(() => validateSimulationConfig(baseConfig())).not.toThrow();
  });

  it('rejects iterations greater than MAX_ITERATIONS', () => {
    expect(() =>
      validateSimulationConfig(baseConfig({ iterations: (MAX_ITERATIONS + 1) as never }))
    ).toThrow(MaxIterationsExceededError);
  });

  it('rejects zero or negative iterations', () => {
    expect(() => validateSimulationConfig(baseConfig({ iterations: 0 as never }))).toThrow(
      /must be a positive integer/
    );
  });

  it('rejects fractional iterations', () => {
    expect(() => validateSimulationConfig(baseConfig({ iterations: 100.5 as never }))).toThrow(
      /must be a positive integer/
    );
  });

  it('rejects maxRounds below 1', () => {
    expect(() => validateSimulationConfig(baseConfig({ maxRounds: 0 }))).toThrow(
      /maxRounds must be a positive integer/
    );
  });

  it('rejects non-finite wallClockBudgetMs', () => {
    expect(() =>
      validateSimulationConfig(baseConfig({ wallClockBudgetMs: Number.POSITIVE_INFINITY }))
    ).toThrow();
    expect(() =>
      validateSimulationConfig(baseConfig({ wallClockBudgetMs: -1 }))
    ).toThrow();
  });

  it('allows wallClockBudgetMs = 0 (disabled)', () => {
    expect(() => validateSimulationConfig(baseConfig({ wallClockBudgetMs: 0 }))).not.toThrow();
  });
});

describe('runSimulation: validateSimulationConfig is enforced', () => {
  it('rejects configs above MAX_ITERATIONS without running anything', () => {
    expect(() =>
      runSimulation(makeSetup(), baseConfig({ iterations: (MAX_ITERATIONS + 1) as never }))
    ).toThrow(MaxIterationsExceededError);
  });
});

describe('runSimulation: wall-clock budget', () => {
  it('terminates within the budget and flags aborted = true', () => {
    // Use a tiny budget; the runner should bail after one or two iterations.
    const result = runSimulation(
      makeSetup(),
      baseConfig({ iterations: 5000, wallClockBudgetMs: 1 })
    );
    expect(result.aborted).toBe(true);
    expect(result.iterationsCompleted).toBeLessThan(5000);
  });

  it('does not abort when the budget is generous', () => {
    const result = runSimulation(
      makeSetup(),
      baseConfig({ iterations: 50, wallClockBudgetMs: 10_000 })
    );
    expect(result.aborted).toBe(false);
    expect(result.iterationsCompleted).toBe(50);
  });
});

describe('throttleProgress', () => {
  it('fires immediately on first call', () => {
    const now = 0;
    const calls: number[] = [];
    const wrapped = throttleProgress((n: number) => calls.push(n), 100, () => now);
    wrapped(1);
    expect(calls).toEqual([1]);
  });

  it('drops intermediate calls within the throttle window', () => {
    let now = 0;
    const calls: number[] = [];
    const wrapped = throttleProgress((n: number) => calls.push(n), 100, () => now);
    wrapped(1);
    now = 50;
    wrapped(2);
    now = 80;
    wrapped(3);
    expect(calls).toEqual([1]);
  });

  it('fires again after the throttle window elapses', () => {
    let now = 0;
    const calls: number[] = [];
    const wrapped = throttleProgress((n: number) => calls.push(n), 100, () => now);
    wrapped(1);
    now = 200;
    wrapped(2);
    expect(calls).toEqual([1, 2]);
  });

  it('flush() emits the latest dropped call', () => {
    let now = 0;
    const calls: number[] = [];
    const wrapped = throttleProgress((n: number) => calls.push(n), 100, () => now);
    wrapped(1);
    now = 30;
    wrapped(2);
    now = 60;
    wrapped(3);
    wrapped.flush();
    expect(calls).toEqual([1, 3]);
  });

  it('flush() is a no-op when nothing is pending', () => {
    const now = 0;
    const calls: number[] = [];
    const wrapped = throttleProgress((n: number) => calls.push(n), 100, () => now);
    wrapped(1);
    wrapped.flush();
    expect(calls).toEqual([1]);
  });
});
