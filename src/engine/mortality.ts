import { attackOutcomeProbabilities } from './attack-probability';
import { averageDamage } from './dice';

export type MapType = 'normal' | 'agile' | 'none';

export interface ImmediateDownRiskInput {
  hp: number;
  ac: number;
  attackBonus: number;
  damageFormula: string;
  strikes: 1 | 2 | 3;
  mapType: MapType;
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
}

export function immediateDownRisk(input: ImmediateDownRiskInput): ImmediateDownRiskResult {
  const baseDamage = averageDamage(input.damageFormula);
  const mapPenalties = getMapPenalties(input.mapType).slice(0, input.strikes);
  const hitChanceByStrike: number[] = [];
  const critChanceByStrike: number[] = [];

  let expectedDamage = 0;
  let survivalProbability = 1;

  for (const penalty of mapPenalties) {
    const outcome = attackOutcomeProbabilities({
      attackBonus: input.attackBonus + penalty,
      ac: input.ac
    });

    hitChanceByStrike.push(outcome.success);
    critChanceByStrike.push(outcome.criticalSuccess);

    const hitDamage = baseDamage;
    const critDamage = baseDamage * 2;
    expectedDamage += outcome.success * hitDamage + outcome.criticalSuccess * critDamage;

    const downChanceThisStrike =
      (hitDamage >= input.hp ? outcome.success : 0) +
      (critDamage >= input.hp ? outcome.criticalSuccess : 0);

    survivalProbability *= 1 - downChanceThisStrike;
  }

  const downProbability = clampProbability(1 - survivalProbability);
  const expectedHpAfterTurn = Math.max(0, input.hp - expectedDamage);

  return {
    downProbability,
    expectedHpAfterTurn,
    hitChanceByStrike,
    critChanceByStrike,
    riskLabel: riskLabel(downProbability),
    topRiskDrivers: buildRiskDrivers(downProbability, critChanceByStrike),
    assumptions: [
      'Uses average damage, not full dice distribution.',
      'Critical damage is modeled as simple double damage.',
      `Enemy turn model: ${input.strikes} Strike${input.strikes === 1 ? '' : 's'}.`,
      `MAP model: ${input.mapType}.`
    ],
    notModeled: [
      'Resistance, weakness, and immunity.',
      'Deadly, fatal, precision, splash, and persistent damage.',
      'Reactions such as Shield Block or Champion reactions.',
      'Healing before or during the enemy turn.',
      'Permanent death probability.'
    ]
  };
}

function getMapPenalties(mapType: MapType): number[] {
  if (mapType === 'agile') return [0, -4, -8];
  if (mapType === 'none') return [0, 0, 0];
  return [0, -5, -10];
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

function buildRiskDrivers(downProbability: number, critChanceByStrike: number[]): string[] {
  if (downProbability === 0) return ['No average hit or crit in the selected sequence downs the PC.'];

  const highestCrit = Math.max(...critChanceByStrike);
  return [
    `Down risk is primarily crit-driven; highest strike crit chance is ${Math.round(highestCrit * 100)}%.`
  ];
}
