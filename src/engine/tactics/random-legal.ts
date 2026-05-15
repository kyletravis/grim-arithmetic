import { DEFAULT_STRIKES_PER_TURN, type TacticsProfile, type TurnPlanStrike } from './tactics-types';
import { getStandingPcs } from './shared';

/**
 * Baseline tactics: pick any legal PC target and any attack independently
 * for each strike. Useful as the conservative comparison point — if even
 * random play produces high down rates, the encounter is structurally
 * dangerous, not just dangerous under optimal tactics.
 */
export const randomLegalTactics: TacticsProfile = {
  id: 'random-legal',
  description: 'Pick any legal PC target and any attack, independently per strike.',
  chooseTurn(context, rng) {
    const targets = getStandingPcs(context.pcs);
    if (targets.length === 0 || context.attacker.attacks.length === 0) {
      return { strikes: [] };
    }
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      const target = targets[rng.nextInt(0, targets.length - 1)];
      const attack = context.attacker.attacks[rng.nextInt(0, context.attacker.attacks.length - 1)];
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};
