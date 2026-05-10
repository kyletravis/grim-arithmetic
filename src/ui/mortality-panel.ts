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

interface MortalityPanelData {
  message: string;
  permanentDeath: string;
  errors: string[];
  subject?: CombatantSnapshot;
  enemy?: CombatantSnapshot;
  attack?: AttackSnapshot;
  risk?: {
    downPercent: number;
    expectedHpAfterTurn: string;
    riskLabel: string;
    strikeChances: StrikeChanceData[];
    assumptions: string[];
    notModeled: string[];
  };
}

export class MortalityPanel extends Application {
  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-panel`,
      title: MODULE_TITLE,
      template: `modules/${MODULE_ID}/templates/mortality-panel.hbs`,
      width: 460,
      height: 'auto',
      resizable: true,
      classes: ['grim-arithmetic-window']
    });
  }

  override async getData(): Promise<MortalityPanelData> {
    const permanentDeath =
      'Permanent death probability is planned for a future milestone and is not modeled in MVP.';
    const selection = getCurrentTokenSelection();

    if (selection.errors.length > 0) {
      return {
        message: 'Select a PC token and target one enemy token to estimate immediate down risk.',
        permanentDeath,
        errors: selection.errors
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
        errors
      };
    }

    const strikes = getSettingNumber('defaultStrikes', 2) as 1 | 2 | 3;
    const mapType: MapType = attack.mapType === 'unknown' ? 'normal' : attack.mapType;
    const result = immediateDownRisk({
      hp: subject.hp.current + (subject.hp.temp ?? 0),
      ac: subject.defenses.ac,
      attackBonus: attack.attackBonus,
      damageFormula: attack.damageFormula,
      strikes,
      mapType
    });

    return {
      message: 'Immediate down-risk estimate based on the selected PC and targeted enemy.',
      permanentDeath,
      errors: [],
      subject,
      enemy,
      attack,
      risk: {
        downPercent: toPercent(result.downProbability),
        expectedHpAfterTurn: result.expectedHpAfterTurn.toFixed(1),
        riskLabel: result.riskLabel,
        strikeChances: result.hitChanceByStrike.map((hitChance, index) => ({
          index: index + 1,
          hitPercent: toPercent(hitChance),
          critPercent: toPercent(result.critChanceByStrike[index] ?? 0)
        })),
        assumptions: [...attack.assumptions, ...result.assumptions],
        notModeled: result.notModeled
      }
    };
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

function getSettingNumber(key: string, fallback: number): number {
  const value = game.settings.get(MODULE_ID, key);
  return typeof value === 'number' ? value : fallback;
}

function toPercent(probability: number): number {
  return Math.round(probability * 100);
}
