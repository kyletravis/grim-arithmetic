import { riskClassFor, riskLabelFor } from '../engine/risk-bands';
import type { SimulationResult, TacticsProfileId } from '../engine/simulation-types';
import { proportionCIFromRate } from '../engine/statistics';
import type { SelectOption } from './panel-data';

// --- Forecast (Monte Carlo) panel ---

export interface SimulationControls {
  tacticsProfile: TacticsProfileId;
}

export const DEFAULT_SIMULATION_CONTROLS: SimulationControls = {
  tacticsProfile: 'spread-damage'
};

export type ForecastRunState =
  | { kind: 'idle' }
  | { kind: 'running'; completed: number; total: number }
  | { kind: 'done'; result: SimulationResult }
  | { kind: 'error'; message: string };

/** A tactics-profile select option carrying its player-facing definition. */
export interface TacticsProfileOption extends SelectOption {
  description: string;
}

export interface ForecastControlsView {
  tacticsProfile: TacticsProfileOption[];
  /** Description of the currently-selected profile, shown inline under the select. */
  selectedTacticsDescription: string;
}

export interface ForecastProgressView {
  completed: number;
  total: number;
  percent: number;
}

export interface ForecastResultView {
  iterationsCompleted: number;
  iterationsRequested: number;
  tacticsProfileLabel: string;
  tacticsProfileDescription: string;
  aborted: boolean;
  anyPcDownPercent: number;
  anyPcDownCi: string | null;
  tpkPercent: number;
  tpkCi: string | null;
  meanFirstDownRound: string;
  meanFirstDownCi: string | null;
  medianFirstDownRound: string;
  /** Phase I-A safety-net stats so GMs can see heals/recoveries/HP-survivals firing. */
  meanHealsPerIteration: string;
  meanRecoveryChecksPerIteration: string;
  heroPointSurvivalPercent: number;
  perPc: ForecastPcRow[];
  perEnemy: ForecastEnemyRow[];
  caveats: string[];
}

export interface ForecastPcRow {
  id: string;
  name: string;
  downPercent: number;
  downCi: string | null;
  deathPercent: number;
  deathCi: string | null;
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
  /**
   * Banner shown when TPK risk or any single PC's death risk reaches the
   * Severe band (>=35%). Keyed to death, not knockouts: under everDowned
   * semantics a party that wins comfortably still reports a high any-PC-down.
   */
  pessimismWarning?: string;
  /** Single critical caveat shown inline below the stats. */
  vitalAssumption: string;
  /** Remaining modeling assumptions plus setup caveats, shown in a collapsible. */
  otherAssumptions: string[];
}

export const TACTICS_PROFILE_LABELS: Record<TacticsProfileId, string> = {
  'random-legal': 'Random Legal',
  'spread-damage': 'Spread Damage',
  'focus-fire': 'Focus Fire',
  predator: 'Predator',
  'boss-cinematic': 'Boss Cinematic'
};

export const TACTICS_PROFILE_DESCRIPTIONS: Record<TacticsProfileId, string> = {
  'random-legal': 'Enemies pick any legal PC target and any attack independently per strike.',
  'spread-damage': 'Enemies spread strikes across higher-HP standing PCs; never target downed.',
  'focus-fire': 'Enemies concentrate every strike on the lowest-HP standing PC.',
  predator:
    'Enemies prioritize wounded > low-HP > full-HP PCs; attack downed only as a last resort.',
  'boss-cinematic':
    'Enemy uses the highest-damage attack on the toughest standing PC, all strikes on the same target.'
};

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
  // The "not modeled" caveat is the one assumption a GM must see to read the
  // numbers correctly, so it stays inline; the rest collapse behind a disclosure.
  const vitalAssumption =
    'Not modeled: reactions (Shield Block, Champion), spells beyond Heal, persistent damage, attacks of opportunity, movement / reach / line of sight.';
  const otherAssumptions = [
    'Enemies make the configured Default enemy Strike count of Strikes per turn (module setting).',
    'PCs Strike the most-dangerous standing enemy (2 strikes per turn by default).',
    'PCs with healing capability substitute Strikes for Heal spells / Battle Medicine when allies are dying or below 40% HP (Battle Medicine follows the Treat Wounds DC table).',
    'Dying PCs roll PF2e recovery checks each turn (DC 10+dying); crit-success / success lower dying, failure / crit-failure raise it.',
    'Hero Points are spent to prevent death (once per iteration per PC).'
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
      vitalAssumption,
      otherAssumptions
    };
  }

  const controlsView = buildForecastControlsView(controls);

  if (state.kind === 'idle') {
    return {
      moduleVersion,
      enabled: true,
      disabledMessage: '',
      message: 'Select a tactics profile and click Forecast to simulate the active encounter.',
      state: 'idle',
      controls: controlsView,
      vitalAssumption,
      otherAssumptions
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
      vitalAssumption,
      otherAssumptions
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
      vitalAssumption,
      otherAssumptions
    };
  }
  // done
  const result = state.result;
  const n = result.enemyStrikesPerTurn;
  const enemyStrikesBullet = `Enemies make ${n} Strike${n === 1 ? '' : 's'} per turn (module setting "Default enemy Strike count").`;
  return {
    moduleVersion,
    enabled: true,
    disabledMessage: '',
    message: result.aborted ? 'Forecast aborted.' : 'Forecast complete.',
    state: 'done',
    controls: controlsView,
    result: buildForecastResultView(result),
    pessimismWarning: buildPessimismWarning(result),
    vitalAssumption,
    otherAssumptions: [enemyStrikesBullet, ...otherAssumptions.slice(1), ...result.caveats]
  };
}

