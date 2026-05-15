import { DEFAULT_STRIKES_PER_TURN, type TacticsProfile, type TurnPlanStrike } from './tactics-types';
import { getStandingPcs, pickFirstAttack } from './shared';

/**
 * Concentrates all strikes on the standing PC with the lowest current HP.
 * Models the classic "kill the wounded one first" enemy behavior.
 *
 * Tiebreaker: lower id wins when current HP is equal (determinism).
 */
export const focusFireTactics: TacticsProfile = {
  id: 'focus-fire',
  description: 'Concentrate every strike on the standing PC with the lowest current HP.',
  chooseTurn(context) {
    const targets = getStandingPcs(context.pcs);
    if (targets.length === 0) return { strikes: [] };
    const attack = pickFirstAttack(context.attacker);
    if (!attack) return { strikes: [] };
    const target = [...targets].sort((a, b) => {
      if (a.hp.current !== b.hp.current) return a.hp.current - b.hp.current;
      return a.id < b.id ? -1 : 1;
    })[0];
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};
