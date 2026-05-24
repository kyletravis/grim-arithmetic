import { computeEncounterRiskMatrix, MAX_PAIRS } from '../engine/encounter-risk';
import { getEncounterParticipants } from '../foundry/encounter-participants';
import { isMonteCarloEnabled } from '../settings';
import { Pf2eAdapter } from '../systems/pf2e-adapter';
import { MODULE_ID, MODULE_VERSION } from '../constants';
import { buildDangerBoardData, DangerBoardData } from './danger-board';
import { ForecastPanel } from './forecast-panel';
import { DEFAULT_PANEL_CONTROLS } from './panel-data';
import { PairDetailPanel } from './pair-detail-panel';

export interface DangerBoardPanelData {
  moduleVersion: string;
  message: string;
  dangerBoard: DangerBoardData;
  forecastEnabled: boolean;
}

const HEADER_MESSAGE =
  'Encounter-wide immediate risk. Click a row to see the detail math, or use the selection-target button to model an arbitrary pair.';

interface ApplicationV2Like {
  render(force?: boolean | Record<string, unknown>): Promise<unknown>;
}

const ApplicationV2Api = (foundry as { applications: { api: { ApplicationV2: unknown; HandlebarsApplicationMixin: (base: unknown) => unknown } } }).applications.api;
const Base = ApplicationV2Api.HandlebarsApplicationMixin(ApplicationV2Api.ApplicationV2) as unknown as new (
  options?: unknown
) => ApplicationV2Like;

export class DangerBoardPanel extends Base {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-danger-board`,
    classes: ['grim-arithmetic-window'],
    tag: 'section',
    window: {
      title: 'GrimArithmetic.Window.DangerBoard',
      resizable: true
    },
    position: {
      width: 640,
      height: 'auto'
    },
    actions: {
      openDetailPair: function (this: DangerBoardPanel, _event: Event, target: HTMLElement): void {
        const dataset = target.dataset;
        const pcId = dataset.grimPcId;
        const enemyId = dataset.grimEnemyId;
        const attackId = dataset.grimAttackId;
        if (!pcId || !enemyId) return;
        PairDetailPanel.openForPair(pcId, enemyId, attackId);
      },
      openDetailSelection: function (this: DangerBoardPanel): void {
        PairDetailPanel.openForSelection();
      },
      openForecast: function (this: DangerBoardPanel): void {
        ForecastPanel.open();
      },
      refresh: function (this: DangerBoardPanel): void {
        this.render();
      }
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/danger-board-panel.hbs`
    }
  };

  async _prepareContext(): Promise<DangerBoardPanelData> {
    const adapter = new Pf2eAdapter();
    const participants = getEncounterParticipants(adapter);
    const matrix = computeEncounterRiskMatrix(participants, {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS,
      pairLimit: MAX_PAIRS
    });
    const dangerBoard = buildDangerBoardData(matrix);
    return {
      moduleVersion: MODULE_VERSION,
      message: HEADER_MESSAGE,
      dangerBoard,
      forecastEnabled: isMonteCarloEnabled()
    };
  }
}
