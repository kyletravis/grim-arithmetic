import { attackOutcomeProbabilities } from './attack-probability';
import { DamageDistribution, DamageOutcome, damageDistribution } from './dice';

export type MapType = 'normal' | 'agile' | 'none';

export interface ImmediateDownRiskInput {
  hp: number;
  ac: number;
  attackBonus: number;
  damageFormula: string;
  strikes: 1 | 2 | 3;
  mapType: MapType;
  wounded?: number;
  doomed?: number;
  assumeHeroPointAvailable?: boolean;
}

export interface DamageSummary {
  min: number;
  max: number;
  average: string;
  critMin: number;
  critMax: number;
  swinginess: string;
}

export interface ImmediateDownRiskResult {
  downProbability: number;
  expectedHpAfterTurn: number;
  hitChanceByStrike: number[];
  critChanceByStrike: number[];
  riskLabel: 'Low' | 'Guarded' | 'Dangerous' | 'Severe' | 'Grim';
  topRiskDrivers: string[];
  assumptions: string[];
  notModeled: string[];
  damage: DamageSummary;
  dyingSeverity: DyingSeverity;
}

export interface DyingSeverity {
  wounded: number;
  doomed: number;
  deathThreshold: number;
  normalDownDying: number;
  critDownDying: number;
  immediateDeathFlag: string;
  heroPointNote: string;
}

export function immediateDownRisk(input: ImmediateDownRiskInput): ImmediateDownRiskResult {
  const baseDamage = damageDistribution(input.damageFormula);
  const critDamage = doubleDistribution(baseDamage);
  const mapPenalties = getMapPenalties(input.mapType).slice(0, input.strikes);
  const hitChanceByStrike: number[] = [];
  const critChanceByStrike: number[] = [];

  let expectedDamage = 0;
  let directHitDownProbability = 0;
  let directCritDownProbability = 0;
  let damageStates = new Map<number, number>([[0, 1]]);

  for (const penalty of mapPenalties) {
    const outcome = attackOutcomeProbabilities({
      attackBonus: input.attackBonus + penalty,
      ac: input.ac
    });

    hitChanceByStrike.push(outcome.success);
    critChanceByStrike.push(outcome.criticalSuccess);

    const missProbability = outcome.failure + outcome.criticalFailure;
    expectedDamage += outcome.success * baseDamage.mean + outcome.criticalSuccess * critDamage.mean;
    directHitDownProbability += outcome.success * probabilityAtLeast(baseDamage.outcomes, input.hp);
    directCritDownProbability += outcome.criticalSuccess * probabilityAtLeast(critDamage.outcomes, input.hp);

    damageStates = expandDamageStates(damageStates, [
      { damage: 0, probability: missProbability },
      ...scaleOutcomes(baseDamage.outcomes, outcome.success),
      ...scaleOutcomes(critDamage.outcomes, outcome.criticalSuccess)
    ]);
  }

  const downProbability = clampProbability(sumDownProbability(damageStates, input.hp));
  const expectedHpAfterTurn = Math.max(0, input.hp - expectedDamage);
  const dyingSeverity = buildDyingSeverity({
    wounded: input.wounded ?? 0,
    doomed: input.doomed ?? 0,
    assumeHeroPointAvailable: input.assumeHeroPointAvailable ?? false
  });

  return {
    downProbability,
    expectedHpAfterTurn,
    hitChanceByStrike,
    critChanceByStrike,
    riskLabel: riskLabel(downProbability),
    topRiskDrivers: buildRiskDrivers({
      downProbability,
      hitDownProbability: directHitDownProbability,
      critDownProbability: directCritDownProbability,
      highestCritChance: Math.max(...critChanceByStrike)
    }),
    assumptions: [
      'Uses exact damage distributions for supported formulas.',
      'Critical damage is modeled as simple double damage of the supported formula total.',
      `Enemy turn model: ${input.strikes} Strike${input.strikes === 1 ? '' : 's'}.`,
      `MAP model: ${input.mapType}.`
    ],
    notModeled: [
      'Resistance, weakness, and immunity.',
      'Deadly, fatal, precision, splash, and persistent damage.',
      'Reactions such as Shield Block or Champion reactions.',
      'Healing before or during the enemy turn.',
      'Permanent death probability.'
    ],
    damage: buildDamageSummary(baseDamage, critDamage),
    dyingSeverity
  };
}

function buildDyingSeverity({
  wounded,
  doomed,
  assumeHeroPointAvailable
}: {
  wounded: number;
  doomed: number;
  assumeHeroPointAvailable: boolean;
}): DyingSeverity {
  const normalizedWounded = Math.max(0, Math.floor(wounded));
  const normalizedDoomed = Math.max(0, Math.floor(doomed));
  const deathThreshold = Math.max(1, 4 - normalizedDoomed);
  const normalDownDying = 1 + normalizedWounded;
  const critDownDying = 2 + normalizedWounded;

  return {
    wounded: normalizedWounded,
    doomed: normalizedDoomed,
    deathThreshold,
    normalDownDying,
    critDownDying,
    immediateDeathFlag: describeImmediateDeathFlag({ normalDownDying, critDownDying, deathThreshold }),
    heroPointNote: assumeHeroPointAvailable
      ? 'Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability.'
      : 'No Hero Point death-prevention assumption is applied.'
  };
}

