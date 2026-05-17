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

const BUDGET = {
  maxFormulaLength: 256,
  maxTerms: 20,
  maxDicePerTerm: 100,
  maxDieFaces: 1000,
  maxTotalDice: 500,
  maxOutcomes: 50000
} as const;

function budgetExceeded(reason: string): Error {
  return new Error(`Dice formula rejected: ${reason}`);
}

export function averageDamage(formula: string): number {
  return damageDistribution(formula).mean;
}

export function damageDistribution(formula: string): DamageDistribution {
  const normalized = normalizeFormula(formula);
  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];

  if (terms.length > BUDGET.maxTerms) {
    throw budgetExceeded(`too many terms (${terms.length} exceeds ${BUDGET.maxTerms})`);
  }

  let totalDice = 0;
  for (const term of terms) {
    const diceMatch = term.replace(/^[+-]/, '').match(/^(\d+)d(\d+)$/);
    if (diceMatch) {
      const count = Number(diceMatch[1]);
      if (count > BUDGET.maxDicePerTerm) {
        throw budgetExceeded(`term ${term} has ${count} dice (max ${BUDGET.maxDicePerTerm})`);
      }
      totalDice += count;
    }
  }

  if (totalDice > BUDGET.maxTotalDice) {
    throw budgetExceeded(`too many total dice (${totalDice} exceeds ${BUDGET.maxTotalDice})`);
  }

  let states = new Map<number, number>([[0, 1]]);

  for (const term of terms) {
    const termStates = termDistribution(term);
    if (termStates.size > BUDGET.maxOutcomes) {
      throw budgetExceeded(`term ${term} produced ${termStates.size} outcomes (max ${BUDGET.maxOutcomes})`);
    }
    states = convolve(states, termStates);
    if (states.size > BUDGET.maxOutcomes) {
      throw budgetExceeded(`convolution produced ${states.size} outcomes (max ${BUDGET.maxOutcomes})`);
    }
  }

  return summarizeDistribution(states, formula);
}

function normalizeFormula(formula: string): string {
  if (formula.length > BUDGET.maxFormulaLength) {
    throw budgetExceeded(`formula length ${formula.length} exceeds ${BUDGET.maxFormulaLength}`);
  }

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

  if (faces > BUDGET.maxDieFaces) {
    throw budgetExceeded(`term ${term} has ${faces} faces (max ${BUDGET.maxDieFaces})`);
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
