import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/prng';
import { runIteration } from '../src/engine/run-iteration';
import { DEFAULT_MAX_ROUNDS } from '../src/engine/simulation-types';
import { buildEncounterSetupFromSource } from '../src/foundry/encounter-setup';
import type { AttackSnapshot, CombatantSnapshot, SystemAdapter } from '../src/systems/base-adapter';

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
  it('surfaces PC attack assumptions as caveats once per distinct assumption', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', { name: 'Mira' }),
            attacks: [
              makeAttack({ id: 'longsword', assumptions: ['X'] }),
              makeAttack({ id: 'dagger', assumptions: ['X'] })
            ]
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
    expect(setup.caveats.filter((c) => c === 'Mira: X')).toEqual(['Mira: X']);
  });

  it('marks a PC at 0 HP as downed even when not dying', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', {
              name: 'Mira',
              hp: { current: 0, max: 24, temp: 0 },
              deathState: { dying: 0, wounded: 1, doomed: 0, heroPoints: 1 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].downed).toBe(true);
  });

  it('caveats a PC that starts the run at 0 HP', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', {
              name: 'Mira',
              hp: { current: 0, max: 24, temp: 0 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.caveats).toContain(
      'Mira starts this run at 0 HP, so "any PC down" will read 100%.'
    );
  });

  it('treats a PC kept up by temporary HP as standing, with no 0-HP caveat', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', {
              name: 'Mira',
              hp: { current: 0, max: 24, temp: 5 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    // downed and the caveat must agree on what "at 0 HP" means: current + temp.
    expect(setup.pcs[0].downed).toBe(false);
    expect(setup.caveats.some((c) => c.includes('starts this run at 0 HP'))).toBe(false);
  });

  it('treats a hostile already at 0 HP as defeated rather than merely downed', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', { name: 'Mira' }),
            attacks: [makeAttack()]
          }
        },
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy', {
              name: 'Troll',
              hp: { current: 0, max: 60, temp: 0 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    // dead (not just downed) so allEnemiesDead() can terminate the iteration;
    // applyDamage uses the same rule when an enemy is dropped mid-fight.
    expect(setup.enemies[0].downed).toBe(true);
    expect(setup.enemies[0].dead).toBe(true);
    expect(setup.caveats).toContain('Troll is already at 0 HP and is treated as defeated.');
  });

  it('does not mark a hostile kept up by temporary HP as defeated', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy', {
              name: 'Troll',
              hp: { current: 0, max: 60, temp: 4 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.enemies[0].dead).toBe(false);
    expect(setup.enemies[0].downed).toBe(false);
    expect(setup.caveats.some((c) => c.includes('treated as defeated'))).toBe(false);
  });

  it('never marks a PC dead at setup, even at 0 HP', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', {
              name: 'Mira',
              hp: { current: 0, max: 24, temp: 0 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].downed).toBe(true);
    expect(setup.pcs[0].dead).toBe(false);
    expect(setup.caveats.some((c) => c.includes('treated as defeated'))).toBe(false);
  });

  it('partitions PCs and enemies by disposition', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc'),
            attacks: [makeAttack({ id: 'longsword', name: 'Longsword' })]
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

  it('populates PC attacks from the adapter (v0.6.0-rc.3 PC action modeling)', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc'),
            attacks: [
              makeAttack({ id: 'longsword', name: 'Longsword' }),
              makeAttack({ id: 'dagger', name: 'Dagger', damageFormula: '1d4+2' })
            ]
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].attacks).toHaveLength(2);
    expect(setup.pcs[0].attacks.map((a) => a.id)).toEqual(['longsword', 'dagger']);
  });

  it('caveats a PC with no usable Strike', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc'),
            attacks: []
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].attacks).toHaveLength(0);
    expect(setup.caveats.some((c) => c.includes('has no supported Strike'))).toBe(true);
  });

  it('catches PC adapter throws as a caveat without crashing', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc'),
            attacks: [],
            throwOnAttacks: true
          }
        }
      ]
    };
    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    expect(setup.pcs[0].attacks).toHaveLength(0);
    expect(setup.caveats.some((c) => c.includes('PC attack extraction failed'))).toBe(true);
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

/**
 * The setup builder and the engine have to agree on what "out of the fight"
 * means for a hostile: the engine only ends an iteration via allEnemiesDead(),
 * which reads `dead`, and it only ever sets `dead` inside applyDamage. A
 * hostile that starts at 0 HP is never targeted (tactics skip downed enemies),
 * so if the builder hands the engine `downed: true, dead: false` that enemy is
 * immortal and every iteration burns to the round cap.
 */
describe('buildEncounterSetupFromSource: engine hand-off for 0-HP hostiles', () => {
  it('produces a setup that terminates in round 1 instead of running to the cap', () => {
    const source = {
      combatants: [
        {
          token: {
            id: 'mira',
            name: 'Mira',
            snapshot: makeSnapshot('mira', 'pc', { name: 'Mira' }),
            attacks: [makeAttack()]
          }
        },
        {
          token: {
            id: 'troll',
            name: 'Troll',
            snapshot: makeSnapshot('troll', 'enemy', {
              name: 'Troll',
              hp: { current: 0, max: 60, temp: 0 }
            }),
            attacks: [makeAttack()]
          }
        }
      ]
    };

    const setup = buildEncounterSetupFromSource(source, mockAdapter);
    const result = runIteration(
      setup,
      {
        iterations: 1000,
        tacticsProfile: 'focus-fire',
        maxRounds: DEFAULT_MAX_ROUNDS,
        seed: 'zero-hp-hostile'
      },
      createRng('zero-hp-hostile')
    );

    expect(result.hitRoundCap).toBe(false);
    expect(result.roundsElapsed).toBe(1);
  });
});
