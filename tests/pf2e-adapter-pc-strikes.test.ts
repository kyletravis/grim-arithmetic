import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

const adapter = new Pf2eAdapter();

function pcTokenWith(overrides: {
  actions?: unknown[];
  items?: { contents: unknown[] };
}): unknown {
  return {
    id: 'pc-1',
    name: 'Mira Stormwake',
    document: { disposition: 1 },
    actor: {
      id: 'actor-1',
      name: 'Mira',
      type: 'character',
      system: {
        actions: overrides.actions
      },
      items: overrides.items
    }
  };
}

describe('Pf2eAdapter.getAttacksFromToken: PC actions list (primary path)', () => {
  it('extracts a single Strike from a martial PC via system.actions', () => {
    const token = pcTokenWith({
      actions: [
        {
          slug: 'longsword',
          label: 'Longsword',
          totalModifier: 14,
          damageFormula: '1d8+5',
          damageType: 'slashing',
          traits: ['versatile-p']
        }
      ]
    });

    expect(adapter.getAttacksFromToken(token)).toEqual([
      {
        id: 'longsword',
        name: 'Longsword',
        attackBonus: 14,
        damageFormula: '1d8+5',
        damageType: 'slashing',
        traits: ['versatile-p'],
        mapType: 'normal',
        assumptions: ['PC Strike extracted from actor.system.actions; conditional modifiers (status, MAP-adjacent feats) may be missing.']
      }
    ]);
  });

  it('extracts every strike for a dual-wielder', () => {
    const token = pcTokenWith({
      actions: [
        {
          slug: 'short-sword',
          label: 'Short Sword',
          totalModifier: 13,
          damageFormula: '1d6+4',
          damageType: 'piercing',
          traits: ['agile', 'finesse']
        },
        {
          slug: 'dagger',
          label: 'Dagger',
          totalModifier: 13,
          damageFormula: '1d4+4',
          damageType: 'piercing',
          traits: ['agile', 'finesse', 'thrown-10']
        }
      ]
    });
    const attacks = adapter.getAttacksFromToken(token);
    expect(attacks).toHaveLength(2);
    expect(attacks.map((a) => a.id)).toEqual(['short-sword', 'dagger']);
    expect(attacks.every((a) => a.mapType === 'agile')).toBe(true);
  });

  it('reads attack bonus from totalModifier, attackBonus, or mod (in that order)', () => {
    const token = pcTokenWith({
      actions: [
        { slug: 'a', label: 'A', totalModifier: 10, damageFormula: '1d6' },
        { slug: 'b', label: 'B', attackBonus: 11, damageFormula: '1d6' },
        { slug: 'c', label: 'C', mod: 12, damageFormula: '1d6' }
      ]
    });
    const attacks = adapter.getAttacksFromToken(token);
    expect(attacks.map((a) => a.attackBonus)).toEqual([10, 11, 12]);
  });

  it('parses string attack bonuses like "+15"', () => {
    const token = pcTokenWith({
      actions: [
        { slug: 'longsword', label: 'Longsword', totalModifier: '+15', damageFormula: '1d8+5' }
      ]
    });
    expect(adapter.getAttacksFromToken(token)[0].attackBonus).toBe(15);
  });

  it('reads damage from nested damage objects too', () => {
    const token = pcTokenWith({
      actions: [
        {
          slug: 'staff',
          label: 'Staff',
          totalModifier: 8,
          damage: { formula: '1d4+2', damageType: 'bludgeoning' }
        }
      ]
    });
    const result = adapter.getAttacksFromToken(token)[0];
    expect(result.damageFormula).toBe('1d4+2');
    expect(result.damageType).toBe('bludgeoning');
  });

  it('reads name and id from action.item when slug/label are missing', () => {
    const token = pcTokenWith({
      actions: [
        {
          totalModifier: 9,
          damageFormula: '1d6',
          item: { id: 'item-xyz', name: 'Crossbow' }
        }
      ]
    });
    const attack = adapter.getAttacksFromToken(token)[0];
    expect(attack.id).toBe('item-xyz');
    expect(attack.name).toBe('Crossbow');
  });

  it('returns empty when no actions have a usable attack bonus', () => {
    const token = pcTokenWith({
      actions: [
        { slug: 'broken', label: 'Broken', damageFormula: '1d6' }, // no bonus
        { slug: 'no-damage', label: 'No Damage', totalModifier: 10 } // no formula
      ]
    });
    expect(adapter.getAttacksFromToken(token)).toEqual([]);
  });
});

