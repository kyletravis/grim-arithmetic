import { damageDistribution } from '../dice';
import type { HealKind } from '../heal-actions';
import type { HealingState, SimulationCombatant } from '../simulation-types';
import { pickFirstAttack } from './shared';
import {
  DEFAULT_STRIKES_PER_TURN,
  type TacticsProfile,
  type TurnPlanHeal,
  type TurnPlanStrike
} from './tactics-types';

/**
 * Hardcoded PC tactics profile for v0.6.0-rc.4.
 *
 * Decision tree (highest priority first):
 *   1. **Emergency heal** — any standing PC ally is dying and this PC has
 *      healing capability. Spend the full turn on a 2-action heal of the
 *      most-injured dying ally. No strikes this round.
 *   2. **Top-up heal** — any ally is below 40% HP (and not dying). This PC
 *      heals with one action and strikes with the other. Target the
 *      lowest-HP non-dying ally.
 *   3. **Default** — 2 strikes at the most-dangerous standing enemy
 *      (rc.3 behavior).
 *
 * Healer selection within a turn is per-PC; cross-turn coordination is
 * emergent (PC1 heals an ally; PC2 re-evaluates and doesn't double-heal).
 *
 * Heal priority within a single PC's choice:
 *   Heal spell (2-action) > Heal cantrip (2-action) >
 *   Heal spell (1-action) > Heal cantrip (1-action) >
 *   Battle Medicine.
 * Battle Medicine cannot target a PC already healed by Battle Medicine
 * this iteration (per PF2e 1/target/day rule, approximated for the
 * single-encounter sim).
 *
 * Slot economy: heal-spell consumes the lowest-rank slot remaining.
 */
export const pcDefaultTactics: TacticsProfile = {
  id: 'random-legal',
  description:
    'PCs heal dying or low-HP allies when capable; otherwise 2 Strikes against the most-dangerous standing enemy.',
  chooseTurn(context) {
    const standingEnemies = context.enemies.filter((e) => !e.downed && !e.dead);
    const attacker = context.attacker;

    // Step 1: emergency heal — any ally is dying.
    const dyingAlly = pickPriorityDyingAlly(context.pcs);
    if (dyingAlly && canHeal(attacker.healing)) {
      const heal = planHeal(attacker, dyingAlly, 'emergency');
      if (heal) {
        return { strikes: [], heal };
      }
    }

    // Step 2: top-up heal — any ally is below 40% HP.
    const lowAlly = pickPriorityLowAlly(context.pcs, attacker);
    if (lowAlly && canHeal(attacker.healing)) {
      const heal = planHeal(attacker, lowAlly, 'topup');
      if (heal) {
        const attack = pickFirstAttack(attacker);
        if (attack && standingEnemies.length > 0) {
          const target = [...standingEnemies].sort(comparePcTargetPriority)[0];
          return {
            strikes: [{ attackId: attack.id, targetId: target.id, mapIndex: 0 }],
            heal
          };
        }
        return { strikes: [], heal };
      }
    }

    // Step 3: default 2-Strike behavior.
    if (standingEnemies.length === 0) return { strikes: [] };
    const attack = pickFirstAttack(attacker);
    if (!attack) return { strikes: [] };
    const target = [...standingEnemies].sort(comparePcTargetPriority)[0];
    const strikes: TurnPlanStrike[] = [];
    for (let i = 0; i < DEFAULT_STRIKES_PER_TURN; i += 1) {
      strikes.push({ attackId: attack.id, targetId: target.id, mapIndex: i as 0 | 1 | 2 });
    }
    return { strikes };
  }
};

function canHeal(healing: HealingState | undefined): boolean {
  if (!healing) return false;
  const hasSlot = Object.values(healing.healSpellSlotsRemaining).some((n) => n > 0);
  return hasSlot || healing.healCantripLevel !== null || healing.hasBattleMedicine;
}

function pickPriorityDyingAlly(pcs: readonly SimulationCombatant[]): SimulationCombatant | undefined {
  const dying = pcs.filter((c) => c.dying > 0 && !c.dead);
  if (dying.length === 0) return undefined;
  // Pick the ally closest to death threshold (highest dying value); ties by id.
  return [...dying].sort((a, b) => {
    if (b.dying !== a.dying) return b.dying - a.dying;
    return a.id < b.id ? -1 : 1;
  })[0];
}

function pickPriorityLowAlly(
  pcs: readonly SimulationCombatant[],
  attacker: SimulationCombatant
): SimulationCombatant | undefined {
  const low = pcs.filter(
    (c) => !c.downed && !c.dead && c.dying === 0 && c.hp.current < c.hp.max * 0.4
  );
  if (low.length === 0) return undefined;
  // Prefer healing others over self; pick lowest HP fraction; ties by id.
  return [...low].sort((a, b) => {
    const aSelf = a.id === attacker.id ? 1 : 0;
    const bSelf = b.id === attacker.id ? 1 : 0;
    if (aSelf !== bSelf) return aSelf - bSelf;
    const aFrac = a.hp.current / a.hp.max;
    const bFrac = b.hp.current / b.hp.max;
    if (aFrac !== bFrac) return aFrac - bFrac;
    return a.id < b.id ? -1 : 1;
  })[0];
}

function planHeal(
  healer: SimulationCombatant,
  target: SimulationCombatant,
  mode: 'emergency' | 'topup'
): TurnPlanHeal | undefined {
  const healing = healer.healing;
  if (!healing) return undefined;

  // Emergency: prefer 2-action heals (more healing). Top-up: prefer 1-action
  // heals so the PC can also Strike. Both fall through to Battle Medicine
  // last.
  const tryKinds: HealKind[] =
    mode === 'emergency'
      ? ['heal-spell-2action', 'heal-cantrip-2action', 'heal-spell-1action', 'heal-cantrip-1action', 'battle-medicine']
      : ['heal-spell-1action', 'heal-cantrip-1action', 'heal-spell-2action', 'heal-cantrip-2action', 'battle-medicine'];

  for (const kind of tryKinds) {
    if (kind === 'heal-spell-2action' || kind === 'heal-spell-1action' || kind === 'heal-spell-3action') {
      const rank = pickLowestSlotRank(healing.healSpellSlotsRemaining);
      if (rank !== undefined) {
        return { kind, healerId: healer.id, targetId: target.id, spellRank: rank };
      }
      continue;
    }
    if (kind === 'heal-cantrip-2action' || kind === 'heal-cantrip-1action') {
      if (healing.healCantripLevel !== null) {
        return { kind, healerId: healer.id, targetId: target.id };
      }
      continue;
    }
    if (kind === 'battle-medicine') {
      if (
        healing.hasBattleMedicine &&
        !healing.battleMedicineUsedTargets.has(target.id)
      ) {
        return { kind, healerId: healer.id, targetId: target.id };
      }
      continue;
    }
  }
  return undefined;
}

function pickLowestSlotRank(slots: Record<number, number>): number | undefined {
  const ranks = Object.keys(slots)
    .map((k) => Number(k))
    .filter((rank) => slots[rank] > 0)
    .sort((a, b) => a - b);
  return ranks[0];
}

function comparePcTargetPriority(a: SimulationCombatant, b: SimulationCombatant): number {
  const aThreat = enemyThreatScore(a);
  const bThreat = enemyThreatScore(b);
  if (aThreat !== bThreat) return bThreat - aThreat;
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
