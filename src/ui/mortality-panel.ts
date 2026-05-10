import { immediateDownRisk, MapType } from '../engine/mortality';
import { getCurrentTokenSelection } from '../foundry/selection';
import { Pf2eAdapter } from '../systems/pf2e-adapter';
import { AttackSnapshot, CombatantSnapshot } from '../systems/base-adapter';
import { MODULE_ID, MODULE_TITLE } from '../constants';

interface StrikeChanceData {
  index: number;
  hitPercent: number;
  critPercent: number;
}

interface PanelControls {
  strikes: 1 | 2 | 3;
  mapMode: 'auto' | MapType;
  shieldBonus: 0 | 1 | 2;
  woundedOverride: 'current' | '0' | '1' | '2' | '3';
}

interface SelectOption {
  value: string;
  label: string;
  selected: boolean;
}

interface MortalityPanelData {
  message: string;
  permanentDeath: string;
  errors: string[];
  controls: {
    strikes: SelectOption[];
    mapMode: SelectOption[];
    shieldBonus: SelectOption[];
    woundedOverride: SelectOption[];
  };
  subject?: CombatantSnapshot;
  enemy?: CombatantSnapshot;
  attack?: AttackSnapshot;
  risk?: {
    downPercent: number;
    expectedHpAfterTurn: string;
    riskLabel: string;
    effectiveAc: number;
    modeledHp: number;
    woundedNote: string;
    strikeChances: StrikeChanceData[];
    assumptions: string[];
    notModeled: string[];
  };
}

type HtmlLike = {
  find: (selector: string) => {
    on: (eventName: string, handler: (event: { currentTarget: { value: string } }) => void) => void;
  };
};

export class MortalityPanel extends Application {
  private controls: PanelControls = {
    strikes: 2,
    mapMode: 'auto',
    shieldBonus: 0,
    woundedOverride: 'current'
  };

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
    const permanentDeath =
      'Permanent death probability is planned for a future milestone and is not modeled in MVP.';
    const selection = getCurrentTokenSelection();
    const controls = buildControlOptions(this.controls);

    if (selection.errors.length > 0) {
      return {
        message: 'Select a PC token and target one enemy token to estimate immediate down risk.',
        permanentDeath,
        errors: selection.errors,
        controls
      };
    }

    const adapter = new Pf2eAdapter();
    const subject = adapter.getCombatantFromToken(selection.subjectToken);
    const enemy = adapter.getCombatantFromToken(selection.enemyToken);
    const attacks = adapter.getAttacksFromToken(selection.enemyToken);
    const attack = attacks[0];
    const errors = buildExtractionErrors(subject, enemy, attack);

    if (errors.length > 0 || !subject || !enemy || !attack) {
      return {
        message: 'Grim Arithmetic could not extract enough PF2e data for this token pair yet.',
        permanentDeath,
        errors,
        controls
      };
    }

    const mapType = resolveMapType(this.controls.mapMode, attack.mapType);
    const effectiveAc = subject.defenses.ac + this.controls.shieldBonus;
    const modeledHp = subject.hp.current + (subject.hp.temp ?? 0);
    const result = immediateDownRisk({
      hp: modeledHp,
      ac: effectiveAc,
      attackBonus: attack.attackBonus,
      damageFormula: attack.damageFormula,
      strikes: this.controls.strikes,
      mapType
    });

    const assumptions = [...attack.assumptions, ...result.assumptions];
    if (this.controls.shieldBonus > 0) {
      assumptions.push(`Applies a +${this.controls.shieldBonus} shield/status AC adjustment.`);
    }
    if (this.controls.woundedOverride !== 'current') {
      assumptions.push(
        `Displays wounded override ${this.controls.woundedOverride}; down-risk math does not use wounded yet.`
      );
    }

    return {
      message: 'Immediate down-risk estimate based on the selected PC and targeted enemy.',
      permanentDeath,
      errors: [],
      controls,
      subject,
      enemy,
      attack,
      risk: {
        downPercent: toPercent(result.downProbability),
        expectedHpAfterTurn: result.expectedHpAfterTurn.toFixed(1),
        riskLabel: result.riskLabel,
        effectiveAc,
        modeledHp,
        woundedNote: getWoundedNote(subject, this.controls.woundedOverride),
        strikeChances: result.hitChanceByStrike.map((hitChance, index) => ({
          index: index + 1,
          hitPercent: toPercent(hitChance),
          critPercent: toPercent(result.critChanceByStrike[index] ?? 0)
        })),
        assumptions,
        notModeled: result.notModeled
      }
    };
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
  }

  private updateControl(key: keyof PanelControls, value: string): void {
    if (key === 'strikes') this.controls.strikes = clampStrikeCount(Number(value));
    if (key === 'mapMode') this.controls.mapMode = parseMapMode(value);
    if (key === 'shieldBonus') this.controls.shieldBonus = parseShieldBonus(value);
    if (key === 'woundedOverride') this.controls.woundedOverride = parseWoundedOverride(value);
  }
}

function buildExtractionErrors(
  subject: CombatantSnapshot | null,
  enemy: CombatantSnapshot | null,
  attack: AttackSnapshot | undefined
): string[] {
  const errors: string[] = [];
  if (!subject) errors.push('Could not read selected PC HP/AC from PF2e actor data.');
  if (!enemy) errors.push('Could not read targeted enemy HP/AC from PF2e actor data.');
  if (!attack) errors.push('Could not find a supported melee Strike on the targeted enemy.');
  return errors;
}

function buildControlOptions(controls: PanelControls): MortalityPanelData['controls'] {
  return {
    strikes: ['1', '2', '3'].map((value) => ({
      value,
      label: `${value} Strike${value === '1' ? '' : 's'}`,
      selected: String(controls.strikes) === value
    })),
    mapMode: [
      ['auto', 'Auto'],
      ['normal', 'Normal'],
      ['agile', 'Agile'],
      ['none', 'None']
    ].map(([value, label]) => ({ value, label, selected: controls.mapMode === value })),
    shieldBonus: ['0', '1', '2'].map((value) => ({
      value,
      label: value === '0' ? 'No shield bonus' : `+${value} AC`,
      selected: String(controls.shieldBonus) === value
    })),
    woundedOverride: ['current', '0', '1', '2', '3'].map((value) => ({
      value,
      label: value === 'current' ? 'Current actor value' : `Wounded ${value}`,
      selected: controls.woundedOverride === value
    }))
  };
}

function getSettingNumber(key: string, fallback: number): number {
  const value = game.settings.get(MODULE_ID, key);
  return typeof value === 'number' ? value : fallback;
}

function resolveMapType(mapMode: PanelControls['mapMode'], attackMapType: AttackSnapshot['mapType']): MapType {
  if (mapMode !== 'auto') return mapMode;
  return attackMapType === 'unknown' ? 'normal' : attackMapType;
}

function getWoundedNote(subject: CombatantSnapshot, override: PanelControls['woundedOverride']): string {
  if (override === 'current') return `Current actor wounded value: ${subject.deathState?.wounded ?? 0}`;
  return `Override displayed: Wounded ${override}`;
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

function targetKey(target: { value: string }): keyof PanelControls | null {
  const key = (target as { dataset?: { grimControl?: string } }).dataset?.grimControl;
  if (key === 'strikes' || key === 'mapMode' || key === 'shieldBonus' || key === 'woundedOverride') {
    return key;
  }
  return null;
}

function toPercent(probability: number): number {
  return Math.round(probability * 100);
}
