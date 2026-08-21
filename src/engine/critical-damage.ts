import { combineDistributions, damageDistribution, type DamageDistribution } from './dice';
import { doubleDistribution } from './mortality-double';

export interface CritTraits {
  deadlyDie?: number;
  /** Number of deadly dice: 1, or 2 with greater striking (3 weapon dice), 3 with major striking (4+). */
  deadlyDice: number;
  fatalDie?: number;
}

const DEADLY = /^deadly-d(\d+)$/;
const FATAL = /^fatal-d(\d+)$/;

export function parseCritTraits(traits: string[], weaponDiceCount: number): CritTraits {
  const result: CritTraits = { deadlyDice: 0 };
  for (const trait of traits) {
    const deadly = trait.match(DEADLY);
    if (deadly) {
      result.deadlyDie = Number(deadly[1]);
      result.deadlyDice = weaponDiceCount >= 4 ? 3 : weaponDiceCount === 3 ? 2 : 1;
    }
    const fatal = trait.match(FATAL);
    if (fatal) result.fatalDie = Number(fatal[1]);
  }
  return result;
}

/** Count and faces of the first dice term (the weapon dice) in a normalized additive formula. */
function weaponDiceTerm(
  formula: string
): { count: number; faces: number; term: string } | undefined {
  const match = formula.replace(/\s+/g, '').match(/(\d+)d(\d+)/);
  if (!match) return undefined;
  return { count: Number(match[1]), faces: Number(match[2]), term: match[0] };
}

export function criticalDistribution(formula: string, traits: string[] = []): DamageDistribution {
  const weapon = weaponDiceTerm(formula);
  const crit = parseCritTraits(traits, weapon?.count ?? 1);
  let baseFormula = formula;
  if (crit.fatalDie && weapon) {
    baseFormula = formula.replace(weapon.term, `${weapon.count}d${crit.fatalDie}`);
  }
  let result = doubleDistribution(damageDistribution(baseFormula));
  if (crit.fatalDie)
    result = combineDistributions(result, damageDistribution(`1d${crit.fatalDie}`));
  if (crit.deadlyDie && crit.deadlyDice > 0) {
    result = combineDistributions(
      result,
      damageDistribution(`${crit.deadlyDice}d${crit.deadlyDie}`)
    );
  }
  return result;
}

export function describeCritModel(formula: string, traits: string[]): string {
  const weapon = weaponDiceTerm(formula);
  const crit = parseCritTraits(traits, weapon?.count ?? 1);
  const parts: string[] = [];
  if (crit.fatalDie) {
    parts.push(
      `fatal d${crit.fatalDie} (weapon die becomes d${crit.fatalDie}, +1d${crit.fatalDie} after doubling)`
    );
  }
  if (crit.deadlyDie) {
    parts.push(`deadly d${crit.deadlyDie} (+${crit.deadlyDice}d${crit.deadlyDie} after doubling)`);
  }
  if (parts.length === 0) {
    return 'Critical damage is modeled as simple double damage of the supported formula total.';
  }
  return `Critical damage is modeled as double damage plus ${parts.join(' and ')}.`;
}
