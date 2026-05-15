import { describe, expect, it } from 'vitest';
import { buildEncounterSetupFromSource } from '../src/foundry/encounter-setup';
import type {
  AttackSnapshot,
  CombatantSnapshot,
  SystemAdapter
} from '../src/systems/base-adapter';

interface MockToken {
  id: string;
  name: string;
  snapshot: CombatantSnapshot | null;
  attacks: AttackSnapshot[];
  /** When true, getAttacksFromToken will throw to simulate adapter failure. */
  throwOnAttacks?: boolean;
}

const mockAdapter: SystemAdapter<MockToken> = {
  id: 'mock',
  label: 'Mock',
  getCombatantFromToken(token) {
    return token.snapshot;
  },
  getAttacksFromToken(token) {
    if (token.throwOnAttacks) throw new Error('adapter explosion');
    return token.attacks;
  }
};

function makeSnapshot(
  id: string,
  disposition: CombatantSnapshot['disposition'],
  overrides: Partial<CombatantSnapshot> = {}
): CombatantSnapshot {
  return {
    id,
    name: id,
    disposition,
    hp: { current: 24, max: 24, temp: 0 },
    defenses: { ac: 20 },
    traits: [],
    assumptions: [],
    initiativeBonus: 5,
    ...overrides
  };
}

function makeAttack(overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
  return {
    id: 'claw',
    name: 'Claw',
    attackBonus: 10,
    damageFormula: '1d8+4',
    damageType: 'slashing',
    traits: [],
    mapType: 'normal',
    assumptions: [],
    ...overrides
  };
}

describe('buildEncounterSetupFromSource', () => {
  it('partitions PCs and enemies by disposition', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc'),
            attacks: []
          }
        },
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy'),
            attacks: [makeAttack()]
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs).toHaveLength(1);
    expect(setup.enemies).toHaveLength(1);
    expect(setup.pcs[0].id).toBe('mira');
    expect(setup.enemies[0].id).toBe('troll');
  });

  it('threads multiple attacks through to the enemy combatant', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy'),
            attacks: [
              makeAttack({ id: 'claw', name: 'Claw' }),
              makeAttack({ id: 'bite', name: 'Bite', damageFormula: '1d10+4' })
            ]
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.enemies[0].attacks).toHaveLength(2);
    expect(setup.enemies[0].attacks.map((a) => a.id)).toEqual(['claw', 'bite']);
  });

  it('surfaces unsupported actors as caveats, never throws', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'ghost',
            name: 'Mystery Actor',
            snapshot: null,
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs).toHaveLength(0);
    expect(setup.enemies).toHaveLength(0);
    expect(setup.caveats.some((c) => c.includes('Unsupported actor skipped'))).toBe(true);
  });

  it('caveats an enemy with no supported attacks', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy'),
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.enemies[0].attacks).toHaveLength(0);
    expect(setup.caveats.some((c) => c.includes('no supported attacks'))).toBe(true);
  });

  it('catches getAttacksFromToken throws as a caveat', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy'),
            attacks: [],
            throwOnAttacks: true
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.enemies[0].attacks).toHaveLength(0);
    expect(setup.caveats.some((c) => c.includes('attack extraction failed'))).toBe(true);
  });

  it('propagates initiativeBonus from the snapshot', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'speedy',
            name: 'Speedy',
            snapshot: makeSnapshot('speedy', 'pc', { initiativeBonus: 9 }),
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].initiativeBonus).toBe(9);
  });

  it('caveats and defaults to 0 when initiativeBonus is missing from the snapshot', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mystery',
            name: 'Mystery',
            snapshot: makeSnapshot('mystery', 'pc', { initiativeBonus: undefined }),
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].initiativeBonus).toBe(0);
    expect(setup.caveats.some((c) => c.includes('initiative bonus unknown'))).toBe(true);
  });

  it('propagates damage adjustments from snapshot', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', {
              damageAdjustments: {
                resistances: [{ type: 'fire', value: 5 }],
                weaknesses: [],
                immunities: []
              }
            }),
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].damageAdjustments?.resistances).toEqual([{ type: 'fire', value: 5 }]);
  });

  it('excludes ally and neutral combatants', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc'),
            attacks: []
          }
        },
        {
          token: {
            id: 'cleric-ally',
            name: 'Cleric Ally',
            snapshot: makeSnapshot('cleric-ally', 'ally'),
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs).toHaveLength(1);
    expect(setup.enemies).toHaveLength(0);
    expect(setup.caveats.some((c) => c.toLowerCase().includes('ally'))).toBe(true);
  });

  it('returns an empty setup with NO_COMBAT caveat when no combat is provided', () => {
    const setup = buildEncounterSetupFromSource({}, mockAdapter);
    expect(setup.pcs).toHaveLength(0);
    expect(setup.enemies).toHaveLength(0);
    expect(setup.caveats.some((c) => c.toLowerCase().includes('no active combat'))).toBe(true);
  });
});