describe('Pf2eAdapter.getAttacksFromToken: PC weapon fallback', () => {
  it('falls back to equipped weapons when system.actions is empty', () => {
    const token = pcTokenWith({
      actions: [],
      items: {
        contents: [
          {
            id: 'club',
            name: 'Club',
            type: 'weapon',
            system: {
              equipped: { carryType: 'held', handsHeld: 1 },
              bonus: { value: 5 },
              damage: { dice: 1, die: 6, modifier: 3, damageType: 'bludgeoning' },
              traits: { value: [] }
            }
          }
        ]
      }
    });
    const attacks = adapter.getAttacksFromToken(token);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({
      id: 'club',
      name: 'Club',
      attackBonus: 5,
      damageFormula: '1d6+3',
      damageType: 'bludgeoning',
      mapType: 'normal'
    });
    expect(attacks[0].assumptions[0]).toMatch(/fallback/i);
  });

  it('skips unequipped weapons in the fallback path', () => {
    const token = pcTokenWith({
      items: {
        contents: [
          {
            id: 'unequipped',
            name: 'Spare Sword',
            type: 'weapon',
            system: {
              equipped: { carryType: 'worn' },
              damage: { dice: 1, die: 8, modifier: 0 }
            }
          }
        ]
      }
    });
    expect(adapter.getAttacksFromToken(token)).toEqual([]);
  });

  it('sets mapType: "agile" when the weapon has the agile trait', () => {
    const token = pcTokenWith({
      items: {
        contents: [
          {
            id: 'rapier',
            name: 'Rapier',
            type: 'weapon',
            system: {
              equipped: { carryType: 'held' },
              damage: { dice: 1, die: 6, modifier: 0, damageType: 'piercing' },
              traits: { value: ['agile', 'finesse'] }
            }
          }
        ]
      }
    });
    expect(adapter.getAttacksFromToken(token)[0].mapType).toBe('agile');
  });
});

describe('Pf2eAdapter.getAttacksFromToken: graceful empty cases', () => {
  it('returns [] for a PC with no actions and no items', () => {
    const token = pcTokenWith({});
    expect(adapter.getAttacksFromToken(token)).toEqual([]);
  });

  it('returns [] when token has no actor', () => {
    expect(adapter.getAttacksFromToken({ id: 't' } as unknown)).toEqual([]);
  });

  it('does not affect the NPC melee path', () => {
    const npcToken = {
      id: 'npc-1',
      name: 'Goblin',
      document: { disposition: -1 },
      actor: {
        type: 'npc',
        system: {
          attributes: { hp: { value: 10, max: 10 }, ac: { value: 15 } },
          traits: { value: ['goblinoid'] }
        },
        items: {
          contents: [
            {
              id: 'shortsword',
              name: 'Shortsword',
              type: 'melee',
              system: {
                bonus: { value: 7 },
                damageRolls: { '0': { damage: '1d6+2', damageType: 'piercing' } },
                traits: { value: ['agile'] }
              }
            }
          ]
        }
      }
    };
    const attacks = adapter.getAttacksFromToken(npcToken);
    expect(attacks).toHaveLength(1);
    expect(attacks[0].id).toBe('shortsword');
    expect(attacks[0].attackBonus).toBe(7);
  });
});
