import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

const tableTestEnemyToken = {
  id: 'enemy-token-1',
  name: 'Captured Ogre',
  document: { disposition: -1 },
  actor: {
    id: 'enemy-actor-1',
    name: 'Captured Ogre',
    type: 'npc',
    system: {
      attributes: {
        hp: { value: 44, max: 60 },
        ac: { value: 21 }
      },
      saves: {
        fortitude: { value: 14 },
        reflex: { value: 8 },
        will: { value: 10 }
      },
      traits: { value: ['giant', 'humanoid'] }
    },
    itemTypes: {
      condition: [
        { slug: 'wounded', system: { value: { value: 2 } } },
        { slug: 'doomed', value: 1 }
      ]
    },
    items: {
      contents: [
        {
          id: 'greatclub',
          name: 'Greatclub',
          type: 'melee',
          system: {
            bonus: { value: '+15' },
            damageRolls: {
              '0': { damage: '1d10+7' }
            },
            traits: { value: [{ slug: 'backswing' }] }
          }
        },
        {
          id: 'fist',
          name: 'Fist',
          type: 'melee',
          system: {
            attack: { value: 13 },
            damageRolls: {
              primary: { formula: '1d6+7' }
            },
            traits: { value: ['agile', { slug: 'unarmed' }] }
          }
        }
      ]
    }
  }
};

describe('Pf2eAdapter table-test fixtures', () => {
  it('extracts representative Foundry collection items, numeric strings, object traits, and nested condition values', () => {
    const adapter = new Pf2eAdapter();

    expect(adapter.getCombatantFromToken(tableTestEnemyToken)).toMatchObject({
      id: 'enemy-token-1',
      name: 'Captured Ogre',
      disposition: 'enemy',
      hp: { current: 44, max: 60 },
      defenses: { ac: 21, fort: 14, reflex: 8, will: 10 },
      deathState: { wounded: 2, doomed: 1 },
      traits: ['giant', 'humanoid']
    });

    expect(adapter.getAttacksFromToken(tableTestEnemyToken)).toEqual([
      {
        id: 'greatclub',
        name: 'Greatclub',
        attackBonus: 15,
        damageFormula: '1d10+7',
        traits: ['backswing'],
        mapType: 'normal',
        assumptions: ['PF2e Strike extraction is first-pass and may miss conditional modifiers.']
      },
      {
        id: 'fist',
        name: 'Fist',
        attackBonus: 13,
        damageFormula: '1d6+7',
        traits: ['agile', 'unarmed'],
        mapType: 'agile',
        assumptions: ['PF2e Strike extraction is first-pass and may miss conditional modifiers.']
      }
    ]);
  });
});
