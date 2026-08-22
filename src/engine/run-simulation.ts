import { createRng, deriveChildSeed } from './prng';
import { runIteration } from './run-iteration';
import { validateSimulationConfig } from './simulation-guardrails';
import { DEFAULT_STRIKES_PER_TURN } from './tactics/tactics-types';
import type {
  EncounterSetup,
  IterationResult,
  MeanConfidenceInterval,
  PerEnemyAggregate,
  PerPcAggregate,
  SimulationConfig,
  SimulationConfidenceIntervals,
  SimulationResult
} from './simulation-types';
import { meanCI, median, proportionCI } from './statistics';

export interface RunSimulationOptions {
  /** Fires with (completed, total) after each iteration completes. */
  onProgress?: (completed: number, total: number) => void;
  /**
   * Cooperative abort signal. Checked between iterations; when aborted the
   * runner returns the partial SimulationResult with aborted = true.
   */
  abortSignal?: { readonly aborted: boolean };
}

/**
 * Run N iterations of runIteration and aggregate the headline metrics.
 *
 * Master seed is config.seed (or Date.now() when absent). Per-iteration
 * sub-seeds are derived via deriveChildSeed so iteration N is reproducible
 * independently of total iteration count: running 1k iterations and then
 * comparing the first 1k of a 10k run with the same master seed gives
 * identical per-iteration results.
 *
 * The cooperative abort signal is checked at the top of each iteration; the
 * partial SimulationResult flags `aborted: true` and reports the actual
 * iteration count it completed.
 */
export function runSimulation(
  setup: EncounterSetup,
  config: SimulationConfig,
  options: RunSimulationOptions = {}
): SimulationResult {
  validateSimulationConfig(config);

  const masterSeed = config.seed ?? Date.now();
  const wallClockBudgetMs = config.wallClockBudgetMs ?? 0;
  const startTime = wallClockBudgetMs > 0 ? Date.now() : 0;
  const results: IterationResult[] = [];
  let aborted = false;

  for (let i = 0; i < config.iterations; i += 1) {
    if (options.abortSignal?.aborted) {
      aborted = true;
      break;
    }
    if (wallClockBudgetMs > 0 && Date.now() - startTime > wallClockBudgetMs) {
      aborted = true;
      break;
    }
    const iterationSeed = deriveChildSeed(masterSeed, i);
    results.push(runIteration(setup, config, createRng(iterationSeed), i));
    options.onProgress?.(i + 1, config.iterations);
  }

  return aggregate(setup, config, masterSeed, results, aborted);
}

