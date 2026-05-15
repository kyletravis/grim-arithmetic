import { DyingSeverity, immediateDownRisk, MapType } from '../engine/mortality';
import type { IterationCount, SimulationResult, TacticsProfileId } from '../engine/simulation-types';
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
    damageAdjustment: {
      damageType: string;
      resistance: number;
      weakness: number;
      immune: boolean;
      note: string;
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
    assumeHeroPointAvailable,
    damageType: attack.damageType,
    targetAdjustments: subject.damageAdjustments
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
      damageAdjustment: result.damageAdjustment,
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

// --- Forecast (Monte Carlo) panel ---

export interface SimulationControls {
  iterations: IterationCount;
  tacticsProfile: TacticsProfileId;
  /** Free-form seed; blank means "random each run". */
  seed: string;
}

export const DEFAULT_SIMULATION_CONTROLS: SimulationControls = {
  iterations: 5000,
  tacticsProfile: 'focus-fire',
  seed: ''
};

export type ForecastRunState =
  | { kind: 'idle' }
  | { kind: 'running'; completed: number; total: number }
  | { kind: 'done'; result: SimulationResult }
  | { kind: 'error'; message: string };

export interface ForecastControlsView {
  iterations: SelectOption[];
  tacticsProfile: SelectOption[];
  seed: string;
}

export interface ForecastProgressView {
  completed: number;
  total: number;
  percent: number;
}

export interface ForecastResultView {
  iterationsCompleted: number;
  iterationsRequested: number;
  seed: string;
  tacticsProfileLabel: string;
  aborted: boolean;
  anyPcDownPercent: number;
  tpkPercent: number;
  meanFirstDownRound: string;
  medianFirstDownRound: string;
  perPc: ForecastPcRow[];
  perEnemy: ForecastEnemyRow[];
  caveats: string[];
}

export interface ForecastPcRow {
  id: string;
  name: string;
  downPercent: number;
  deathPercent: number;
  meanEndingHp: string;
  topContributingEnemyName: string;
  riskClass: string;
  riskLabel: string;
}

export interface ForecastEnemyRow {
  id: string;
  name: string;
  damageSharePercent: number;
  topTargetName: string;
}

export interface ForecastPanelData {
  moduleVersion: string;
  enabled: boolean;
  disabledMessage: string;
  message: string;
  state: 'idle' | 'running' | 'done' | 'error';
  controls: ForecastControlsView;
  progress?: ForecastProgressView;
  result?: ForecastResultView;
  errorMessage?: string;
  /** Always-visible assumptions block. */
  assumptions: string[];
}

export const TACTICS_PROFILE_LABELS: Record<TacticsProfileId, string> = {
  'random-legal': 'Random legal',
  'spread-damage': 'Spread damage',
  'focus-fire': 'Focus fire',
  predator: 'Predator',
  'boss-cinematic': 'Boss cinematic'
};

export const TACTICS_PROFILE_DESCRIPTIONS: Record<TacticsProfileId, string> = {
  'random-legal': 'Enemies pick any legal PC target and any attack independently per strike.',
  'spread-damage': 'Enemies spread strikes across higher-HP standing PCs; never target downed.',
  'focus-fire': 'Enemies concentrate every strike on the lowest-HP standing PC.',
  predator: 'Enemies prioritize wounded > low-HP > full-HP PCs; attack downed only as a last resort.',
  'boss-cinematic': 'Enemy uses the highest-damage attack on the toughest standing PC, all strikes on the same target.'
};

const ITERATION_CHOICES: IterationCount[] = [1000, 5000, 10000];

export function buildForecastPanelData({
  moduleVersion,
  enabled,
  controls,
  state
}: {
  moduleVersion: string;
  enabled: boolean;
  controls: SimulationControls;
  state: ForecastRunState;
}): ForecastPanelData {
  const baseAssumptions = [
    'PCs take no actions in this model.',
    'No healing, reactions, or recovery checks.',
    `Tactics profile: ${TACTICS_PROFILE_LABELS[controls.tacticsProfile]} — ${TACTICS_PROFILE_DESCRIPTIONS[controls.tacticsProfile]}`,
    `Iterations: ${controls.iterations}.`
  ];

  if (!enabled) {
    return {
      moduleVersion,
      enabled: false,
      disabledMessage:
        'Monte Carlo simulation is disabled in Grim Arithmetic module settings. Enable it in Configure Settings to run forecasts on this client.',
      message: '',
      state: 'idle',
      controls: buildForecastControlsView(controls),
      assumptions: baseAssumptions
    };
  }

  const controlsView = buildForecastControlsView(controls);

  if (state.kind === 'idle') {
    return {
      moduleVersion,
      enabled: true,
      disabledMessage: '',
      message:
        'Configure the run and click Run forecast to simulate the active encounter under the selected tactics profile.',
      state: 'idle',
      controls: controlsView,
      assumptions: baseAssumptions
    };
  }
  if (state.kind === 'running') {
    return {
      moduleVersion,
      enabled: true,
      disabledMessage: '',
      message: 'Simulation in progress…',
      state: 'running',
      controls: controlsView,
      progress: {
        completed: state.completed,
        total: state.total,
        percent: state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0
      },
      assumptions: baseAssumptions
    };
  }
  if (state.kind === 'error') {
    return {
      moduleVersion,
      enabled: true,
      disabledMessage: '',
      message: 'Forecast failed.',
      state: 'error',
      controls: controlsView,
      errorMessage: state.message,
      assumptions: baseAssumptions
    };
  }
  // done
  const result = state.result;
  return {
    moduleVersion,
    enabled: true,
    disabledMessage: '',
    message: result.aborted
      ? `Forecast aborted after ${result.iterationsCompleted} of ${result.iterationsRequested} iterations.`
      : `Forecast complete (${result.iterationsCompleted} iterations).`,
    state: 'done',
    controls: controlsView,
    result: buildForecastResultView(result),
    assumptions: [
      ...baseAssumptions,
      ...result.caveats.map((c) => `Setup: ${c}`)
    ]
  };
}

function buildForecastControlsView(controls: SimulationControls): ForecastControlsView {
  return {
    iterations: ITERATION_CHOICES.map((value) => ({
      value: String(value),
      label: `${value.toLocaleString()} iterations`,
      selected: controls.iterations === value
    })),
    tacticsProfile: (Object.keys(TACTICS_PROFILE_LABELS) as TacticsProfileId[]).map((id) => ({
      value: id,
      label: TACTICS_PROFILE_LABELS[id],
      selected: controls.tacticsProfile === id
    })),
    seed: controls.seed
  };
}

function buildForecastResultView(result: SimulationResult): ForecastResultView {
  const pcNamesById = new Map(result.perPc.map((pc) => [pc.id, pc.name]));
  const enemyNamesById = new Map(result.perEnemy.map((enemy) => [enemy.id, enemy.name]));

  return {
    iterationsCompleted: result.iterationsCompleted,
    iterationsRequested: result.iterationsRequested,
    seed: String(result.seed),
    tacticsProfileLabel: TACTICS_PROFILE_LABELS[result.tacticsProfile],
    aborted: result.aborted,
    anyPcDownPercent: Math.round(result.anyPcDownProbability * 100),
    tpkPercent: Math.round(result.tpkProbability * 100),
    meanFirstDownRound:
      result.meanFirstDownRound === null ? 'n/a' : result.meanFirstDownRound.toFixed(1),
    medianFirstDownRound:
      result.medianFirstDownRound === null ? 'n/a' : String(result.medianFirstDownRound),
    perPc: result.perPc.map((pc) => ({
      id: pc.id,
      name: pc.name,
      downPercent: Math.round(pc.downProbability * 100),
      deathPercent: Math.round(pc.deathProbability * 100),
      meanEndingHp: pc.meanEndingHp.toFixed(1),
      topContributingEnemyName: pc.topContributingEnemyId
        ? enemyNamesById.get(pc.topContributingEnemyId) ?? pc.topContributingEnemyId
        : '—',
      riskClass: forecastRiskClass(pc.downProbability),
      riskLabel: forecastRiskLabel(pc.downProbability)
    })),
    perEnemy: result.perEnemy.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      damageSharePercent: Math.round(enemy.damageShare * 100),
      topTargetName: enemy.topTargetId
        ? pcNamesById.get(enemy.topTargetId) ?? enemy.topTargetId
        : '—'
    })),
    caveats: result.caveats
  };
}

function forecastRiskLabel(probability: number): string {
  if (probability < 0.05) return 'Low';
  if (probability < 0.15) return 'Guarded';
  if (probability < 0.35) return 'Dangerous';
  if (probability < 0.6) return 'Severe';
  return 'Grim';
}

function forecastRiskClass(probability: number): string {
  return forecastRiskLabel(probability).toLowerCase();
}
