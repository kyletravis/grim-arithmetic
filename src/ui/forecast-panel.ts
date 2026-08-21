import {
  runSimulationInWorker,
  type RunSimulationHandle
} from '../engine/run-simulation-in-worker';
import type { SimulationConfig, SimulationResult } from '../engine/simulation-types';
import { DEFAULT_MAX_ROUNDS } from '../engine/simulation-types';
import { buildEncounterSetup } from '../foundry/encounter-setup';
import { getDefaultStrikes, isMonteCarloEnabled } from '../settings';
import { getSystemAdapter } from '../systems/adapter-registry';
import { MODULE_ID, MODULE_VERSION } from '../constants';
import {
  buildForecastPanelData,
  DEFAULT_SIMULATION_CONTROLS,
  type ForecastPanelData,
  type ForecastRunState,
  type SimulationControls
} from './panel-data';

interface ApplicationV2Like {
  render(force?: boolean | Record<string, unknown>): Promise<unknown>;
  element: HTMLElement;
}

const ApplicationV2Api = foundry.applications.api;
const Base = ApplicationV2Api.HandlebarsApplicationMixin(
  ApplicationV2Api.ApplicationV2
) as unknown as new (options?: unknown) => ApplicationV2Like;

const FORECAST_ID = `${MODULE_ID}-forecast`;

export class ForecastPanel extends Base {
  private static singleton?: ForecastPanel;

  private controls: SimulationControls = { ...DEFAULT_SIMULATION_CONTROLS };
  private runState: ForecastRunState = { kind: 'idle' };
  private currentHandle?: RunSimulationHandle;

  static DEFAULT_OPTIONS = {
    id: FORECAST_ID,
    classes: ['grim-arithmetic-window'],
    tag: 'section',
    window: {
      title: 'GrimArithmetic.Window.Forecast',
      resizable: true
    },
    position: {
      width: 800,
      height: 720
    },
    actions: {
      run: function (this: ForecastPanel): void {
        this.startRun();
      },
      cancel: function (this: ForecastPanel): void {
        this.currentHandle?.cancel();
      }
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/forecast-panel.hbs`
    }
  };

  static getInstance(): ForecastPanel {
    if (!ForecastPanel.singleton) {
      ForecastPanel.singleton = new ForecastPanel();
    }
    return ForecastPanel.singleton;
  }

  static open(): void {
    ForecastPanel.getInstance().render({ force: true });
  }

  async _prepareContext(): Promise<ForecastPanelData> {
    return buildForecastPanelData({
      moduleVersion: MODULE_VERSION,
      enabled: isMonteCarloEnabled(),
      controls: this.controls,
      state: this.runState
    });
  }

  async _onRender(): Promise<void> {
    const root = this.element;
    if (!root) return;
    root.querySelectorAll<HTMLSelectElement>('[data-grim-forecast-control]').forEach((el) => {
      el.addEventListener('change', () => {
        if (this.runState.kind === 'running') return;
        const key = el.dataset.grimForecastControl;
        if (key === 'tacticsProfile') {
          const value = el.value;
          if (
            value === 'random-legal' ||
            value === 'spread-damage' ||
            value === 'focus-fire' ||
            value === 'predator' ||
            value === 'boss-cinematic'
          ) {
            this.controls.tacticsProfile = value;
          }
        }
        this.render();
      });
    });
  }

  async _preClose(): Promise<void> {
    this.currentHandle?.cancel();
    this.currentHandle = undefined;
    this.runState = { kind: 'idle' };
  }

  private startRun(): void {
    this.currentHandle?.cancel();
    this.currentHandle = undefined;

    const adapter = getSystemAdapter();
    if (!adapter) {
      this.runState = { kind: 'error', message: 'Unsupported game system.' };
      this.render();
      return;
    }

    let setup;
    try {
      setup = buildEncounterSetup(adapter);
    } catch (err) {
      this.runState = {
        kind: 'error',
        message: err instanceof Error ? err.message : String(err)
      };
      this.render();
      return;
    }

    if (setup.pcs.length === 0 || setup.enemies.length === 0) {
      this.runState = {
        kind: 'error',
        message:
          'No active combat with both PCs and enemies. Start a combat encounter, then run the forecast.'
      };
      this.render();
      return;
    }

    const config: SimulationConfig = {
      iterations: 5000,
      tacticsProfile: this.controls.tacticsProfile,
      maxRounds: DEFAULT_MAX_ROUNDS,
      enemyStrikesPerTurn: getDefaultStrikes()
    };

    this.runState = { kind: 'running', completed: 0, total: 5000 };
    this.render();

    const handle: RunSimulationHandle = runSimulationInWorker(setup, config, {
      onProgress: (completed, total) => {
        if (this.currentHandle !== handle || this.runState.kind !== 'running') return;
        this.runState = { kind: 'running', completed, total };
        this.updateProgressText(completed, total);
      }
    });
    this.currentHandle = handle;

    handle.promise.then(
      (result: SimulationResult) => {
        if (this.currentHandle !== handle) return;
        this.runState = { kind: 'done', result };
        this.currentHandle = undefined;
        this.render();
      },
      (err) => {
        if (this.currentHandle !== handle) return;
        this.runState = {
          kind: 'error',
          message: err instanceof Error ? err.message : String(err)
        };
        this.currentHandle = undefined;
        this.render();
      }
    );
  }

  private updateProgressText(completed: number, total: number): void {
    const node = this.element?.querySelector<HTMLElement>('[data-grim-progress]');
    if (!node) return;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    node.textContent =
      game.i18n?.format('GrimArithmetic.Forecast.Progress', { completed, total, percent }) ??
      `${completed}/${total} (${percent}%)`;
  }
}
