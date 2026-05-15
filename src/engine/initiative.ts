import type { Rng } from './prng';
import type { SimulationCombatant } from './simulation-types';

/** One combatant's slot in the rolled turn order. */
export interface InitiativeEntry {
  combatantId: string;
  side: 'pc' | 'enemy';
  /** The d20 face that came up. 0 if useFixedOrder was set. */
  dieRoll: number;
  /** The initiative bonus added to the die. */
  bonus: number;
  /** dieRoll + bonus. */
  total: number;
}

export interface InitiativeOptions {
  /**
   * When true, skip rolling and return combatants in the input order with
   * dieRoll: 0. Useful when mirroring an existing Foundry combat tracker.
   */
  useFixedOrder?: boolean;
  /**
   * Tiebreaker side. In PF2e, PCs win initiative ties by default; pass false
   * to invert. Defaults to true.
   */
  pcsWinTies?: boolean;
}

/**
 * Seeded initiative roll for all combatants.
 *
 * Each combatant rolls d20 + initiativeBonus. Ties break first by side
 * (configurable via pcsWinTies), then by combatant id (asc) for full
 * determinism. The returned list is sorted highest-to-lowest by total.
 *
 * Note: delay / ready actions and surprise rounds are not modeled in v0.6.0;
 * the runner uses the rolled order as-is for every round of the iteration.
 */
export function rollInitiative(
  combatants: SimulationCombatant[],
  rng: Rng,
  options: InitiativeOptions = {}
): InitiativeEntry[] {
  if (options.useFixedOrder) {
    return combatants.map((combatant) => ({
      combatantId: combatant.id,
      side: combatant.side,
      dieRoll: 0,
      bonus: combatant.initiativeBonus,
      total: combatant.initiativeBonus
    }));
  }

  const pcsWinTies = options.pcsWinTies ?? true;

  const entries: InitiativeEntry[] = combatants.map((combatant) => {
    const dieRoll = rng.nextInt(1, 20);
    return {
      combatantId: combatant.id,
      side: combatant.side,
      dieRoll,
      bonus: combatant.initiativeBonus,
      total: dieRoll + combatant.initiativeBonus
    };
  });

  entries.sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total;
    if (left.side !== right.side) {
      if (left.side === 'pc') return pcsWinTies ? -1 : 1;
      return pcsWinTies ? 1 : -1;
    }
    return left.combatantId < right.combatantId ? -1 : 1;
  });

  return entries;
}
