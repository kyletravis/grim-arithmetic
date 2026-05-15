import { DEFAULT_STRIKES_PER_TURN, type TacticsProfile, type TurnPlanStrike } from './tactics-types';
import { getStandingPcs, pickFirstAttack, pickHighestDamageAttack } from './shared';

/**
 * Boss leans into its signature attack: pick the highest-mean-damage attack
 * and use it for every strike against the same target, taking the MAP hit
 * on follow-ups. Targets the highest-HP standing PC (the "tank") to evoke
 * the cinematic boss-vs-frontline matchup.
 *
 * Tiebreakers on equal HP: id ascending.
 */
export const bossCinematicTactics: TacticsProfile = {
  id: 'boss-cinematic',
  description: "Use the highest-damage attack on the toughest standing PC, all strikes on the same target.",
  chooseTurn(context) {
    const targets = getStandingPcs(context.pcs);
    if (targets.length === 0) return { strikes: [] };
    const target = [...targets].sort((a, b) => {
      if (b.hp.current !== a.hp.current) return b.hp.current - a.hp.current;
      return a.id < b.id ? -1 : 1;
    })[0];
    const attack = pickHighestDamageAttack(context.attacker) ?? pickFirstAttack(context.attacker);
    if (!attack) return { strikes: [] };
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};
