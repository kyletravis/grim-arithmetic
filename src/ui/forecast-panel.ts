import { runSimulationInWorker, type RunSimulationHandle } from '../engine/run-simulation-in-worker';
import type { SimulationConfig, SimulationResult } from '../engine/simulation-types';
import { DEFAULT_MAX_ROUNDS } from '../engine/simulation-types';
import { buildEncounterSetup } from '../foundry/encounter-setup';
import { isMonteCarloEnabled } from '../settings';
import { Pf2eAdapter } from '../systems/pf2e-adapter';
import { MODULE_ID, MODULE_TITLE, MODULE_VERSION } from '../constants';
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

const ApplicationV2Api = (foundry as { applications: { api: { ApplicationV2: unknown; HandlebarsApplicationMixin: (base: unknown) => unknown } } }).applications.api;
const Base = ApplicationV2Api.HandlebarsApplicationMixin(ApplicationV2Api.ApplicationV2) as unknown as new (
  options?: unknown
) => ApplicationV2Like;

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
      title: `${MODULE_TITLE} — Encounter Forecast`,
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
  }

  private startRun(): void {
    const adapter = new Pf2eAdapter();
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
      maxRounds: DEFAULT_MAX_ROUNDS
    };

    this.runState = { kind: 'running', completed: 0, total: 5000 };
    this.render();

    const handle = runSimulationInWorker(setup, config, {
      onProgress: (completed, total) => {
        if (this.runState.kind === 'running') {
          this.runState = { kind: 'running', completed, total };
          this.render();
        }
      }
    });
    this.currentHandle = handle;

    handle.promise.then(
      (result: SimulationResult) => {
        this.runState = { kind: 'done', result };
        this.currentHandle = undefined;
        this.render();
      },
      (err) => {
        this.runState = {
          kind: 'error',
          message: err instanceof Error ? err.message : String(err)
        };
        this.currentHandle = undefined;
        this.render();
      }
    );
  }
}