function aggregate(
  setup: EncounterSetup,
  config: SimulationConfig,
  seed: number | string,
  results: IterationResult[],
  aborted: boolean
): SimulationResult {
  const completedCount = results.length;
  const enemyStrikesPerTurn = config.enemyStrikesPerTurn ?? DEFAULT_STRIKES_PER_TURN;
  if (completedCount === 0) {
    return {
      iterationsRequested: config.iterations,
      iterationsCompleted: 0,
      seed,
      tacticsProfile: config.tacticsProfile,
      aborted,
      anyPcDownProbability: 0,
      tpkProbability: 0,
      meanFirstDownRound: null,
      medianFirstDownRound: null,
      perPc: setup.pcs.map((pc) => ({
        id: pc.id,
        name: pc.name,
        downProbability: 0,
        deathProbability: 0,
        meanEndingHp: pc.hp.current,
        topContributingEnemyId: null
      })),
      perEnemy: setup.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        damageShare: 0,
        topTargetId: null
      })),
      safetyNet: {
        meanHealsPerIteration: 0,
        meanRecoveryChecksPerIteration: 0,
        heroPointSurvivalRate: 0
      },
      confidenceIntervals: {
        anyPcDown: { lower: 0, upper: 0 },
        tpk: { lower: 0, upper: 0 },
        meanFirstDownRound: null
      },
      roundCapRate: 0,
      caveats: [...setup.caveats, 'No iterations completed.'],
      enemyStrikesPerTurn
    };
  }

  let anyDownCount = 0;
  let tpkCount = 0;
  const firstDownRounds: number[] = [];

  const downByPc = new Map<string, number>();
  const deathByPc = new Map<string, number>();
  const endingHpByPc = new Map<string, number[]>();
  const damageByPair = new Map<string, number>();

  for (const result of results) {
    let anyDown = false;
    let allDown = true;
    let pcCount = 0;
    for (const combatant of result.perCombatant) {
      if (combatant.side !== 'pc') continue;
      pcCount += 1;
      // "Down" for risk reporting means "hit 0 HP at any point", matching the
      // UI copy ("knocked out at least once"); a healed PC still counts.
      if (combatant.everDowned || combatant.downed || combatant.dead) {
        anyDown = true;
        downByPc.set(combatant.id, (downByPc.get(combatant.id) ?? 0) + 1);
      }
      // TPK stays an end-state concept: everyone still down when it ended.
      if (!combatant.downed && !combatant.dead) {
        allDown = false;
      }
      if (combatant.dead) {
        deathByPc.set(combatant.id, (deathByPc.get(combatant.id) ?? 0) + 1);
      }
      const list = endingHpByPc.get(combatant.id) ?? [];
      list.push(combatant.endingHp);
      endingHpByPc.set(combatant.id, list);
    }
    if (pcCount > 0 && anyDown) anyDownCount += 1;
    if (pcCount > 0 && allDown) tpkCount += 1;
    if (result.firstDownRound !== null) firstDownRounds.push(result.firstDownRound);

    for (const [key, value] of Object.entries(result.damageByPair)) {
      damageByPair.set(key, (damageByPair.get(key) ?? 0) + value);
    }
  }

  const perPc: PerPcAggregate[] = setup.pcs.map((pc) => {
    const downCount = downByPc.get(pc.id) ?? 0;
    const deathCount = deathByPc.get(pc.id) ?? 0;
    const endingHps = endingHpByPc.get(pc.id) ?? [];
    const meanEndingHp =
      endingHps.length > 0
        ? endingHps.reduce((a, b) => a + b, 0) / endingHps.length
        : pc.hp.current;
    let topEnemyId: string | null = null;
    let topEnemyDamage = 0;
    for (const enemy of setup.enemies) {
      const total = damageByPair.get(`${enemy.id}->${pc.id}`) ?? 0;
      if (total > topEnemyDamage) {
        topEnemyDamage = total;
        topEnemyId = enemy.id;
      }
    }
    return {
      id: pc.id,
      name: pc.name,
      downProbability: downCount / completedCount,
      deathProbability: deathCount / completedCount,
      meanEndingHp,
      topContributingEnemyId: topEnemyId
    };
  });

  let totalDamageAllEnemies = 0;
  for (const value of damageByPair.values()) totalDamageAllEnemies += value;

  const perEnemy: PerEnemyAggregate[] = setup.enemies.map((enemy) => {
    let enemyTotal = 0;
    let topPcId: string | null = null;
    let topPcDamage = 0;
    for (const pc of setup.pcs) {
      const total = damageByPair.get(`${enemy.id}->${pc.id}`) ?? 0;
      enemyTotal += total;
      if (total > topPcDamage) {
        topPcDamage = total;
        topPcId = pc.id;
      }
    }
    return {
      id: enemy.id,
      name: enemy.name,
      damageShare: totalDamageAllEnemies > 0 ? enemyTotal / totalDamageAllEnemies : 0,
      topTargetId: topPcId
    };
  });

  let totalHeals = 0;
  let totalRecoveries = 0;
  let hpSurvivalIterations = 0;
  for (const r of results) {
    totalHeals += r.healsFired;
    totalRecoveries += r.recoveryChecksFired;
    if (r.heroPointSurvivalsFired > 0) hpSurvivalIterations += 1;
  }

  const anyPcDownProb = anyDownCount / completedCount;
  const tpkProb = tpkCount / completedCount;
  const meanFdr =
    firstDownRounds.length > 0
      ? firstDownRounds.reduce((a, b) => a + b, 0) / firstDownRounds.length
      : null;

  const roundCapRate = results.filter((r) => r.hitRoundCap).length / completedCount;
  const caveats = [...setup.caveats];
  if (roundCapRate > 0) {
    caveats.push(
      `${Math.round(roundCapRate * 100)}% of runs reached the ${config.maxRounds}-round cap and were cut off; risk may be understated for long fights.`
    );
  }

  const confidenceIntervals = buildConfidenceIntervals(
    anyDownCount,
    completedCount,
    tpkCount,
    firstDownRounds
  );

  return {
    iterationsRequested: config.iterations,
    iterationsCompleted: completedCount,
    seed,
    tacticsProfile: config.tacticsProfile,
    aborted,
    anyPcDownProbability: anyPcDownProb,
    tpkProbability: tpkProb,
    meanFirstDownRound: meanFdr,
    medianFirstDownRound: firstDownRounds.length > 0 ? median(firstDownRounds) : null,
    perPc,
    perEnemy,
    safetyNet: {
      meanHealsPerIteration: totalHeals / completedCount,
      meanRecoveryChecksPerIteration: totalRecoveries / completedCount,
      heroPointSurvivalRate: hpSurvivalIterations / completedCount
    },
    confidenceIntervals,
    roundCapRate,
    caveats,
    enemyStrikesPerTurn
  };
}

function buildConfidenceIntervals(
  anyPcDownCount: number,
  total: number,
  tpkCount: number,
  firstDownRounds: number[]
): SimulationConfidenceIntervals {
  const anyPcDown = proportionCI(anyPcDownCount, total);
  const tpk = proportionCI(tpkCount, total);

  let meanFdr: MeanConfidenceInterval | null = null;
  if (firstDownRounds.length > 0) {
    meanFdr = meanCI(firstDownRounds);
  }

  return { anyPcDown, tpk, meanFirstDownRound: meanFdr };
}
