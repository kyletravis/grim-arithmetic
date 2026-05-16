import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

const adapter = new Pf2eAdapter();

interface SpellItem {
  name?: string;
  slug?: string;
  level?: number;
  isCantrip?: boolean;
  traits?: string[];
  slotsRemaining?: number;
}

function pcToken(opts: {
  medicine?: { totalModifier?: number; value?: number; rank?: number };
  feats?: Array<{ slug?: string; name?: string }>;
  spells?: SpellItem[];
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
