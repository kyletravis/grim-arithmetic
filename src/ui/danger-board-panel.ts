import { computeEncounterRiskMatrix, MAX_PAIRS } from '../engine/encounter-risk';
import { getEncounterParticipants } from '../foundry/encounter-participants';
import { Pf2eAdapter } from '../systems/pf2e-adapter';
import { MODULE_ID, MODULE_TITLE, MODULE_VERSION } from '../constants';
import { buildDangerBoardData, DangerBoardData } from './danger-board';
import { DEFAULT_PANEL_CONTROLS } from './panel-data';
import { PairDetailPanel } from './pair-detail-panel';

type HtmlLike = {
  find: (selector: string) => {
    on: (
      eventName: string,
      handler: (event: { currentTarget: { dataset?: DOMStringMap } }) => void
    ) => void;
  };
};

export interface DangerBoardPanelData {
  moduleVersion: string;
  message: string;
  dangerBoard: DangerBoardData;
}

const HEADER_MESSAGE =
  'Encounter-wide immediate risk. Click a row to see the detail math, or use the selection-target button to model an arbitrary pair.';

export class DangerBoardPanel extends Application {
  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-danger-board`,
      title: `${MODULE_TITLE} — Encounter Danger Board`,
      template: `modules/${MODULE_ID}/templates/danger-board-panel.hbs`,
      width: 520,
      height: 'auto',
      resizable: true,
      classes: ['grim-arithmetic-window']
    });
  }

  override async getData(): Promise<DangerBoardPanelData> {
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
      dangerBoard
    };
  }

  override activateListeners(html: HtmlLike): void {
    super.activateListeners(html);

    html.find('[data-grim-open-detail-pair]').on('click', (event) => {
      const dataset = event.currentTarget.dataset;
      const pcId = dataset?.grimPcId;
      const enemyId = dataset?.grimEnemyId;
      const attackId = dataset?.grimAttackId;
      if (!pcId || !enemyId) return;
      PairDetailPanel.openForPair(pcId, enemyId, attackId);
    });

    html.find('[data-grim-open-detail-selection]').on('click', () => {
      PairDetailPanel.openForSelection();
    });

    html.find('[data-grim-refresh]').on('click', () => {
      this.render(false);
    });
  }
}
