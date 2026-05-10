export interface DamageAdjustmentValue {
  type: string;
  value: number;
}

export interface DamageAdjustments {
  resistances: DamageAdjustmentValue[];
  weaknesses: DamageAdjustmentValue[];
  immunities: string[];
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
