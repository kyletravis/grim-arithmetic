import { DyingSeverity, immediateDownRisk, MapType } from '../engine/mortality';
import { TokenSelectionResult } from '../foundry/selection';
import { AttackSnapshot, CombatantSnapshot, SystemAdapter } from '../systems/base-adapter';

export interface StrikeChanceData {
  index: number;
  hitPercent: number;
  critPercent: number;
}

export interface PanelControls {
  strikes: 1 | 2 | 3;
  mapMode: 'auto' | MapType;
  shieldBonus: 0 | 1 | 2;
  woundedOverride: 'current' | '0' | '1' | '2' | '3';
  heroPointMode: 'actor' | 'available' | 'unavailable';
  attackId: string;
}

export interface SelectOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface MortalityPanelData {
  moduleVersion: string;
  message: string;
  permanentDeath: string;
  errors: string[];
  controls: {
    strikes: SelectOption[];
    attacks: SelectOption[];
    mapMode: SelectOption[];
    shieldBonus: SelectOption[];
    woundedOverride: SelectOption[];
    heroPointMode: SelectOption[];
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
    damage: {
      min: number;
      max: number;
      average: string;
      critMin: number;
      critMax: number;
      swinginess: string;
    };
    dyingSeverity: DyingSeverity;
    strikeChances: StrikeChanceData[];
    assumptions: string[];
    notModeled: string[];
  };
}

export const DEFAULT_PANEL_CONTROLS: PanelControls = {
  strikes: 2,
  mapMode: 'auto',
  shieldBonus: 0,
  woundedOverride: 'current',
  heroPointMode: 'actor',
  attackId: ''
};

const PERMANENT_DEATH_MESSAGE =
  'Permanent death probability is planned for a future milestone and is not modeled in MVP.';

