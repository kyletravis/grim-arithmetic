import type { EncounterSetup, HealingState, SimulationCombatant } from '../engine/simulation-types';
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
    const combatant = snapshotToSimulationCombatant(p.snapshot, 'pc', attacks, caveats);
    combatant.healing = buildHealingState(p.snapshot, caveats);
    return combatant;
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

function buildHealingState(snapshot: CombatantSnapshot, caveats: string[]): HealingState {
  const caps = snapshot.pcCapabilities;
  if (!caps) {
    return {
      medicineDC: 15,
      hasBattleMedicine: false,
      battleMedicineUsedTargets: new Set(),
      healSpellSlotsRemaining: {},
      healCantripLevel: null
    };
  }
  const hasBattleMedicine = caps.hasBattleMedicine === true;
  const slots = caps.healSpellSlots ?? {};
  const cantrip = caps.healCantripLevel ?? null;
  const slotCount = Object.values(slots).reduce((sum, n) => sum + n, 0);
  if (!hasBattleMedicine && slotCount === 0 && cantrip === null) {
    caveats.push(`${snapshot.name} has no healing options; will not heal in this simulation.`);
  } else if (hasBattleMedicine && slotCount === 0 && cantrip === null && caps.medicineModifier === undefined) {
    caveats.push(`${snapshot.name}: Battle Medicine detected but no Medicine modifier; using default DC 15 with +0 modifier.`);
  }
  return {
    medicineModifier: caps.medicineModifier,
    medicineDC: caps.medicineDC ?? 15,
    hasBattleMedicine,
    battleMedicineUsedTargets: new Set(),
    healSpellSlotsRemaining: { ...slots },
    healCantripLevel: cantrip
  };
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
    heroPointSurvivalUsed: false,
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