function describeImmediateDeathFlag({
  normalDownDying,
  critDownDying,
  deathThreshold
}: {
  normalDownDying: number;
  critDownDying: number;
  deathThreshold: number;
}): string {
  if (normalDownDying >= deathThreshold) {
    return `Normal down would reach Dying ${normalDownDying}, meeting or exceeding the doomed-adjusted death threshold (Dying ${deathThreshold}).`;
  }
  if (critDownDying >= deathThreshold) {
    return `Crit-down would reach Dying ${critDownDying}, meeting or exceeding the doomed-adjusted death threshold (Dying ${deathThreshold}).`;
  }
  if (critDownDying === deathThreshold - 1) {
    return `Crit-down would put this PC at Dying ${critDownDying}, one step below the doomed-adjusted death threshold (Dying ${deathThreshold}).`;
  }
  return `If downed, severity would be Dying ${normalDownDying} on a normal hit or Dying ${critDownDying} on a critical hit.`;
}

function getMapPenalties(mapType: MapType): number[] {
  if (mapType === 'agile') return [0, -4, -8];
  if (mapType === 'none') return [0, 0, 0];
  return [0, -5, -10];
}

interface DamageBranch {
  damage: number;
  probability: number;
}

function expandDamageStates(
  currentStates: Map<number, number>,
  branches: DamageBranch[]
): Map<number, number> {
  const nextStates = new Map<number, number>();

  for (const [damageSoFar, stateProbability] of currentStates) {
    for (const branch of branches) {
      if (branch.probability === 0) continue;

      const nextDamage = damageSoFar + branch.damage;
      const nextProbability = stateProbability * branch.probability;
      nextStates.set(nextDamage, (nextStates.get(nextDamage) ?? 0) + nextProbability);
    }
  }

  return nextStates;
}

function scaleOutcomes(outcomes: DamageOutcome[], branchProbability: number): DamageBranch[] {
  if (branchProbability === 0) return [];
  return outcomes.map((outcome) => ({
    damage: outcome.damage,
    probability: outcome.probability * branchProbability
  }));
}

function doubleDistribution(distribution: DamageDistribution): DamageDistribution {
  return {
    min: distribution.min * 2,
    max: distribution.max * 2,
    mean: distribution.mean * 2,
    outcomes: distribution.outcomes.map((outcome) => ({
      damage: outcome.damage * 2,
      probability: outcome.probability
    }))
  };
}

function probabilityAtLeast(outcomes: DamageOutcome[], threshold: number): number {
  return outcomes.reduce((sum, outcome) => sum + (outcome.damage >= threshold ? outcome.probability : 0), 0);
}

function sumDownProbability(damageStates: Map<number, number>, hp: number): number {
  let probability = 0;

  for (const [damage, stateProbability] of damageStates) {
    if (damage >= hp) probability += stateProbability;
  }

  return probability;
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function riskLabel(probability: number): ImmediateDownRiskResult['riskLabel'] {
  if (probability < 0.05) return 'Low';
  if (probability < 0.15) return 'Guarded';
  if (probability < 0.35) return 'Dangerous';
  if (probability < 0.6) return 'Severe';
  return 'Grim';
}

function buildRiskDrivers({
  downProbability,
  hitDownProbability,
  critDownProbability,
  highestCritChance
}: {
  downProbability: number;
  hitDownProbability: number;
  critDownProbability: number;
  highestCritChance: number;
}): string[] {
  if (downProbability === 0) return ['No exact supported hit or crit damage roll in the selected sequence downs the PC.'];

  if (hitDownProbability === 0 && critDownProbability > 0 && critDownProbability < highestCritChance) {
    return ['Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage.'];
  }

  if (hitDownProbability === 0 && critDownProbability > 0) {
    return [`Down risk is crit-driven; highest strike crit chance is ${Math.round(highestCritChance * 100)}%.`];
  }

  return ['Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence.'];
}

function buildDamageSummary(baseDamage: DamageDistribution, critDamage: DamageDistribution): DamageSummary {
  const average = baseDamage.mean.toFixed(1);
  return {
    min: baseDamage.min,
    max: baseDamage.max,
    average,
    critMin: critDamage.min,
    critMax: critDamage.max,
    swinginess: describeSwinginess(baseDamage, average)
  };
}

function describeSwinginess(distribution: DamageDistribution, average: string): string {
  const inclusiveRange = distribution.max - distribution.min + 1;
  if (inclusiveRange >= distribution.mean) {
    return `High swing: damage range is ${inclusiveRange} around an average of ${average}.`;
  }
  return `Moderate swing: damage range is ${inclusiveRange} around an average of ${average}.`;
}
