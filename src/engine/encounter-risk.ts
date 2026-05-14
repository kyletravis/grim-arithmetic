import { EncounterParticipants } from '../foundry/encounter-participants';
import { AttackSnapshot, CombatantSnapshot, SystemAdapter } from '../systems/base-adapter';
import { PanelControls } from '../ui/panel-data';
import { ImmediateDownRiskResult, immediateDownRisk, MapType } from './mortality';

export interface PairRisk {
  pcId: string;
  pcName: string;
  enemyId: string;
  enemyName: string;
  attackId: string;
  attackName: string;
  downProbability: number;
  riskLabel: ImmediateDownRiskResult['riskLabel'];
  caveats: string[];
}

export interface EncounterRiskMatrix {
  pairs: PairRisk[];
  skipped: boolean;
  caveats: string[];
}

export interface ComputeMatrixOptions<TokenLike> {
  adapter: SystemAdapter<TokenLike>;
  controls: PanelControls;
  pairLimit?: number;
}

export const MAX_PAIRS = 200;

const NO_ATTACKS_CAVEAT = (enemyName: string): string =>
  `${enemyName} has no supported melee Strike with numeric attack bonus and damage formula.`;

const GUARDRAIL_CAVEAT =
  'Encounter too large to compute pairwise risk safely. Reduce combatants or use the single-pair detail view.';

export function computeEncounterRiskMatrix<TokenLike>(
  participants: EncounterParticipants<TokenLike>,
  options: ComputeMatrixOptions<TokenLike>
): EncounterRiskMatrix {
  const { adapter, controls, pairLimit } = options;

  const hostileAttackSets = participants.hostiles.map((hostile) => ({
    hostile,
    attacks: safeGetAttacks(adapter, hostile.token)
  }));

  const projectedPairCount = participants.pcs.length *
    hostileAttackSets.reduce((sum, set) => sum + set.attacks.length, 0);

  if (pairLimit !== undefined && projectedPairCount > pairLimit) {
    return { pairs: [], skipped: true, caveats: [GUARDRAIL_CAVEAT] };
  }

  const pairs: PairRisk[] = [];
  const caveats: string[] = [];

  for (const { hostile, attacks } of hostileAttackSets) {
    if (attacks.length === 0) {
      caveats.push(NO_ATTACKS_CAVEAT(hostile.snapshot.name));
      continue;
    }

    for (const pc of participants.pcs) {
      for (const attack of attacks) {
        pairs.push(buildPairRisk(pc.snapshot, hostile.snapshot, attack, controls));
      }
    }
  }

  return { pairs, skipped: false, caveats };
}

function buildPairRisk(
  pc: CombatantSnapshot,
  enemy: CombatantSnapshot,
  attack: AttackSnapshot,
  controls: PanelControls
): PairRisk {
  const pairCaveats: string[] = [];

  try {
    const result = immediateDownRisk({
      hp: pc.hp.current + (pc.hp.temp ?? 0),
      ac: pc.defenses.ac + controls.shieldBonus,
      attackBonus: attack.attackBonus,
      damageFormula: attack.damageFormula,
      strikes: controls.strikes,
      mapType: resolveMapType(controls.mapMode, attack.mapType),
      wounded: resolveWounded(pc, controls.woundedOverride),
      doomed: pc.deathState?.doomed ?? 0,
      assumeHeroPointAvailable: resolveHeroPointAvailability(pc, controls.heroPointMode),
      damageType: attack.damageType,
      targetAdjustments: pc.damageAdjustments
    });

    return {
      pcId: pc.id,
      pcName: pc.name,
      enemyId: enemy.id,
      enemyName: enemy.name,
      attackId: attack.id,
      attackName: attack.name,
      downProbability: result.downProbability,
      riskLabel: result.riskLabel,
      caveats: pairCaveats
    };
  } catch (error) {
    pairCaveats.push(
      `Risk could not be computed for this pair: ${error instanceof Error ? error.message : 'unknown error'}.`
    );
    return {
      pcId: pc.id,
      pcName: pc.name,
      enemyId: enemy.id,
      enemyName: enemy.name,
      attackId: attack.id,
      attackName: attack.name,
      downProbability: 0,
      riskLabel: 'Low',
      caveats: pairCaveats
    };
  }
}

function safeGetAttacks<TokenLike>(
  adapter: SystemAdapter<TokenLike>,
  token: TokenLike
): AttackSnapshot[] {
  try {
    return adapter.getAttacksFromToken(token);
  } catch {
    return [];
  }
}

function resolveMapType(mapMode: PanelControls['mapMode'], attackMapType: AttackSnapshot['mapType']): MapType {
  if (mapMode !== 'auto') return mapMode;
  return attackMapType === 'unknown' ? 'normal' : attackMapType;
}

function resolveWounded(pc: CombatantSnapshot, override: PanelControls['woundedOverride']): number {
  if (override === 'current') return pc.deathState?.wounded ?? 0;
  return Number(override);
}

function resolveHeroPointAvailability(
  pc: CombatantSnapshot,
  heroPointMode: PanelControls['heroPointMode']
): boolean {
  if (heroPointMode === 'available') return true;
  if (heroPointMode === 'unavailable') return false;
  return (pc.deathState?.heroPoints ?? 0) > 0;
}
