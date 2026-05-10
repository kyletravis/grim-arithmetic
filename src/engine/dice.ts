export interface DamageOutcome {
  damage: number;
  probability: number;
}

export interface DamageDistribution {
  min: number;
  max: number;
  mean: number;
  outcomes: DamageOutcome[];
}

export function averageDamage(formula: string): number {
  return damageDistribution(formula).mean;
}

export function damageDistribution(formula: string): DamageDistribution {
  const normalized = normalizeFormula(formula);
  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];
  let states = new Map<number, number>([[0, 1]]);

  for (const term of terms) {
    states = convolve(states, termDistribution(term));
  }

  return summarizeDistribution(states, formula);
}

function normalizeFormula(formula: string): string {
  const normalized = formula.replace(/\s+/g, '');

  if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(normalized)) {
    throw new Error(`Unsupported damage formula: ${formula}`);
  }

  return normalized;
}

function termDistribution(term: string): Map<number, number> {
  const sign = term.startsWith('-') ? -1 : 1;
  const unsigned = term.replace(/^[+-]/, '');
  const diceMatch = unsigned.match(/^(\d+)d(\d+)$/);

  if (!diceMatch) {
    return new Map([[sign * Number(unsigned), 1]]);
  }

  const count = Number(diceMatch[1]);
  const faces = Number(diceMatch[2]);
  if (!Number.isInteger(count) || !Number.isInteger(faces) || count < 1 || faces < 1) {
    throw new Error(`Unsupported damage term: ${term}`);
  }

  let states = new Map<number, number>([[0, 1]]);
  const dieOutcomes = new Map<number, number>();
  for (let face = 1; face <= faces; face += 1) {
    dieOutcomes.set(sign * face, 1 / faces);
  }

  for (let die = 0; die < count; die += 1) {
    states = convolve(states, dieOutcomes);
  }

  return states;
}

function convolve(left: Map<number, number>, right: Map<number, number>): Map<number, number> {
  const result = new Map<number, number>();

  for (const [leftDamage, leftProbability] of left) {
    for (const [rightDamage, rightProbability] of right) {
      const damage = leftDamage + rightDamage;
      result.set(damage, (result.get(damage) ?? 0) + leftProbability * rightProbability);
    }
  }

  return result;
}

function summarizeDistribution(states: Map<number, number>, formula: string): DamageDistribution {
  const outcomes = Array.from(states.entries())
    .map(([damage, probability]) => ({ damage, probability }))
    .sort((a, b) => a.damage - b.damage);

  if (outcomes.length === 0) {
    throw new Error(`Unsupported damage formula: ${formula}`);
  }

  const totalProbability = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  if (totalProbability <= 0) {
    throw new Error(`Unsupported damage formula: ${formula}`);
  }

  const mean = outcomes.reduce((sum, outcome) => sum + outcome.damage * outcome.probability, 0);

  return {
    min: outcomes[0].damage,
    max: outcomes[outcomes.length - 1].damage,
    mean,
    outcomes
  };
}
