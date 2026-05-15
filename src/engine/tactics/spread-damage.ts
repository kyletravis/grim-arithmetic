import { DEFAULT_STRIKES_PER_TURN, type TacticsProfile, type TurnPlanStrike } from './tactics-types';
import { getStandingPcs, pickFirstAttack } from './shared';

/**
 * Distributes strikes across different standing PCs, preferring higher-HP
 * targets so a low-HP PC is not piled on. Never targets a downed PC.
 *
 * Algorithm: sort standing PCs by current HP descending; assign strike i
 * to position i (wrap-around if there are fewer standing PCs than strikes).
 */
export const spreadDamageTactics: TacticsProfile = {
  id: 'spread-damage',
  description: 'Distribute strikes across higher-HP standing PCs; never target downed.',
  chooseTurn(context) {
    const targets = getStandingPcs(context.pcs);
    if (targets.length === 0) return { strikes: [] };
    const attack = pickFirstAttack(context.attacker);
    if (!attack) return { strikes: [] };
    const sorted = [...targets].sort((a, b) => {
      if (b.hp.current !== a.hp.current) return b.hp.current - a.hp.current;
      return a.id < b.id ? -1 : 1;
    });
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      const target = sorted[i % sorted.length];
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};
