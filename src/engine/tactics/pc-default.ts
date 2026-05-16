import { damageDistribution } from '../dice';
import type { SimulationCombatant } from '../simulation-types';
import { pickFirstAttack } from './shared';
import { DEFAULT_STRIKES_PER_TURN, type TacticsProfile, type TurnPlanStrike } from './tactics-types';

/**
 * Hardcoded PC tactics profile for v0.6.0-rc.3.
 *
 * Strategy: target the enemy whose primary attack has the highest mean
 * damage output — i.e., the actual threat to the party, not the lowest-HP
 * minion. PCs typically focus the most dangerous enemy first; the
 * focus-fire flavor of going after the weakest is more characteristically
 * an enemy behavior.
 *
 * Tiebreakers when multiple enemies tie on threat:
 *   1. Lower current HP wins (finish off the hurt one).
 *   2. Lower combatant id (deterministic).
 *
 * PCs take DEFAULT_STRIKES_PER_TURN strikes per turn (2). MAP escalates
 * normally based on the chosen attack's mapType. Turn is skipped cleanly
 * (returns { strikes: [] }) when no standing enemies remain or the PC has
 * no usable Strike.
 *
 * This profile is intentionally NOT registered in TACTICS_PROFILES (the
 * enemy-facing registry exposed through the Forecast UI dropdown). The
 * orchestrator consumes it directly via this export.
 */
export const pcDefaultTactics: TacticsProfile = {
  id: 'random-legal', // unused — orchestrator routes by side, not id; placeholder.
  description: 'PCs target the most-dangerous standing enemy with their primary Strike, twice per turn.',
  chooseTurn(context) {
    const standingEnemies = context.enemies.filter((enemy) => !enemy.downed && !enemy.dead);
    if (standingEnemies.length === 0) return { strikes: [] };

    const attack = pickFirstAttack(context.attacker);
    if (!attack) return { strikes: [] };

    const target = [...standingEnemies].sort(comparePcTargetPriority)[0];
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};

function comparePcTargetPriority(a: SimulationCombatant, b: SimulationCombatant): number {
  const aThreat = enemyThreatScore(a);
  const bThreat = enemyThreatScore(b);
  if (aThreat !== bThreat) return bThreat - aThreat; // descending threat
  if (a.hp.current !== b.hp.current) return a.hp.current - b.hp.current;
  return a.id < b.id ? -1 : 1;
}

function enemyThreatScore(enemy: SimulationCombatant): number {
  let highest = 0;
  for (const attack of enemy.attacks) {
    try {
      const mean = damageDistribution(attack.damageFormula).mean;
      if (mean > highest) highest = mean;
    } catch {
      // unparseable formula contributes 0 to threat score
    }
  }
  return highest;
}
