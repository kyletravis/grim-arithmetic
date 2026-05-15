import type { AttackSnapshot } from '../../systems/base-adapter';
import { damageDistribution } from '../dice';
import type { SimulationCombatant } from '../simulation-types';

/** A combatant is "standing" when not downed and not dead. */
export function isStanding(combatant: SimulationCombatant): boolean {
  return !combatant.downed && !combatant.dead;
}

/** Standing PCs eligible as the default legal-target pool. */
export function getStandingPcs(
  pcs: readonly SimulationCombatant[]
): readonly SimulationCombatant[] {
  return pcs.filter(isStanding);
}

/** PCs that are downed or otherwise still in play (not dead). */
export function getNonDeadPcs(
  pcs: readonly SimulationCombatant[]
): readonly SimulationCombatant[] {
  return pcs.filter((pc) => !pc.dead);
}

/**
 * Pick the attack with the highest mean damage. Falls back to the first
 * attack if none have parseable damage formulas. Returns undefined when
 * the attacker has no attacks at all.
 */
export function pickHighestDamageAttack(
  attacker: SimulationCombatant
): AttackSnapshot | undefined {
  if (attacker.attacks.length === 0) return undefined;
  let best = attacker.attacks[0];
  let bestMean = safeMeanDamage(best.damageFormula);
  for (let i = 1; i < attacker.attacks.length; i += 1) {
    const candidate = attacker.attacks[i];
    const mean = safeMeanDamage(candidate.damageFormula);
    if (mean > bestMean) {
      bestMean = mean;
      best = candidate;
    }
  }
  return best;
}

/** First attack on the attacker. Undefined when the attacker has none. */
export function pickFirstAttack(attacker: SimulationCombatant): AttackSnapshot | undefined {
  return attacker.attacks[0];
}

function safeMeanDamage(formula: string): number {
  try {
    return damageDistribution(formula).mean;
  } catch {
    return -Infinity;
  }
}
