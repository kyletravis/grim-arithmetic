import type { HealKind } from '../heal-actions';
import type { Rng } from '../prng';
import type { SimulationCombatant, TacticsProfileId } from '../simulation-types';

/** A single Strike in a planned enemy turn. */
export interface TurnPlanStrike {
  attackId: string;
  targetId: string;
  /** 0, 1, or 2 — index of this strike within the turn for MAP calculation. */
  mapIndex: 0 | 1 | 2;
}

/** Optional heal action that runs before strikes in the same turn. */
export interface TurnPlanHeal {
  kind: HealKind;
  healerId: string;
  targetId: string;
  /** Heal spell rank if the heal consumes a slot. */
  spellRank?: number;
}

/** The plan an actor commits to at the start of its turn. */
export interface TurnPlan {
  strikes: TurnPlanStrike[];
  /** Heal action that fires before strikes; rc.4 PC tactics only. */
  heal?: TurnPlanHeal;
}

/** Per-call snapshot the orchestrator hands the profile to plan one turn. */
export interface TacticsContext {
  attacker: SimulationCombatant;
  pcs: readonly SimulationCombatant[];
  enemies: readonly SimulationCombatant[];
  round: number;
}

/** Pluggable enemy decision policy. */
export interface TacticsProfile {
  id: TacticsProfileId;
  description: string;
  chooseTurn(context: TacticsContext, rng: Rng): TurnPlan;
}

/** v0.6.0 default: each enemy takes 2 Strikes per turn under normal MAP. */
export const DEFAULT_STRIKES_PER_TURN = 2;
