import { describe, expect, it } from 'vitest';
import {
  MonteCarloDisabledError,
  runSimulationInWorker
} from '../src/engine/run-simulation-in-worker';
import type {
  EncounterSetup,
  SimulationCombatant,
  SimulationConfig
} from '../src/engine/simulation-types';
import { DEFAULT_MAX_ROUNDS } from '../src/engine/simulation-types';
import type { AttackSnapshot } from '../src/systems/base-adapter';

function makePc(id: string): SimulationCombatant {
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
    attacks: []
  };
}

function makeAttack(): AttackSnapshot {
  return {
    id: 'claw',
    name: 'Claw',
    attackBonus: 10,
    damageFormula: '1d10+5',
    damageType: 'slashing',
    traits: [],
    mapType: 'normal',
    assumptions: []
  };
}

function makeEnemy(): SimulationCombatant {
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
    attacks: [makeAttack()]
  };
}

function makeSetup(): EncounterSetup {
  return {
    pcs: [makePc('mira')],
    enemies: [makeEnemy()],
    caveats: []
  };
}

function makeConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    iterations: 50,
    tacticsProfile: 'focus-fire',
    maxRounds: DEFAULT_MAX_ROUNDS,
    seed: 'worker-test',
    ...overrides
  };
}

// In the Vitest node environment, `Worker` is undefined, so runSimulationInWorker
// takes the synchronous fallback path. These tests cover that path; the actual
// Worker path is exercised manually in Foundry per the KHT-72 acceptance criteria.

describe('runSimulationInWorker sync fallback (Worker undefined in tests)', () => {
  it('resolves with a SimulationResult', async () => {
    const handle = runSimulationInWorker(makeSetup(), makeConfig());
    const result = await handle.promise;
    expect(result.iterationsCompleted).toBe(50);
    expect(result.aborted).toBe(false);
  });

  it('forwards onProgress to the caller', async () => {
    const events: Array<{ completed: number; total: number }> = [];
    const handle = runSimulationInWorker(makeSetup(), makeConfig({ iterations: 10 }), {
      onProgress: (completed, total) => events.push({ completed, total })
    });
    await handle.promise;
    expect(events).toHaveLength(10);
    expect(events[0]).toEqual({ completed: 1, total: 10 });
    expect(events[9]).toEqual({ completed: 10, total: 10 });
  });

  it('cancel() aborts the in-flight run', async () => {
    const handle = runSimulationInWorker(makeSetup(), makeConfig({ iterations: 5000 }), {
      onProgress: (completed) => {
        if (completed === 5) handle.cancel();
      }
    });
    const result = await handle.promise;
    expect(result.aborted).toBe(true);
    expect(result.iterationsCompleted).toBeLessThan(5000);
  });

  it('rejects when validation fails (e.g. iterations too high)', async () => {
    const handle = runSimulationInWorker(
      makeSetup(),
      makeConfig({ iterations: 20000 as never })
    );
    await expect(handle.promise).rejects.toThrow();
  });
});

describe('runSimulationInWorker kill switch', () => {
  it('rejects immediately with MonteCarloDisabledError when settings disable it', async () => {
    // Override the settings helper for this test by stubbing `game`.
    const original = (globalThis as { game?: unknown }).game;
    (globalThis as { game?: unknown }).game = {
      settings: {
        get: (_module: string, key: string) => (key === 'enableMonteCarlo' ? false : undefined)
      }
    };
    try {
      const handle = runSimulationInWorker(makeSetup(), makeConfig());
      await expect(handle.promise).rejects.toBeInstanceOf(MonteCarloDisabledError);
    } finally {
      (globalThis as { game?: unknown }).game = original;
    }
  });

  it('does not construct anything when disabled (cancel is a no-op)', async () => {
    const original = (globalThis as { game?: unknown }).game;
    (globalThis as { game?: unknown }).game = {
      settings: {
        get: (_module: string, key: string) => (key === 'enableMonteCarlo' ? false : undefined)
      }
    };
    try {
      const handle = runSimulationInWorker(makeSetup(), makeConfig());
      handle.cancel();
      await expect(handle.promise).rejects.toBeInstanceOf(MonteCarloDisabledError);
    } finally {
      (globalThis as { game?: unknown }).game = original;
    }
  });
});
