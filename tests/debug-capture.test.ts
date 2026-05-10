import { describe, expect, it } from 'vitest';
import { buildDebugCapture } from '../src/debug-capture';

describe('buildDebugCapture', () => {
  it('keeps table-test extraction fields while omitting unrelated actor data', () => {
    const capture = buildDebugCapture({
      id: 'token-1',
      name: 'Goblin Token',
      document: { disposition: -1 },
      actor: {
        id: 'actor-1',
        name: 'Goblin Warrior',
        type: 'npc',
        system: {
          attributes: {
            hp: { value: 6, max: 6 },
            ac: { value: 16 },
            privateNotes: 'do not include'
          },
          saves: { fortitude: { value: 6 } },
          details: { biography: 'do not include' },
          traits: { value: ['goblin', { slug: 'humanoid' }] }
        },
        itemTypes: { condition: [{ slug: 'wounded', system: { value: { value: 1 } } }] },
        items: {
          contents: [
            {
              id: 'dogslicer',
              name: 'Dogslicer',
              type: 'melee',
              system: {
                bonus: { value: '+8' },
                damageRolls: { primary: { damage: '1d6+2' } },
                traits: { value: ['agile', { slug: 'backstabber' }] }
              }
            },
            {
              id: 'lore',
              name: 'Secret Lore',
              type: 'lore',
              system: { description: 'do not include' }
            }
          ]
        }
      }
    });

    expect(capture).toEqual({
      token: { id: 'token-1', name: 'Goblin Token', disposition: -1 },
      actor: {
        id: 'actor-1',
        name: 'Goblin Warrior',
        type: 'npc',
        system: {
          attributes: { hp: { value: 6, max: 6 }, ac: { value: 16 } },
          saves: { fortitude: { value: 6 } },
          traits: { value: ['goblin', { slug: 'humanoid' }] }
        },
        itemTypes: { condition: [{ slug: 'wounded', system: { value: { value: 1 } } }] },
        meleeItems: [
          {
            id: 'dogslicer',
            name: 'Dogslicer',
            type: 'melee',
            system: {
              bonus: { value: '+8' },
              attack: undefined,
              damageRolls: { primary: { damage: '1d6+2' } },
              traits: { value: ['agile', { slug: 'backstabber' }] }
            }
          }
        ]
      }
    });
  });
});
