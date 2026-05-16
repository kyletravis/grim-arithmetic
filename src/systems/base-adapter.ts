export interface DamageAdjustmentValue {
  type: string;
  value: number;
}

export interface DamageAdjustments {
  resistances: DamageAdjustmentValue[];
  weaknesses: DamageAdjustmentValue[];
  immunities: string[];
}

/**
 * PC-specific capabilities surfaced by the system adapter for v0.6.0-rc.4+
 * PC action modeling. Only populated for PC actors (disposition === 'pc').
 *
 * Each field is independently optional so the adapter can extend coverage
 * incrementally: rc.4 Phase I-A adds Medicine + Heal spells + Hero Points;
 * Phase I-B (rc.5) adds shield + class. Consumers must treat absent fields
 * as "capability unknown / not present" rather than "explicitly zero".
 */
export interface PcCapabilities {
  /** Medicine skill modifier (for Battle Medicine check). */
  medicineModifier?: number;
  /** True when the PC has the Battle Medicine feat. */
  hasBattleMedicine?: boolean;
  /** DC for the Battle Medicine check; derived from Medicine proficiency. */
  medicineDC?: number;
  /**
   * Prepared/spontaneous Heal spell slots remaining, keyed by spell rank.
   * Example: { 1: 3, 2: 2 } = 3 first-rank, 2 second-rank slots.
   */
  healSpellSlots?: Record<number, number>;
  /**
   * Caster level used to scale the Heal cantrip. Null when no Heal cantrip
   * is prepared / known.
   */
  healCantripLevel?: number | null;
}

export interface CombatantSnapshot {
  id: string;
  name: string;
  disposition: 'pc' | 'ally' | 'enemy' | 'neutral';
  hp: {
    current: number;
    max: number;
    temp?: number;
  };
  defenses: {
    ac: number;
    fort?: number;
    reflex?: number;
    will?: number;
  };
  deathState?: {
    dying?: number;
    wounded?: number;
    doomed?: number;
    heroPoints?: number;
  };
  damageAdjustments?: DamageAdjustments;
  /**
   * Modifier added to the d20 initiative roll. Optional because v0.5.0
   * paths do not consume it; the v0.6.0 Monte Carlo simulation reads it
   * via the encounter setup builder.
   */
  initiativeBonus?: number;
  /**
   * PC-specific action/reaction capabilities. Populated for PC actors only;
   * undefined for NPCs and pre-rc.4 callers.
   */
  pcCapabilities?: PcCapabilities;
  traits: string[];
  assumptions: string[];
}

export interface AttackSnapshot {
  id: string;
  name: string;
  attackBonus: number;
  damageFormula: string;
  damageType?: string;
  traits: string[];
  mapType: 'normal' | 'agile' | 'none' | 'unknown';
  assumptions: string[];
}

export interface SystemAdapter<TokenLike = unknown> {
  id: string;
  label: string;
  getCombatantFromToken(token: TokenLike): CombatantSnapshot | null;
  getAttacksFromToken(token: TokenLike): AttackSnapshot[];
}
