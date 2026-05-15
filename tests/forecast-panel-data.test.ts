import { describe, expect, it } from 'vitest';
import {
  buildForecastPanelData,
  DEFAULT_SIMULATION_CONTROLS,
  TACTICS_PROFILE_LABELS,
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
  it('exposes iteration, profile, and seed controls', () => {
    const data = buildForecastPanelData(baseArgs({ kind: 'idle' }));
    expect(data.enabled).toBe(true);
    expect(data.state).toBe('idle');
    expect(data.controls.iterations.map((o) => o.value)).toEqual(['1000', '5000', '10000']);
    expect(data.controls.tacticsProfile.map((o) => o.value).sort()).toEqual(
      ['boss-cinematic', 'focus-fire', 'predator', 'random-legal', 'spread-damage']
    );
    expect(data.controls.seed).toBe('');
  });

  it('selects the configured iteration choice', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'idle' }),
      controls: makeControls({ iterations: 10000 })
    });
    expect(data.controls.iterations.find((o) => o.selected)?.value).toBe('10000');
  });

  it('always lists the v0.6.0 baseline assumptions', () => {
    const data = buildForecastPanelData(baseArgs({ kind: 'idle' }));
    expect(data.assumptions).toContain('PCs take no actions in this model.');
    expect(data.assumptions).toContain('No healing, reactions, or recovery checks.');
    expect(data.assumptions.find((a) => a.includes('Tactics profile'))).toBeDefined();
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

  it('emits the tactics profile label and seed in the run meta', () => {
    const data = buildForecastPanelData({
      ...baseArgs({ kind: 'done', result: makeResult() })
    });
    expect(data.result?.tacticsProfileLabel).toBe(TACTICS_PROFILE_LABELS['focus-fire']);
    expect(data.result?.seed).toBe('troll-fight');
  });

  it('flags aborted results and surfaces a partial-completion message', () => {
    const data = buildForecastPanelData({
      ...baseArgs({
        kind: 'done',
        result: makeResult({ aborted: true, iterationsCompleted: 1200 })
      })
    });
    expect(data.result?.aborted).toBe(true);
    expect(data.message).toMatch(/aborted after 1200 of 5000/);
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
});
