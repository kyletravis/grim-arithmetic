import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

function condition(slug: string, value: number) {
  return { slug, value };
}

describe('Pf2eAdapter combatant extraction', () => {
  it('extracts a PF2e character combatant snapshot from token actor data', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      id: 'token-1',
      name: 'Mira Stormwake',
      document: { disposition: 1 },
      actor: {
        id: 'actor-1',
        name: 'Mira',
        type: 'character',
        system: {
          attributes: {
            hp: { value: 23, max: 31, temp: 4 },
            ac: { value: 19 },
            weaknesses: [{ type: 'cold', value: 4 }],
            resistances: [
              { type: 'fire', value: 5 },
              { type: 'physical', value: 3 }
            ],
            immunities: [{ type: 'poison' }]
          },
          saves: {
            fortitude: { value: 8 },
            reflex: { value: 7 },
            will: { value: 10 }
          },
          resources: {
            heroPoints: { value: 1 }
          },
          traits: { value: ['human', 'druid'] }
        },
        itemTypes: {
          condition: [condition('wounded', 1), condition('dying', 0), condition('doomed', 0)]
        }
      }
    };

    const snapshot = adapter.getCombatantFromToken(token);

    expect(snapshot).toMatchObject({
      id: 'token-1',
      name: 'Mira Stormwake',
      disposition: 'pc',
      hp: { current: 23, max: 31, temp: 4 },
      defenses: { ac: 19, fort: 8, reflex: 7, will: 10 },
      deathState: { dying: 0, wounded: 1, doomed: 0, heroPoints: 1 },
      traits: ['human', 'druid'],
      damageAdjustments: {
        resistances: [{ type: 'fire', value: 5 }, { type: 'physical', value: 3 }],
        weaknesses: [{ type: 'cold', value: 4 }],
        immunities: ['poison']
      }
    });
  });

  it('returns null when required HP or AC fields are missing', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      actor: {
        type: 'character',
        system: {
          attributes: {
            hp: { value: 10, max: 20 }
          }
        }
      }
    };

    expect(adapter.getCombatantFromToken(token)).toBeNull();
  });
});

describe('Pf2eAdapter Strike extraction', () => {
  it('extracts first-pass PF2e melee Strike snapshots from item data', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      actor: {
        items: [
          {
            id: 'jaws-1',
            name: 'Jaws',
            type: 'melee',
            system: {
              bonus: { value: 12 },
              damageRolls: {
                primary: { damage: '2d8+6', damageType: 'piercing' }
              },
              traits: { value: ['agile', 'unarmed'] }
            }
          },
          {
            id: 'ignored-1',
            name: 'Ignored Lore',
            type: 'lore',
            system: {}
          }
        ]
      }
    };

    expect(adapter.getAttacksFromToken(token)).toEqual([
      {
        id: 'jaws-1',
        name: 'Jaws',
        attackBonus: 12,
        damageFormula: '2d8+6',
        damageType: 'piercing',
        traits: ['agile', 'unarmed'],
        mapType: 'agile',
        assumptions: ['PF2e Strike extraction is first-pass and may miss conditional modifiers.']
      }
    ]);
  });

  it('falls back from system.bonus.value to system.attack.value and normal MAP', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      actor: {
        items: [
          {
            id: 'claw-1',
            name: 'Claw',
            type: 'melee',
            system: {
              attack: { value: 9 },
              damageRolls: {
                primary: { formula: '1d6+4' }
              },
              traits: { value: ['unarmed'] }
            }
          }
        ]
      }
    };

    expect(adapter.getAttacksFromToken(token)[0]).toMatchObject({
      id: 'claw-1',
      attackBonus: 9,
      damageFormula: '1d6+4',
      mapType: 'normal'
    });
  });

  it('skips malformed melee items instead of throwing', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      actor: {
        items: [
          {
            id: 'bad-1',
            name: 'Bad Strike',
            type: 'melee',
            system: {
              damageRolls: {}
            }
          }
        ]
      }
    };

    expect(adapter.getAttacksFromToken(token)).toEqual([]);
  });
});
