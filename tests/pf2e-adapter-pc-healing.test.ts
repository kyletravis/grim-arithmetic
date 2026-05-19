import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

const adapter = new Pf2eAdapter();

interface SpellItem {
  id?: string;
  name?: string;
  slug?: string;
  level?: number;
  isCantrip?: boolean;
  traits?: string[];
  slotsRemaining?: number;
}

interface SpellcastingEntryFixture {
  preparationKind?: 'prepared' | 'spontaneous';
  /** Map of slot rank (0=cantrip, 1+=spell rank) to a list of preparations. */
  slots?: Record<
    number,
    {
      max?: number;
      value?: number;
      prepared?: Array<{ id: string; expended?: boolean }>;
    }
  >;
}

function pcToken(opts: {
  medicine?: { totalModifier?: number; value?: number; rank?: number };
  feats?: Array<{ slug?: string; name?: string }>;
  spells?: SpellItem[];
  spellcastingEntries?: SpellcastingEntryFixture[];
  casterLevel?: number;
}): unknown {
  const items: unknown[] = [];
  if (opts.feats) {
    for (const f of opts.feats) {
      items.push({ type: 'feat', name: f.name, system: { slug: f.slug } });
    }
  }
  if (opts.spells) {
    for (const s of opts.spells) {
      items.push({
        id: s.id,
        type: 'spell',
        name: s.name ?? 'Heal',
        system: {
          slug: s.slug,
          level: s.level,
          isCantrip: s.isCantrip,
          traits: { value: s.traits ?? [] },
          slotsRemaining: s.slotsRemaining
        }
      });
    }
  }
  if (opts.spellcastingEntries) {
    for (const entry of opts.spellcastingEntries) {
      const slotMap: Record<string, unknown> = {};
      for (const [rank, slot] of Object.entries(entry.slots ?? {})) {
        const preparedMap: Record<string, unknown> = {};
        (slot.prepared ?? []).forEach((prep, idx) => {
          preparedMap[String(idx)] = { id: prep.id, expended: prep.expended ?? false };
        });
        slotMap[`slot${rank}`] = {
          max: slot.max ?? (slot.prepared?.length ?? 0),
          value: slot.value,
          prepared: preparedMap
        };
      }
      items.push({
        type: 'spellcastingEntry',
        name: 'Cleric Spellcasting',
        system: {
          prepared: { value: entry.preparationKind ?? 'prepared' },
          slots: slotMap
        }
      });
    }
  }
  return {
    id: 'pc-1',
    name: 'Mira',
    document: { disposition: 1 },
    actor: {
      id: 'actor-1',
      name: 'Mira',
      type: 'character',
      system: {
        attributes: { hp: { value: 24, max: 24 }, ac: { value: 20 } },
        skills: opts.medicine ? { medicine: opts.medicine } : undefined,
        details: opts.casterLevel ? { level: { value: opts.casterLevel } } : undefined,
        traits: { value: [] }
      },
      items: items.length > 0 ? { contents: items } : undefined
    }
  };
}

