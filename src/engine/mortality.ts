import { attackOutcomeProbabilities } from './attack-probability';
import { DamageDistribution, DamageOutcome, damageDistribution } from './dice';

export type MapType = 'normal' | 'agile' | 'none';

export interface DamageAdjustmentValue {
  type: string;
  value: number;
}

export interface DamageAdjustments {
  resistances: DamageAdjustmentValue[];
  weaknesses: DamageAdjustmentValue[];
  immunities: string[];
}

export interface DamageAdjustmentSummary {
  damageType: string;
  resistance: number;
  weakness: number;
  immune: boolean;
  note: string;
}

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
  damageType?: string;
  targetAdjustments?: DamageAdjustments;
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
  damageAdjustment: DamageAdjustmentSummary;
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
  const rawBaseDamage = damageDistribution(input.damageFormula);
  const rawCritDamage = doubleDistribution(rawBaseDamage);
  const damageAdjustment = buildDamageAdjustmentSummary(input.damageType, input.targetAdjustments);
  const baseDamage = applyDamageAdjustment(rawBaseDamage, damageAdjustment);
  const critDamage = applyDamageAdjustment(rawCritDamage, damageAdjustment);
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
      damageAdjustment.note,
      'Critical damage is modeled as simple double damage of the supported formula total.',
      `Enemy turn model: ${input.strikes} Strike${input.strikes === 1 ? '' : 's'}.`,
      `MAP model: ${input.mapType}.`
    ],
    notModeled: [
      'Deadly, fatal, precision, splash, and persistent damage.',
      'Reactions such as Shield Block or Champion reactions.',
      'Healing before or during the enemy turn.',
      'Permanent death probability.'
    ],
    damage: buildDamageSummary(baseDamage, critDamage),
    dyingSeverity,
    damageAdjustment
  };
}


export function buildDamageAdjustmentSummary(
  damageType: string | undefined,
  targetAdjustments: DamageAdjustments | undefined
): DamageAdjustmentSummary {
  const normalizedType = normalizeDamageType(damageType);
  const emptySummary: DamageAdjustmentSummary = {
    damageType: normalizedType ?? 'unknown',
    resistance: 0,
    weakness: 0,
    immune: false,
    note: 'Damage type unknown; no resistance, weakness, or immunity applied.'
  };

  if (!normalizedType) return emptySummary;

  const resistance = highestMatchingValue(targetAdjustments?.resistances ?? [], normalizedType);
  const weakness = highestMatchingValue(targetAdjustments?.weaknesses ?? [], normalizedType);
  const immune = (targetAdjustments?.immunities ?? []).some((type) => damageTypesMatch(type, normalizedType));

  if (immune) {
    return {
      damageType: normalizedType,
      resistance: 0,
      weakness: 0,
      immune: true,
      note: `Applied ${normalizedType} immunity; modeled damage is 0.`
    };
  }

  const parts: string[] = [];
  if (resistance > 0) parts.push(`${normalizedType} resistance ${resistance}`);
  if (weakness > 0) parts.push(`${normalizedType} weakness ${weakness}`);

  return {
    damageType: normalizedType,
    resistance,
    weakness,
    immune: false,
    note: parts.length > 0 ? `Applied ${joinAdjustmentParts(parts)}.` : `No ${normalizedType} resistance, weakness, or immunity matched.`
  };
}

function joinAdjustmentParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function applyDamageAdjustment(
  distribution: DamageDistribution,
  adjustment: DamageAdjustmentSummary
): DamageDistribution {
  const probabilities = new Map<number, number>();

  for (const outcome of distribution.outcomes) {
    const damage = adjustDamage(outcome.damage, adjustment);
    probabilities.set(damage, (probabilities.get(damage) ?? 0) + outcome.probability);
  }

  const outcomes = Array.from(probabilities.entries())
    .sort(([left], [right]) => left - right)
    .map(([damage, probability]) => ({ damage, probability }));
  const mean = outcomes.reduce((sum, outcome) => sum + outcome.damage * outcome.probability, 0);

  return {
    min: outcomes[0]?.damage ?? 0,
    max: outcomes.at(-1)?.damage ?? 0,
    mean,
    outcomes
  };
}

function adjustDamage(damage: number, adjustment: DamageAdjustmentSummary): number {
  if (adjustment.immune) return 0;
  return Math.max(0, damage - adjustment.resistance) + adjustment.weakness;
}

function highestMatchingValue(adjustments: DamageAdjustmentValue[], damageType: string): number {
  return adjustments.reduce((highest, adjustment) => {
    if (!damageTypesMatch(adjustment.type, damageType)) return highest;
    return Math.max(highest, adjustment.value);
  }, 0);
}

function damageTypesMatch(adjustmentType: string, damageType: string): boolean {
  const normalizedAdjustment = normalizeDamageType(adjustmentType);
  const normalizedDamage = normalizeDamageType(damageType);
  if (!normalizedAdjustment || !normalizedDamage) return false;
  if (normalizedAdjustment === normalizedDamage) return true;
  if (normalizedAdjustment === 'all') return true;
  if (normalizedAdjustment === 'physical') {
    return normalizedDamage === 'bludgeoning' || normalizedDamage === 'piercing' || normalizedDamage === 'slashing';
  }
  return false;
}

function normalizeDamageType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().toLowerCase().replace(/\s+/g, '-');
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

export function getMapPenalties(mapType: MapType): number[] {
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

export function doubleDistribution(distribution: DamageDistribution): DamageDistribution {
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
