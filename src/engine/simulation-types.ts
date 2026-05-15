import type { DegreeOfSuccess } from './degree-of-success';
import type { AttackSnapshot, DamageAdjustments } from '../systems/base-adapter';

/** Tactics profile identifiers shipped in v0.6.0. */
export type TacticsProfileId =
  | 'random-legal'
  | 'spread-damage'
  | 'focus-fire'
  | 'predator'
  | 'boss-cinematic';

/** Iteration counts the GM can select in the Forecast window. */
export type IterationCount = 1000 | 5000 | 10000;

/** Default iteration count when none specified. */
export const DEFAULT_ITERATIONS: IterationCount = 5000;

/** Hard ceiling enforced by the engine guardrails (KHT-78). */
export const MAX_ITERATIONS: IterationCount = 10000;

/** Default round cap if the encounter never terminates by other means. */
export const DEFAULT_MAX_ROUNDS = 10;

/**
 * Per-combatant runtime state inside a simulation iteration.
 *
 * Distinct from CombatantSnapshot (the system adapter's read-only extraction)
 * because simulation state mutates round-to-round: HP drops, dying ticks up,
 * downed/dead flags flip. SimulationCombatant carries the engine's working state.
 *
 * Fields explicitly NOT modeled in v0.6.0 (deferred):
 *   - persistent damage values
 *   - recovery check state machine
 *   - hero point spend tracking
 *   - per-PC action plans
 */
export interface SimulationCombatant {
  id: string;
  name: string;
  side: 'pc' | 'enemy';
  hp: {
    current: number;
    max: number;
    temp: number;
  };
  defenses: {
    ac: number;
    fort?: number;
    reflex?: number;
    will?: number;
  };
  /** Current PF2e dying value. 0 = not dying. */
  dying: number;
  /** Persistent wounded value carried into future down events. */
  wounded: number;
  /** Doomed condition value; lowers the death threshold. */
  doomed: number;
  /** Available hero points; informational in v0.6.0 (not used for survival). */
  heroPoints: number;
  /** True once HP reaches 0 in this iteration. Sticky for tactics targeting. */
  downed: boolean;
  /** True once dying >= doomed-adjusted death threshold, or enemy at 0 HP. */
  dead: boolean;
  /** Initiative bonus; rolled with the seeded RNG at start of each iteration. */
  initiativeBonus: number;
  /** Resistance/weakness/immunity adjustments from the system adapter. */
  damageAdjustments?: DamageAdjustments;
  traits: string[];
  /** Per-attack options the tactics profile may select from. */
  attacks: AttackSnapshot[];
}

/**
 * The static encounter description passed into runSimulation.
 *
 * Carries forward the encounter-level toggles already supported in panel-data
 * (MAP mode override, shield/AC adjustment, wounded override, Hero Point
 * assumption). These ride alongside the combatant snapshots so the engine
 * does not have to re-read Foundry settings mid-run.
 */
export interface EncounterSetup {
  pcs: SimulationCombatant[];
  enemies: SimulationCombatant[];
  /**
   * Diagnostic caveats produced by the encounter setup builder (KHT-73):
   * unsupported actors, missing damage formulas, etc. Engine threads these
   * into the SimulationResult so the UI can surface them.
   */
  caveats: string[];
}

/**
 * Per-run configuration for the simulation.
 *
 * The seed field accepts either a hashable string or a numeric seed. The
 * iteration runner derives per-iteration sub-seeds from this master seed so
 * iteration N is reproducible independent of iteration count.
 */
export interface SimulationConfig {
  iterations: IterationCount;
  seed?: number | string;
  tacticsProfile: TacticsProfileId;
  maxRounds: number;
  /** Optional cooperative wall-clock budget in ms; 0/undefined disables it. */
  wallClockBudgetMs?: number;
  /** Whether to capture per-strike events in IterationResult (memory cost). */
  captureEvents?: boolean;
}

/**
 * A single Strike event captured during an iteration (optional per config).
 *
 * Used for debugging and for the per-iteration log; not required for the
 * aggregate metrics. Off by default to control memory at high iteration counts.
 */
export interface RoundEvent {
  round: number;
  attackerId: string;
  defenderId: string;
  attackId: string;
  attackName: string;
  degree: DegreeOfSuccess;
  damage: number;
  /** True if this Strike took the defender to 0 HP. */
  causedDown: boolean;
}

/** Final per-combatant state at the end of an iteration. */
export interface PerCombatantOutcome {
  id: string;
  side: 'pc' | 'enemy';
  endingHp: number;
  dying: number;
  wounded: number;
  doomed: number;
  downed: boolean;
  dead: boolean;
  /** Total damage taken across all rounds in this iteration. */
  damageTaken: number;
}

/** Outcome of a single iteration. */
export interface IterationResult {
  iterationIndex: number;
  /** Round number when the iteration terminated (1-based). */
  roundsElapsed: number;
  /** First round in which any PC was downed; null if no PC went down. */
  firstDownRound: number | null;
  /** True if all PCs were downed (or dead) by the time the iteration ended. */
  tpk: boolean;
  perCombatant: PerCombatantOutcome[];
  /**
   * Per-enemy damage dealt to each PC this iteration. Used by the aggregator
   * to compute per-enemy damage share and top-target attribution.
   * Key: `${enemyId}->${pcId}`. Value: total damage dealt in this iteration.
   */
  damageByPair: Record<string, number>;
  /** Optional event log when SimulationConfig.captureEvents is true. */
  events?: RoundEvent[];
}

/** Per-PC aggregate across all iterations. */
export interface PerPcAggregate {
  id: string;
  name: string;
  /** Fraction of iterations in which this PC was downed at least once. */
  downProbability: number;
  /** Fraction of iterations in which this PC reached death. */
  deathProbability: number;
  /** Mean ending HP across iterations. */
  meanEndingHp: number;
  /** ID of the enemy that contributed the most damage to this PC overall. */
  topContributingEnemyId: string | null;
}

/** Per-enemy aggregate across all iterations. */
export interface PerEnemyAggregate {
  id: string;
  name: string;
  /** Share of total damage-dealt-to-PCs attributable to this enemy. */
  damageShare: number;
  /** PC id this enemy targeted most across all iterations. */
  topTargetId: string | null;
}

/** Aggregate result returned by runSimulation. */
export interface SimulationResult {
  iterationsRequested: number;
  /** May be less than iterationsRequested if aborted or wall-clock budget hit. */
  iterationsCompleted: number;
  seed: number | string;
  tacticsProfile: TacticsProfileId;
  /** True if the run was aborted (KHT-78). */
  aborted: boolean;
  /** Probability >=1 PC was downed in an iteration. */
  anyPcDownProbability: number;
  /** Probability all PCs were downed in an iteration. */
  tpkProbability: number;
  /** Mean of firstDownRound across iterations where any PC went down. */
  meanFirstDownRound: number | null;
  /** Median of firstDownRound across iterations where any PC went down. */
  medianFirstDownRound: number | null;
  perPc: PerPcAggregate[];
  perEnemy: PerEnemyAggregate[];
  /** Caveats from setup builder plus engine-level notes. */
  caveats: string[];
}

/** Helper alias for sides; useful where Foundry's disposition language differs. */
export type CombatantSide = SimulationCombatant['side'];