function buildPessimismWarning(result: SimulationResult): string | undefined {
  // Knockouts are routine in PF2e and any-PC-down counts every one of them, so
  // the banner keys off death risk: TPK or any single PC in the Severe band.
  const worstPcDeath = Math.max(0, ...result.perPc.map((pc) => pc.deathProbability));
  if (result.tpkProbability < 0.35 && worstPcDeath < 0.35) return undefined;
  // The bold "High-risk encounter." lead is rendered separately (PessimismLead),
  // so the body stays tight and avoids repeating it.
  return (
    'Even with healing, recovery, and Hero Points, a large share of runs end with a dead PC or a TPK. ' +
    'Reactions and positioning are not modeled, so real-table risk may be a bit lower — but the structural ' +
    'lethality is worth examining.'
  );
}

function buildForecastControlsView(controls: SimulationControls): ForecastControlsView {
  return {
    tacticsProfile: (Object.keys(TACTICS_PROFILE_LABELS) as TacticsProfileId[])
      .sort()
      .map((id) => ({
        value: id,
        label: TACTICS_PROFILE_LABELS[id],
        description: TACTICS_PROFILE_DESCRIPTIONS[id],
        selected: controls.tacticsProfile === id
      })),
    selectedTacticsDescription: TACTICS_PROFILE_DESCRIPTIONS[controls.tacticsProfile]
  };
}

function buildForecastResultView(result: SimulationResult): ForecastResultView {
  const pcNamesById = new Map(result.perPc.map((pc) => [pc.id, pc.name]));
  const enemyNamesById = new Map(result.perEnemy.map((enemy) => [enemy.id, enemy.name]));
  const ci = result.confidenceIntervals;

  const anyPcDownPercent = Math.round(result.anyPcDownProbability * 100);
  const tpkPercent = Math.round(result.tpkProbability * 100);

  const anyPcDownCi = ci?.anyPcDown
    ? `${Math.round(ci.anyPcDown.lower * 100)}%–${Math.round(ci.anyPcDown.upper * 100)}%`
    : null;
  const tpkCi = ci?.tpk
    ? `${Math.round(ci.tpk.lower * 100)}%–${Math.round(ci.tpk.upper * 100)}%`
    : null;
  const meanFirstDownCi = ci?.meanFirstDownRound
    ? `${ci.meanFirstDownRound.lower.toFixed(1)}–${ci.meanFirstDownRound.upper.toFixed(1)}`
    : null;

  return {
    iterationsCompleted: result.iterationsCompleted,
    iterationsRequested: result.iterationsRequested,
    tacticsProfileLabel: TACTICS_PROFILE_LABELS[result.tacticsProfile],
    tacticsProfileDescription: TACTICS_PROFILE_DESCRIPTIONS[result.tacticsProfile],
    aborted: result.aborted,
    anyPcDownPercent,
    anyPcDownCi,
    tpkPercent,
    tpkCi,
    meanFirstDownRound:
      result.meanFirstDownRound === null ? 'n/a' : result.meanFirstDownRound.toFixed(1),
    meanFirstDownCi,
    medianFirstDownRound:
      result.medianFirstDownRound === null ? 'n/a' : String(result.medianFirstDownRound),
    meanHealsPerIteration: result.safetyNet.meanHealsPerIteration.toFixed(1),
    meanRecoveryChecksPerIteration: result.safetyNet.meanRecoveryChecksPerIteration.toFixed(1),
    heroPointSurvivalPercent: Math.round(result.safetyNet.heroPointSurvivalRate * 100),
    perPc: result.perPc
      .map((pc) => {
        const downCi =
          result.iterationsCompleted > 0
            ? proportionCIFromRate(pc.downProbability, result.iterationsCompleted)
            : null;
        const deathCi =
          result.iterationsCompleted > 0
            ? proportionCIFromRate(pc.deathProbability, result.iterationsCompleted)
            : null;
        return {
          id: pc.id,
          name: pc.name,
          downPercent: Math.round(pc.downProbability * 100),
          downCi: downCi
            ? `${Math.round(downCi.lower * 100)}%–${Math.round(downCi.upper * 100)}%`
            : null,
          deathPercent: Math.round(pc.deathProbability * 100),
          deathCi: deathCi
            ? `${Math.round(deathCi.lower * 100)}%–${Math.round(deathCi.upper * 100)}%`
            : null,
          meanEndingHp: pc.meanEndingHp.toFixed(1),
          topContributingEnemyName: pc.topContributingEnemyId
            ? (enemyNamesById.get(pc.topContributingEnemyId) ?? pc.topContributingEnemyId)
            : '—',
          riskClass: riskClassFor(pc.downProbability),
          riskLabel: riskLabelFor(pc.downProbability)
        };
      })
      // Sort at displayed precision so rows showing the same percent always fall
      // back to the alphabetical tie-break (raw-value sorting hid sub-percent gaps).
      .sort((a, b) => b.downPercent - a.downPercent || a.name.localeCompare(b.name)),
    perEnemy: result.perEnemy
      .map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        damageSharePercent: Math.round(enemy.damageShare * 100),
        topTargetName: enemy.topTargetId
          ? (pcNamesById.get(enemy.topTargetId) ?? enemy.topTargetId)
          : '—'
      }))
      // Sort at displayed precision so rows showing the same percent always fall
      // back to the alphabetical tie-break (raw-value sorting hid sub-percent gaps).
      .sort((a, b) => b.damageSharePercent - a.damageSharePercent || a.name.localeCompare(b.name)),
    caveats: result.caveats
  };
}
