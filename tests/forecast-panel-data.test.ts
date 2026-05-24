import { describe, expect, it } from 'vitest';
import {
  buildForecastPanelData,
  DEFAULT_SIMULATION_CONTROLS,
  TACTICS_PROFILE_LABELS,
  TACTICS_PROFILE_DESCRIPTIONS,
  type ForecastRunState,
  type SimulationControls
} from '../src/ui/panel-data';
import type { SimulationResult } from '../src/engine/simulation-types';

function makeControls(overrides: Partial<SimulationControls> = {}): SimulationControls {
  return { ...DEFAULT_SIMULATION_CONTROLS, ...overrides };
}

const baseArgs = (state: ForecastRunState, enabled = true) => ({
  moduleVersion: '0.6.0-rc.1',
  enabled,
  controls: makeControls(),
  state
});

describe('buildForecastPanelData: disabled state', () => {
  it('returns a clear disabled-message view when the kill switch is off', () => {
    const data = buildForecastPanelData(baseArgs({ kind: 'idle' }, false));
    expect(data.enabled).toBe(false);
    expect(data.disabledMessage).toMatch(/disabled in Grim Arithmetic module settings/i);
    expect(data.state).toBe('idle');
  });
});

describe('buildForecastPanelData: idle state', () => {
  it('exposes tactics profile control only', () => {
    const data = buildForecastPanelData(baseArgs({ kind: 'idle' }));
    expect(data.enabled).toBe(true);
    expect(data.state).toBe('idle');
    expect(data.controls.tacticsProfile.map((o) => o.value)).toEqual([
      'boss-cinematic',
      'focus-fire',
      'predator',
      'random-legal',
      'spread-damage'
    ]);
  });

  it('selects the configured tactics profile', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'idle' }),
      controls: makeControls({ tacticsProfile: 'boss-cinematic' })
    });
    expect(data.controls.tacticsProfile.find((o) => o.selected)?.value).toBe('boss-cinematic');
  });

  it('carries the per-profile definition on each tactics option (KHT-111)', () => {
    const data = buildForecastPanelData(baseArgs({ kind: 'idle' }));
    for (const option of data.controls.tacticsProfile) {
      expect(option.description).toBe(
        TACTICS_PROFILE_DESCRIPTIONS[option.value as keyof typeof TACTICS_PROFILE_DESCRIPTIONS]
      );
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it('capitalizes the second word of multi-word tactics labels (KHT-111)', () => {
    expect(TACTICS_PROFILE_LABELS).toMatchObject({
      'random-legal': 'Random Legal',
      'spread-damage': 'Spread Damage',
      'focus-fire': 'Focus Fire',
      predator: 'Predator',
      'boss-cinematic': 'Boss Cinematic'
    });
  });

  it('always lists the v0.6.0-rc.4 baseline assumptions (PCs heal, recover, spend HP)', () => {
    const data = buildForecastPanelData(baseArgs({ kind: 'idle' }));
    expect(data.assumptions.find((a) => a.includes('PCs Strike the most-dangerous'))).toBeDefined();
    expect(data.assumptions.find((a) => a.includes('Heal spells / Battle Medicine'))).toBeDefined();
    expect(data.assumptions.find((a) => a.includes('recovery checks'))).toBeDefined();
    expect(data.assumptions.find((a) => a.includes('Hero Points'))).toBeDefined();
    expect(data.assumptions.find((a) => a.includes('Not modeled:'))).toBeDefined();
  });
});

describe('buildForecastPanelData: running state', () => {
  it('reports progress with percent rounded to whole', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'running', completed: 1900, total: 5000 })
    });
    expect(data.state).toBe('running');
    expect(data.progress?.completed).toBe(1900);
    expect(data.progress?.total).toBe(5000);
    expect(data.progress?.percent).toBe(38);
  });

  it('handles zero-total progress without dividing by zero', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'running', completed: 0, total: 0 })
    });
    expect(data.progress?.percent).toBe(0);
  });
});

