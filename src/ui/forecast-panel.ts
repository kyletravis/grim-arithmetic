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

type HtmlLike = {
  find: (selector: string) => {
    on: (
      eventName: string,
      handler: (event: { currentTarget: { value: string; dataset?: DOMStringMap } }) => void
    ) => void;
  };
};

export class ForecastPanel extends Application {
  private static instance?: ForecastPanel;

  private controls: SimulationControls = { ...DEFAULT_SIMULATION_CONTROLS };
  private runState: ForecastRunState = { kind: 'idle' };
  private currentHandle?: RunSimulationHandle;

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-forecast`,
      title: `${MODULE_TITLE} — Encounter Forecast`,
      template: `modules/${MODULE_ID}/templates/forecast-panel.hbs`,
      width: 800,
      height: 'auto',
      resizable: true,
      classes: ['grim-arithmetic-window']
    });
  }

  static getInstance(): ForecastPanel {
    if (!ForecastPanel.instance) {
      ForecastPanel.instance = new ForecastPanel();
    }
    return ForecastPanel.instance;
  }

  static open(): void {
    ForecastPanel.getInstance().render(true);
  }

  override async getData(): Promise<ForecastPanelData> {
    return buildForecastPanelData({
      moduleVersion: MODULE_VERSION,
      enabled: isMonteCarloEnabled(),
      controls: this.controls,
      state: this.runState
    });
  }

  override activateListeners(html: HtmlLike): void {
    super.activateListeners(html);

    html.find('[data-grim-forecast-control]').on('change', (event) => {
      const target = event.currentTarget;
      const key = target.dataset?.grimForecastControl;
      if (key === 'tacticsProfile') {
        if (
          target.value === 'random-legal' ||
          target.value === 'spread-damage' ||
          target.value === 'focus-fire' ||
          target.value === 'predator' ||
          target.value === 'boss-cinematic'
        ) {
          this.controls.tacticsProfile = target.value;
        }
      }
      this.render(false);
    });

    html.find('[data-grim-forecast-run]').on('click', () => {
      this.startRun();
    });

    html.find('[data-grim-forecast-cancel]').on('click', () => {
      this.currentHandle?.cancel();
    });
  }

  override async close(options?: { force?: boolean }): Promise<void> {
    this.currentHandle?.cancel();
    return super.close(options);
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
      this.render(false);
      return;
    }

    if (setup.pcs.length === 0 || setup.enemies.length === 0) {
      this.runState = {
        kind: 'error',
        message:
          'No active combat with both PCs and enemies. Start a combat encounter, then run the forecast.'
      };
      this.render(false);
      return;
    }

    const config: SimulationConfig = {
      iterations: 5000,
      tacticsProfile: this.controls.tacticsProfile,
      maxRounds: DEFAULT_MAX_ROUNDS
    };

    this.runState = { kind: 'running', completed: 0, total: 5000 };
    this.render(false);

    const handle = runSimulationInWorker(setup, config, {
      onProgress: (completed, total) => {
        if (this.runState.kind === 'running') {
          this.runState = { kind: 'running', completed, total };
          this.render(false);
        }
      }
    });
    this.currentHandle = handle;

    handle.promise.then(
      (result: SimulationResult) => {
        this.runState = { kind: 'done', result };
        this.currentHandle = undefined;
        this.render(false);
      },
      (err) => {
        this.runState = {
          kind: 'error',
          message: err instanceof Error ? err.message : String(err)
        };
        this.currentHandle = undefined;
        this.render(false);
      }
    );
  }
}
