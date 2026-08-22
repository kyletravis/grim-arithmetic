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
  it('captures PC strike actions, abilities, perception, and medicine for characters', () => {
    const capture = buildDebugCapture({
      id: 'pc',
      name: 'Mira',
      document: { disposition: 1 },
      actor: {
        id: 'a',
        name: 'Mira',
        type: 'character',
        system: {
          attributes: { hp: { value: 20, max: 20 }, ac: { value: 18 } },
          perception: { mod: 7 },
          abilities: { str: { mod: 4 } },
          skills: { medicine: { mod: 9, rank: 2 } },
          actions: [
            {
              slug: 'longsword',
              label: 'Longsword',
              totalModifier: 14,
              damage: () => null,
              ready: true,
              traits: [{ name: 'versatile-p' }],
              item: {
                id: 'i',
                name: 'Longsword',
                system: { damage: { dice: 1, die: 'd8' }, runes: { striking: 1 } }
              }
            }
          ]
        },
        itemTypes: {},
        items: []
      }
    }) as { actor: { pc: Record<string, unknown> } };

    expect(capture.actor.pc).toMatchObject({
      perception: { mod: 7 },
      abilities: { str: { mod: 4 } },
      medicine: { mod: 9, rank: 2 },
      actions: [
        {
          slug: 'longsword',
          totalModifier: 14,
          damageKind: 'function',
          ready: true,
          item: { system: { damage: { dice: 1, die: 'd8' }, runes: { striking: 1 } } }
        }
      ]
    });
  });
});
