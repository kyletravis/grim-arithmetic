import { rollInitiative } from './initiative';
import { getMapPenalties } from './mortality';
import type { Rng } from './prng';
import { sampleRecoveryCheck } from './sample-recovery';
import { sampleStrike } from './sample-strike';
import { applyDamage, deathThresholdFor } from './sim-state';
import type {
  EncounterSetup,
  IterationResult,
  PerCombatantOutcome,
  RoundEvent,
  SimulationCombatant,
  SimulationConfig
} from './simulation-types';
import { TACTICS_PROFILES } from './tactics';
import { pcDefaultTactics } from './tactics/pc-default';
import type { TacticsProfile } from './tactics/tactics-types';

export interface RunIterationOptions {
  /** When true, initiative is taken in input order (no RNG consumed). */
  useFixedInitiative?: boolean;
}

/**
 * Run a single encounter iteration to termination.
 *
 *  - Initiative is rolled once at the start using the seeded RNG.
 *  - Each round walks the initiative order. PCs take a no-op turn in v0.6.0
 *    (the conservative baseline; PC actions are deferred to v0.7.0+).
 *  - Each enemy turn asks the configured tactics profile for a TurnPlan,
 *    then resolves each strike via the sample-strike + apply-damage path.
 *  - The plan is committed when the turn starts; a strike that lands on
 *    an already-downed (but not dead) target still increments dying.
 *  - Termination: all PCs downed (TPK), all enemies dead, or maxRounds hit.
 *
 * Same setup + same config + same seed -> byte-identical IterationResult.
 */
