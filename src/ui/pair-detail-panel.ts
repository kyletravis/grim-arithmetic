import { getCurrentTokenSelection, TokenSelectionResult } from '../foundry/selection';
import { Pf2eAdapter } from '../systems/pf2e-adapter';
import { MODULE_ID, MODULE_TITLE, MODULE_VERSION } from '../constants';
import {
  buildMortalityPanelData,
  DEFAULT_PANEL_CONTROLS,
  MortalityPanelData,
  PanelControls
} from './panel-data';
import { resolvePairSelection } from './pair-detail-resolver';

export { resolvePairSelection };

interface ApplicationV2Like {
  render(force?: boolean | Record<string, unknown>): Promise<unknown>;
  element: HTMLElement;
}

const ApplicationV2Api = (foundry as { applications: { api: { ApplicationV2: unknown; HandlebarsApplicationMixin: (base: unknown) => unknown } } }).applications.api;
const Base = ApplicationV2Api.HandlebarsApplicationMixin(ApplicationV2Api.ApplicationV2) as unknown as new (
  options?: unknown
) => ApplicationV2Like;

const PAIR_DETAIL_ID = `${MODULE_ID}-pair-detail`;

export class PairDetailPanel extends Base {
  private static singleton?: PairDetailPanel;

  private controls: PanelControls = { ...DEFAULT_PANEL_CONTROLS };
  private explicitSelection?: TokenSelectionResult<unknown>;

  static DEFAULT_OPTIONS = {
    id: PAIR_DETAIL_ID,
    classes: ['grim-arithmetic-window'],
    tag: 'section',
    window: {
      title: `${MODULE_TITLE} - Pair Detail`,
      resizable: true
    },
    position: {
      width: 500,
      height: 640
    },
    actions: {
      refresh: function (this: PairDetailPanel): void {
        this.render();
      }
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/pair-detail-panel.hbs`
    }
  };

  static getInstance(): PairDetailPanel {
    if (!PairDetailPanel.singleton) {
      PairDetailPanel.singleton = new PairDetailPanel();
    }
    return PairDetailPanel.singleton;
  }

  static openForPair(pcId: string, enemyId: string, attackId?: string): void {
    const pcToken = (canvas.tokens?.get(pcId) ?? null) as unknown;
    const enemyToken = (canvas.tokens?.get(enemyId) ?? null) as unknown;
    const instance = PairDetailPanel.getInstance();
    instance.explicitSelection = resolvePairSelection(pcToken, enemyToken);
    if (attackId !== undefined) {
      instance.controls.attackId = attackId;
    }
    instance.render({ force: true });
  }

  static openForSelection(): void {
    const instance = PairDetailPanel.getInstance();
    instance.explicitSelection = undefined;
    instance.render({ force: true });
  }

  async _prepareContext(): Promise<MortalityPanelData> {
    const selection = this.explicitSelection ?? getCurrentTokenSelection();
    return buildMortalityPanelData({
      selection,
      adapter: new Pf2eAdapter(),
      controls: this.controls,
      moduleVersion: MODULE_VERSION
    });
  }

  async _onRender(): Promise<void> {
    const root = this.element;
    if (!root) return;
    root.querySelectorAll<HTMLSelectElement>('[data-grim-control]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = targetKey(el);
        if (!key) return;
        this.updateControl(key, el.value);
        this.render();
      });
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

function targetKey(target: HTMLSelectElement): keyof PanelControls | null {
  const key = target.dataset.grimControl;
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