describe('buildForecastPanelData: error state', () => {
  it('surfaces the error message and keeps controls visible for retry', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'error', message: 'Something broke' })
    });
    expect(data.state).toBe('error');
    expect(data.errorMessage).toBe('Something broke');
    expect(data.controls.tacticsProfile.length).toBeGreaterThan(0);
  });
});

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    iterationsRequested: 5000,
    iterationsCompleted: 5000,
    seed: 'troll-fight',
    tacticsProfile: 'focus-fire',
    aborted: false,
    anyPcDownProbability: 0.62,
    tpkProbability: 0.12,
    meanFirstDownRound: 2.1,
    medianFirstDownRound: 2,
    perPc: [
      {
        id: 'mira',
        name: 'Mira',
        downProbability: 0.48,
        deathProbability: 0.04,
        meanEndingHp: 9.4,
        topContributingEnemyId: 'troll'
      },
      {
        id: 'seam',
        name: 'Seam',
        downProbability: 0.06,
        deathProbability: 0,
        meanEndingHp: 22.1,
        topContributingEnemyId: 'troll'
      }
    ],
    perEnemy: [
      { id: 'troll', name: 'Troll Mauler', damageShare: 1, topTargetId: 'mira' }
    ],
    safetyNet: {
      meanHealsPerIteration: 0,
      meanRecoveryChecksPerIteration: 0,
      heroPointSurvivalRate: 0
    },
    confidenceIntervals: {
      anyPcDown: { lower: 0.6, upper: 0.64 },
      tpk: { lower: 0.1, upper: 0.14 },
      meanFirstDownRound: { lower: 2.0, upper: 2.2 }
    },
    caveats: [],
    ...overrides
  };
}

describe('buildForecastPanelData: done state', () => {
  it('formats headline metrics as percents and round numbers', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'done', result: makeResult() })
    });
    expect(data.state).toBe('done');
    expect(data.result?.anyPcDownPercent).toBe(62);
    expect(data.result?.tpkPercent).toBe(12);
    expect(data.result?.meanFirstDownRound).toBe('2.1');
    expect(data.result?.medianFirstDownRound).toBe('2');
  });

  it('maps per-PC down probability to a risk pill class', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'done', result: makeResult() })
    });
    const mira = data.result?.perPc.find((p) => p.id === 'mira');
    expect(mira?.riskLabel).toBe('Severe');
    expect(mira?.riskClass).toBe('severe');
    const seam = data.result?.perPc.find((p) => p.id === 'seam');
    expect(seam?.riskLabel).toBe('Guarded');
  });

  it('resolves topContributingEnemyId to a display name', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'done', result: makeResult() })
    });
    expect(data.result?.perPc[0].topContributingEnemyName).toBe('Troll Mauler');
  });

  it('emits the tactics profile label in the run meta', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'done', result: makeResult() })
    });
    expect(data.result?.tacticsProfileLabel).toBe(TACTICS_PROFILE_LABELS['focus-fire']);
    expect(data.result?.tacticsProfileDescription).toBe(
      TACTICS_PROFILE_DESCRIPTIONS['focus-fire']
    );
  });

  it('flags aborted results and surfaces a partial-completion message', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({ aborted: true, iterationsCompleted: 1200 })
      })
    });
    expect(data.result?.aborted).toBe(true);
    expect(data.message).toBe('Forecast aborted.');
  });

  it('threads setup caveats into the assumptions block', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({ caveats: ['unsupported actor X skipped'] })
      })
    });
    expect(data.assumptions.some((a) => a.includes('unsupported actor X skipped'))).toBe(true);
  });

  it('shows a pessimism banner when any-PC-down >= 80%', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({ anyPcDownProbability: 0.99 })
      })
    });
    expect(data.pessimismWarning).toBeDefined();
    expect(data.pessimismWarning).toMatch(/high-risk|healing|Hero Points|structural lethality/i);
  });

  it('omits the pessimism banner when any-PC-down is below the threshold', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({ anyPcDownProbability: 0.4 })
      })
    });
    expect(data.pessimismWarning).toBeUndefined();
  });

  it('surfaces Phase I-A safety-net stats so GMs see heals, recoveries, and Hero Point survivals firing', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({
          safetyNet: {
            meanHealsPerIteration: 1.42,
            meanRecoveryChecksPerIteration: 0.73,
            heroPointSurvivalRate: 0.18
          }
        })
      })
    });
    expect(data.result?.meanHealsPerIteration).toBe('1.4');
    expect(data.result?.meanRecoveryChecksPerIteration).toBe('0.7');
    expect(data.result?.heroPointSurvivalPercent).toBe(18);
  });

  it('formats zero safety-net values without NaN or undefined', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({
          safetyNet: {
            meanHealsPerIteration: 0,
            meanRecoveryChecksPerIteration: 0,
            heroPointSurvivalRate: 0
          }
        })
      })
    });
    expect(data.result?.meanHealsPerIteration).toBe('0.0');
    expect(data.result?.meanRecoveryChecksPerIteration).toBe('0.0');
    expect(data.result?.heroPointSurvivalPercent).toBe(0);
  });
});
