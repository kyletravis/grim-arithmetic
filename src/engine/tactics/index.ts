import type { TacticsProfileId } from '../simulation-types';
import { bossCinematicTactics } from './boss-cinematic';
import { focusFireTactics } from './focus-fire';
import { predatorTactics } from './predator';
import { randomLegalTactics } from './random-legal';
import { spreadDamageTactics } from './spread-damage';
import type { TacticsProfile } from './tactics-types';

/** Registry of v0.6.0 tactics profiles keyed by TacticsProfileId. */
export const TACTICS_PROFILES: Record<TacticsProfileId, TacticsProfile> = {
  'random-legal': randomLegalTactics,
  'spread-damage': spreadDamageTactics,
  'focus-fire': focusFireTactics,
  predator: predatorTactics,
  'boss-cinematic': bossCinematicTactics
};

export type {
  TacticsContext,
  TacticsProfile,
  TurnPlan,
  TurnPlanStrike
} from './tactics-types';
export { DEFAULT_STRIKES_PER_TURN } from './tactics-types';
