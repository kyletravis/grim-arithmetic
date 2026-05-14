import { getCurrentTokenSelection } from '../foundry/selection';
import { getEncounterParticipants } from '../foundry/encounter-participants';
import { computeEncounterRiskMatrix } from '../engine/encounter-risk';
import { Pf2eAdapter } from '../systems/pf2e-adapter';
import { MODULE_ID, MODULE_TITLE, MODULE_VERSION } from '../constants';
import { buildDangerBoardData } from './danger-board';
import {
  buildMortalityPanelData,
  DEFAULT_PANEL_CONTROLS,
  MortalityPanelData,
  PanelControls
} from './panel-data';

type HtmlLike = {
  find: (selector: string) => {
    on: (
      eventName: string,
      handler: (event: { currentTarget: { value: string; dataset?: { grimControl?: string } } }) => void
    ) => void;
  };
};

export class MortalityPanel extends Application {
  private controls: PanelControls = { ...DEFAULT_PANEL_CONTROLS };

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-panel`,
      title: MODULE_TITLE,
      template: `modules/${MODULE_ID}/templates/mortality-panel.hbs`,
      width: 500,
      height: 'auto',
      resizable: true,
      classes: ['grim-arithmetic-window']
    });
  }

  constructor(options?: ApplicationOptions) {
    super(options);
    this.controls.strikes = clampStrikeCount(getSettingNumber('defaultStrikes', 2));
  }

  override async getData(): Promise<MortalityPanelData> {
    const adapter = new Pf2eAdapter();
    const detail = buildMortalityPanelData({
      selection: getCurrentTokenSelection(),
      adapter,
      controls: this.controls,
      moduleVersion: MODULE_VERSION
    });

    const participants = getEncounterParticipants(adapter);
    const matrix = computeEncounterRiskMatrix(participants, {
      adapter,
      controls: this.controls
    });
    const dangerBoard = buildDangerBoardData(matrix);

    return { ...detail, dangerBoard };
  }

  override activateListeners(html: HtmlLike): void {
    super.activateListeners(html);

    html.find('[data-grim-control]').on('change', (event) => {
      const target = event.currentTarget;
      const key = targetKey(target);
      if (!key) return;

      this.updateControl(key, target.value);
      this.render(false);
    });

    html.find('[data-grim-refresh]').on('click', () => {
      this.render(false);
    });
  }

  private updateControl(key: keyof PanelControls, value: string): void {
    if (key === 'strikes') this.controls.strikes = clampStrikeCount(Number(value));
    if (key === 'mapMode') this.controls.mapMode = parseMapMode(value);
    if (key === 'shieldBonus') this.controls.shieldBonus = parseShieldBonus(value);
    if (key === 'woundedOverride') this.controls.woundedOverride = parseWoundedOverride(value);
    if (key === 'heroPointMode') this.controls.heroPointMode = parseHeroPointMode(value);
    if (key === 'attackId') this.controls.attackId = value;
  }
}

function getSettingNumber(key: string, fallback: number): number {
  const value = game.settings.get(MODULE_ID, key);
  return typeof value === 'number' ? value : fallback;
}

function clampStrikeCount(value: number): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  return 2;
}

function parseMapMode(value: string): PanelControls['mapMode'] {
  if (value === 'normal' || value === 'agile' || value === 'none') return value;
  return 'auto';
}

function parseShieldBonus(value: string): PanelControls['shieldBonus'] {
  if (value === '1') return 1;
  if (value === '2') return 2;
  return 0;
}

function parseWoundedOverride(value: string): PanelControls['woundedOverride'] {
  if (value === '0' || value === '1' || value === '2' || value === '3') return value;
  return 'current';
}

function parseHeroPointMode(value: string): PanelControls['heroPointMode'] {
  if (value === 'available' || value === 'unavailable') return value;
  return 'actor';
}

function targetKey(target: { value: string; dataset?: { grimControl?: string } }): keyof PanelControls | null {
  const key = target.dataset?.grimControl;
  if (
    key === 'strikes' ||
    key === 'mapMode' ||
    key === 'shieldBonus' ||
    key === 'woundedOverride' ||
    key === 'heroPointMode' ||
    key === 'attackId'
  ) {
    return key;
  }
  return null;
}