export function runIteration(
  setup: EncounterSetup,
  config: SimulationConfig,
  rng: Rng,
  iterationIndex = 0,
  options: RunIterationOptions = {}
): IterationResult {
  const combatants = new Map<string, SimulationCombatant>();
  const startingPool = new Map<string, number>();
  for (const pc of setup.pcs) {
    combatants.set(pc.id, cloneCombatant(pc));
    startingPool.set(pc.id, pc.hp.current + pc.hp.temp);
  }
  for (const enemy of setup.enemies) {
    combatants.set(enemy.id, cloneCombatant(enemy));
    startingPool.set(enemy.id, enemy.hp.current + enemy.hp.temp);
  }

  const allCombatants = Array.from(combatants.values());
  const order = rollInitiative(allCombatants, rng, {
    useFixedOrder: options.useFixedInitiative
  });

  const enemyTactics = TACTICS_PROFILES[config.tacticsProfile];
  const pcTactics: TacticsProfile = pcDefaultTactics;
  const damageByPair: Record<string, number> = {};
  const events: RoundEvent[] = [];
  let firstDownRound: number | null = null;
  let roundsElapsed = 0;

  let recoveryChecksFired = 0;

  for (let round = 1; round <= config.maxRounds; round += 1) {
    roundsElapsed = round;

    for (const slot of order) {
      const actor = combatants.get(slot.combatantId);
      if (!actor || actor.dead) continue;

      // PF2e recovery check: a dying PC rolls at the start of their turn.
      // Crit-success / success may stabilize them out of dying; crit-failure
      // may push them to dead.
      if (actor.side === 'pc' && actor.dying > 0) {
        const recovery = sampleRecoveryCheck(actor, rng);
        recoveryChecksFired += 1;
        const threshold = deathThresholdFor(actor);
        const recovered: SimulationCombatant = {
          ...actor,
          dying: recovery.newDying,
          downed: recovery.newDying > 0 || actor.hp.current === 0,
          dead: recovery.newDying >= threshold
        };
        combatants.set(actor.id, recovered);
        // After the recovery roll, the PC's turn ends — stabilized or not,
        // they spend the turn dying / recovering and do not act.
        continue;
      }

      if (actor.downed) continue;

      const pcs = liveSideMembers(combatants, 'pc');
      const enemies = liveSideMembers(combatants, 'enemy');
      const tactics = actor.side === 'pc' ? pcTactics : enemyTactics;
      const plan = tactics.chooseTurn({ attacker: actor, pcs, enemies, round }, rng);
      if (plan.strikes.length === 0) continue;

      for (const strike of plan.strikes) {
        const target = combatants.get(strike.targetId);
        const attack = actor.attacks.find((a) => a.id === strike.attackId);
        if (!target || target.dead || !attack) continue;

        const mapType = attack.mapType === 'unknown' ? 'normal' : attack.mapType;
        const penalties = getMapPenalties(mapType);
        const mapPenalty = penalties[strike.mapIndex] ?? 0;

        const sampled = sampleStrike(
          {
            attackerId: actor.id,
            defenderId: target.id,
            attackId: attack.id,
            attackName: attack.name,
            attackBonus: attack.attackBonus,
            mapPenalty,
            defenderAc: target.defenses.ac,
            damageFormula: attack.damageFormula,
            damageType: attack.damageType,
            defenderAdjustments: target.damageAdjustments
          },
          rng
        );

        const applied = applyDamage(target, { damage: sampled.damage, degree: sampled.degree });
        combatants.set(target.id, applied.combatant);

        if (applied.damageAbsorbed > 0) {
          const pairKey = `${actor.id}->${target.id}`;
          damageByPair[pairKey] = (damageByPair[pairKey] ?? 0) + applied.damageAbsorbed;
        }

        if (applied.becameDowned && target.side === 'pc' && firstDownRound === null) {
          firstDownRound = round;
        }

        if (config.captureEvents) {
          events.push({
            round,
            attackerId: actor.id,
            defenderId: target.id,
            attackId: attack.id,
            attackName: attack.name,
            degree: sampled.degree,
            damage: applied.damageAbsorbed,
            causedDown: applied.becameDowned
          });
        }
      }
    }

    if (allPcsDownedOrDead(combatants)) break;
    if (allEnemiesDead(combatants)) break;
  }

  const perCombatant: PerCombatantOutcome[] = Array.from(combatants.values()).map((c) => ({
    id: c.id,
    side: c.side,
    endingHp: c.hp.current,
    dying: c.dying,
    wounded: c.wounded,
    doomed: c.doomed,
    downed: c.downed,
    dead: c.dead,
    damageTaken: Math.max(0, (startingPool.get(c.id) ?? 0) - (c.hp.current + c.hp.temp))
  }));

  const tpk = isTpk(combatants);

  return {
    iterationIndex,
    roundsElapsed,
    firstDownRound,
    tpk,
    perCombatant,
    damageByPair,
    events: config.captureEvents ? events : undefined,
    healsFired: 0,
    recoveryChecksFired,
    heroPointSurvivalsFired: 0
  };
}

function cloneCombatant(combatant: SimulationCombatant): SimulationCombatant {
  return {
    ...combatant,
    hp: { ...combatant.hp },
    defenses: { ...combatant.defenses }
  };
}

function liveSideMembers(
  combatants: Map<string, SimulationCombatant>,
  side: 'pc' | 'enemy'
): SimulationCombatant[] {
  const list: SimulationCombatant[] = [];
  for (const c of combatants.values()) {
    if (c.side === side) list.push(c);
  }
  return list;
}

function allPcsDownedOrDead(combatants: Map<string, SimulationCombatant>): boolean {
  let pcCount = 0;
  for (const c of combatants.values()) {
    if (c.side !== 'pc') continue;
    pcCount += 1;
    if (!c.downed && !c.dead) return false;
  }
  return pcCount > 0;
}

function allEnemiesDead(combatants: Map<string, SimulationCombatant>): boolean {
  let enemyCount = 0;
  for (const c of combatants.values()) {
    if (c.side !== 'enemy') continue;
    enemyCount += 1;
    if (!c.dead) return false;
  }
  return enemyCount > 0;
}

function isTpk(combatants: Map<string, SimulationCombatant>): boolean {
  return allPcsDownedOrDead(combatants);
}