describe('Pf2eAdapter PC capabilities: Medicine extraction', () => {
  it('reads totalModifier and Battle Medicine feat for a trained healer', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        medicine: { totalModifier: 8, rank: 1 },
        feats: [{ slug: 'battle-medicine' }]
      })
    );
    expect(snapshot?.pcCapabilities).toEqual({
      medicineModifier: 8,
      hasBattleMedicine: true,
      medicineDC: 15,
      healSpellSlots: undefined,
      healCantripLevel: null
    });
  });

  it('falls back to .value when .totalModifier is absent', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({ medicine: { value: 6, rank: 1 } })
    );
    expect(snapshot?.pcCapabilities?.medicineModifier).toBe(6);
  });

  it('scales medicineDC by proficiency rank (expert -> 20)', () => {
    const snapshot = adapter.getCombatantFromToken(pcToken({ medicine: { totalModifier: 10, rank: 2 } }));
    expect(snapshot?.pcCapabilities?.medicineDC).toBe(20);
  });

  it('scales medicineDC by proficiency rank (master -> 30, legendary -> 40)', () => {
    const m = adapter.getCombatantFromToken(pcToken({ medicine: { totalModifier: 15, rank: 3 } }));
    const l = adapter.getCombatantFromToken(pcToken({ medicine: { totalModifier: 20, rank: 4 } }));
    expect(m?.pcCapabilities?.medicineDC).toBe(30);
    expect(l?.pcCapabilities?.medicineDC).toBe(40);
  });

  it('defaults medicineDC to 15 when rank is unknown', () => {
    const snapshot = adapter.getCombatantFromToken(pcToken({ medicine: { totalModifier: 5 } }));
    expect(snapshot?.pcCapabilities?.medicineDC).toBe(15);
  });

  it('returns hasBattleMedicine: false when the feat is absent', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({ medicine: { totalModifier: 8, rank: 1 } })
    );
    expect(snapshot?.pcCapabilities?.hasBattleMedicine).toBeFalsy();
  });

  it('detects Battle Medicine via name when slug is missing', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        medicine: { totalModifier: 8, rank: 1 },
        feats: [{ name: 'Battle Medicine' }]
      })
    );
    expect(snapshot?.pcCapabilities?.hasBattleMedicine).toBe(true);
  });

  it('returns a minimal pcCapabilities object when PC has no Medicine and no Battle Medicine', () => {
    const snapshot = adapter.getCombatantFromToken(pcToken({}));
    expect(snapshot?.pcCapabilities).toEqual({ medicineDC: 15, healCantripLevel: null });
  });

  it('extracts prepared Heal spell slots and Heal cantrip from a Cleric', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        casterLevel: 4,
        spells: [
          { slug: 'heal', level: 1, slotsRemaining: 3 },
          { slug: 'heal', level: 2, slotsRemaining: 2 },
          { slug: 'heal', level: 0, isCantrip: true, traits: ['cantrip'] }
        ]
      })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toEqual({ 1: 3, 2: 2 });
    expect(snapshot?.pcCapabilities?.healCantripLevel).toBe(4);
  });

  it('detects Heal cantrip with no prepared slots (Druid with only the cantrip)', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        casterLevel: 6,
        spells: [{ slug: 'heal', level: 0, isCantrip: true, traits: ['cantrip'] }]
      })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toBeUndefined();
    expect(snapshot?.pcCapabilities?.healCantripLevel).toBe(6);
  });

  it('returns no Heal capability for a martial PC with no spells', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({ medicine: { totalModifier: 5, rank: 1 } })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toBeUndefined();
    expect(snapshot?.pcCapabilities?.healCantripLevel).toBeNull();
  });

  it('treats spells with no slotsRemaining as 1 prepared slot by default', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({ spells: [{ slug: 'heal', level: 3 }] })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toEqual({ 3: 1 });
  });

  it('counts prepared Heal slots from a real PF2e v14 cleric spellcasting entry', () => {
    // Mira: human cleric with Heal prepared via the spellcastingEntry slot map,
    // NOT via item-level slotsRemaining. This mirrors how PF2e v6+ stores
    // prepared spell slot data on the spellcasting entry, not the spell item.
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        casterLevel: 5,
        medicine: { totalModifier: 1, rank: 1 },
        spells: [{ id: 'heal-spell-id', slug: 'heal', level: 1 }],
        spellcastingEntries: [
          {
            preparationKind: 'prepared',
            slots: {
              1: {
                max: 4,
                prepared: [
                  { id: 'heal-spell-id' },
                  { id: 'heal-spell-id' },
                  { id: 'shield-spell-id' },
                  { id: 'heal-spell-id', expended: true }
                ]
              },
              2: {
                max: 3,
                prepared: [
                  { id: 'heal-spell-id' },
                  { id: 'bless-spell-id' }
                ]
              }
            }
          }
        ]
      })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toEqual({ 1: 2, 2: 1 });
  });

  it('counts spontaneous Heal slots from the entry slot value when Heal is known', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        casterLevel: 8,
        spells: [{ id: 'heal-spell-id', slug: 'heal', level: 1 }],
        spellcastingEntries: [
          {
            preparationKind: 'spontaneous',
            slots: {
              1: { max: 4, value: 3 },
              2: { max: 3, value: 2 }
            }
          }
        ]
      })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toEqual({ 1: 3, 2: 2 });
  });

  it('ignores entries with no Heal preparation and no Heal in the known spell list', () => {
    const snapshot = adapter.getCombatantFromToken(
      pcToken({
        casterLevel: 5,
        spellcastingEntries: [
          {
            preparationKind: 'prepared',
            slots: {
              1: { max: 4, prepared: [{ id: 'shield-spell-id' }] }
            }
          }
        ]
      })
    );
    expect(snapshot?.pcCapabilities?.healSpellSlots).toBeUndefined();
  });

  it('does not surface pcCapabilities on NPC actors', () => {
    const npc = {
      id: 'npc-1',
      name: 'Goblin',
      document: { disposition: -1 },
      actor: {
        type: 'npc',
        system: {
          attributes: { hp: { value: 8, max: 8 }, ac: { value: 15 } },
          traits: { value: [] }
        }
      }
    };
    const snapshot = adapter.getCombatantFromToken(npc);
    expect(snapshot?.pcCapabilities).toBeUndefined();
  });
});