export function buildMortalityPanelData<TokenLike>({
  selection,
  adapter,
  controls,
  moduleVersion
}: {
  selection: TokenSelectionResult<TokenLike>;
  adapter: SystemAdapter<TokenLike>;
  controls: PanelControls;
  moduleVersion: string;
}): MortalityPanelData {
  if (selection.errors.length > 0 || !selection.subjectToken || !selection.enemyToken) {
    return {
      moduleVersion,
      message: 'Select one PC token and target one enemy token to estimate immediate down risk.',
      permanentDeath: PERMANENT_DEATH_MESSAGE,
      errors: selection.errors,
      controls: buildControlOptions(controls, [])
    };
  }

  const subject = adapter.getCombatantFromToken(selection.subjectToken);
  const enemy = adapter.getCombatantFromToken(selection.enemyToken);
  const attacks = adapter.getAttacksFromToken(selection.enemyToken);
  const attack = resolveSelectedAttack(attacks, controls.attackId);
  const errors = buildExtractionErrors(subject, enemy, attack);
  const panelControls = buildControlOptions(controls, attacks, attack?.id);

  if (errors.length > 0 || !subject || !enemy || !attack) {
    return {
      moduleVersion,
      message: 'Grim Arithmetic could not extract enough PF2e data for this token pair yet.',
      permanentDeath: PERMANENT_DEATH_MESSAGE,
      errors,
      controls: panelControls
    };
  }

  const mapType = resolveMapType(controls.mapMode, attack.mapType);
  const effectiveAc = subject.defenses.ac + controls.shieldBonus;
  const modeledHp = subject.hp.current + (subject.hp.temp ?? 0);
  const wounded = resolveWounded(subject, controls.woundedOverride);
  const doomed = subject.deathState?.doomed ?? 0;
  const assumeHeroPointAvailable = resolveHeroPointAvailability(subject, controls.heroPointMode);
  const result = immediateDownRisk({
    hp: modeledHp,
    ac: effectiveAc,
    attackBonus: attack.attackBonus,
    damageFormula: attack.damageFormula,
    strikes: controls.strikes,
    mapType,
    wounded,
    doomed,
    assumeHeroPointAvailable
  });

  const assumptions = [...attack.assumptions, ...result.assumptions];
  if (controls.shieldBonus > 0) {
    assumptions.push(`Applies a +${controls.shieldBonus} shield/status AC adjustment.`);
  }
  if (controls.woundedOverride !== 'current') {
    assumptions.push(`Uses wounded override ${controls.woundedOverride} for dying severity if the PC is downed.`);
  }
  if (controls.heroPointMode !== 'actor') {
    assumptions.push(`Uses Hero Point override: ${controls.heroPointMode}.`);
  }

  return {
    moduleVersion,
    message: 'Immediate down-risk estimate based on the selected PC and targeted enemy.',
    permanentDeath: PERMANENT_DEATH_MESSAGE,
    errors: [],
    controls: panelControls,
    subject,
    enemy,
    attack,
    risk: {
      downPercent: toPercent(result.downProbability),
      expectedHpAfterTurn: result.expectedHpAfterTurn.toFixed(1),
      riskLabel: result.riskLabel,
      effectiveAc,
      modeledHp,
      woundedNote: getWoundedNote(subject, controls.woundedOverride),
      damage: result.damage,
      dyingSeverity: result.dyingSeverity,
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

export function buildControlOptions(
  controls: PanelControls,
  attacks: AttackSnapshot[],
  selectedAttackId = controls.attackId
): MortalityPanelData['controls'] {
  const resolvedAttackId = attacks.some((attack) => attack.id === selectedAttackId)
    ? selectedAttackId
    : (attacks[0]?.id ?? '');

  return {
    strikes: ['1', '2', '3'].map((value) => ({
      value,
      label: `${value} Strike${value === '1' ? '' : 's'}`,
      selected: String(controls.strikes) === value
    })),
    attacks: attacks.map((attack) => ({
      value: attack.id,
      label: `${attack.name} — +${attack.attackBonus}, ${attack.damageFormula}`,
      selected: attack.id === resolvedAttackId
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
    })),
    heroPointMode: [
      ['actor', 'Use actor Hero Points'],
      ['available', 'Assume Hero Point available'],
      ['unavailable', 'Assume no Hero Point']
    ].map(([value, label]) => ({ value, label, selected: controls.heroPointMode === value }))
  };
}

function buildExtractionErrors(
  subject: CombatantSnapshot | null,
  enemy: CombatantSnapshot | null,
  attack: AttackSnapshot | undefined
): string[] {
  const errors: string[] = [];
  if (!subject) errors.push('Could not read selected PC HP/AC from PF2e actor data.');
  if (!enemy) errors.push('Could not read targeted enemy HP/AC from PF2e actor data.');
  if (subject && subject.disposition !== 'pc') {
    errors.push('Selected token is not recognized as a PC/character by the PF2e adapter.');
  }
  if (enemy && enemy.disposition !== 'enemy') {
    errors.push('Targeted token is not recognized as an enemy/NPC by the PF2e adapter.');
  }
  if (!attack) {
    errors.push(
      'Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula.'
    );
  }
  return errors;
}

function resolveSelectedAttack(attacks: AttackSnapshot[], selectedAttackId: string): AttackSnapshot | undefined {
  return attacks.find((attack) => attack.id === selectedAttackId) ?? attacks[0];
}

function resolveMapType(mapMode: PanelControls['mapMode'], attackMapType: AttackSnapshot['mapType']): MapType {
  if (mapMode !== 'auto') return mapMode;
  return attackMapType === 'unknown' ? 'normal' : attackMapType;
}

function getWoundedNote(subject: CombatantSnapshot, override: PanelControls['woundedOverride']): string {
  if (override === 'current') return `Current actor wounded value used for dying severity: ${subject.deathState?.wounded ?? 0}`;
  return `Override used for dying severity: Wounded ${override}`;
}

function resolveWounded(subject: CombatantSnapshot, override: PanelControls['woundedOverride']): number {
  if (override === 'current') return subject.deathState?.wounded ?? 0;
  return Number(override);
}

function resolveHeroPointAvailability(
  subject: CombatantSnapshot,
  heroPointMode: PanelControls['heroPointMode']
): boolean {
  if (heroPointMode === 'available') return true;
  if (heroPointMode === 'unavailable') return false;
  return (subject.deathState?.heroPoints ?? 0) > 0;
}

function toPercent(probability: number): number {
  return Math.round(probability * 100);
}
