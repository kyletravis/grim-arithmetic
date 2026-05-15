import type { SimulationCombatant } from '../simulation-types';
import { DEFAULT_STRIKES_PER_TURN, type TacticsProfile, type TurnPlanStrike } from './tactics-types';
import { getNonDeadPcs, getStandingPcs, pickFirstAttack } from './shared';

/**
 * Prioritizes already-wounded PCs over fresh ones. Models monsters with
 * "hunt the weak" lore. Will attack a downed target only if no standing
 * PCs remain (last-resort cleanup so dying spirals can resolve).
 *
 * Priority order on the standing list:
 *   1. Highest current wounded value.
 *   2. Lowest current HP.
 *   3. Id ascending (tiebreak).
 */
export const predatorTactics: TacticsProfile = {
  id: 'predator',
  description: 'Prioritize wounded > low-HP > full-HP PCs; attack downed only if no standing PCs remain.',
  chooseTurn(context) {
    const standing = getStandingPcs(context.pcs);
    let pool: readonly SimulationCombatant[];
    if (standing.length > 0) {
      pool = [...standing].sort(comparePredatorPriority);
    } else {
      pool = getNonDeadPcs(context.pcs);
    }
    if (pool.length === 0) return { strikes: [] };
    const attack = pickFirstAttack(context.attacker);
    if (!attack) return { strikes: [] };
    const target = pool[0];
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};

function comparePredatorPriority(a: SimulationCombatant, b: SimulationCombatant): number {
  if (b.wounded !== a.wounded) return b.wounded - a.wounded;
  if (a.hp.current !== b.hp.current) return a.hp.current - b.hp.current;
  return a.id < b.id ? -1 : 1;
}
