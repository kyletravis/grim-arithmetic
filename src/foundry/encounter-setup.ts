import type { EncounterSetup, SimulationCombatant } from '../engine/simulation-types';
import type { AttackSnapshot, CombatantSnapshot, SystemAdapter } from '../systems/base-adapter';
import {
  getEncounterParticipants,
  resolveEncounterParticipants,
  type EncounterSource
} from './encounter-participants';

export interface BuildEncounterSetupOptions {
  /** Pass-through to encounter-participants — falls back to scene tokens. */
  allowSceneFallback?: boolean;
}

/**
 * Build the EncounterSetup the Monte Carlo runner expects from the active
 * Foundry combat (or scene fallback). Reuses getEncounterParticipants()
 * for the disposition/snapshot classification so v0.5.0 behavior is
 * preserved: unsupported actors become caveats, ally/neutral combatants
 * are excluded with caveats, and per-actor adapter throws never poison
 * the entire setup.
 */
export function buildEncounterSetup<TokenLike extends { name?: string }>(
  adapter: SystemAdapter<TokenLike>,
  options: BuildEncounterSetupOptions = {}
): EncounterSetup {
  const participants = getEncounterParticipants(adapter, {
    allowSceneFallback: options.allowSceneFallback
  });
  return materialize(participants, adapter);
}

/**
 * Test-friendly variant: takes an explicit EncounterSource instead of
 * reading game.combat / canvas.tokens.
 */
export function buildEncounterSetupFromSource<TokenLike extends { name?: string }>(
  source: EncounterSource<TokenLike>,
  adapter: SystemAdapter<TokenLike>,
  options: BuildEncounterSetupOptions = {}
): EncounterSetup {
  const participants = resolveEncounterParticipants(source, adapter, {
    allowSceneFallback: options.allowSceneFallback
  });
  return materialize(participants, adapter);
}

function materialize<TokenLike extends { name?: string }>(
  participants: ReturnType<typeof getEncounterParticipants<TokenLike>>,
  adapter: SystemAdapter<TokenLike>
): EncounterSetup {
  const caveats: string[] = [...participants.caveats];
  for (const name of participants.unsupported) {
    caveats.push(`Unsupported actor skipped: ${name}`);
  }

  const pcs: SimulationCombatant[] = participants.pcs.map((p) => {
    let attacks: AttackSnapshot[] = [];
    try {
      attacks = adapter.getAttacksFromToken(p.token);
    } catch {
      caveats.push(`${p.snapshot.name}: PC attack extraction failed; treated as no supported Strike.`);
    }
    if (attacks.length === 0) {
      caveats.push(`${p.snapshot.name} has no supported Strike; will skip its turns in the simulation.`);
    }
    return snapshotToSimulationCombatant(p.snapshot, 'pc', attacks, caveats);
  });

  const enemies: SimulationCombatant[] = participants.hostiles.map((h) => {
    let attacks: AttackSnapshot[] = [];
    try {
      attacks = adapter.getAttacksFromToken(h.token);
    } catch {
      caveats.push(`${h.snapshot.name}: attack extraction failed; treated as no supported attacks.`);
    }
    if (attacks.length === 0) {
      caveats.push(`${h.snapshot.name} has no supported attacks; will skip its turns.`);
    }
    return snapshotToSimulationCombatant(h.snapshot, 'enemy', attacks, caveats);
  });

  return { pcs, enemies, caveats };
}

function snapshotToSimulationCombatant(
  snapshot: CombatantSnapshot,
  side: 'pc' | 'enemy',
  attacks: AttackSnapshot[],
  caveats: string[]
): SimulationCombatant {
  if (snapshot.initiativeBonus === undefined) {
    caveats.push(`${snapshot.name}: initiative bonus unknown; defaulting to 0.`);
  }
  return {
    id: snapshot.id,
    name: snapshot.name,
    side,
    hp: {
      current: snapshot.hp.current,
      max: snapshot.hp.max,
      temp: snapshot.hp.temp ?? 0
    },
    defenses: {
      ac: snapshot.defenses.ac,
      fort: snapshot.defenses.fort,
      reflex: snapshot.defenses.reflex,
      will: snapshot.defenses.will
    },
    dying: snapshot.deathState?.dying ?? 0,
    wounded: snapshot.deathState?.wounded ?? 0,
    doomed: snapshot.deathState?.doomed ?? 0,
    heroPoints: snapshot.deathState?.heroPoints ?? 0,
    downed: (snapshot.deathState?.dying ?? 0) > 0,
    dead: false,
    initiativeBonus: snapshot.initiativeBonus ?? 0,
    damageAdjustments: snapshot.damageAdjustments,
    traits: [...snapshot.traits],
    attacks: [...attacks]
  };
}
