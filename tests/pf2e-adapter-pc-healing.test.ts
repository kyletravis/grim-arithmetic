import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

const adapter = new Pf2eAdapter();

function pcToken(opts: {
  medicine?: { totalModifier?: number; value?: number; rank?: number };
  feats?: Array<{ slug?: string; name?: string }>;
}): unknown {
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
        traits: { value: [] }
      },
      items: opts.feats
        ? { contents: opts.feats.map((f) => ({ type: 'feat', name: f.name, system: { slug: f.slug } })) }
        : undefined
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
      medicineDC: 15
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
    expect(snapshot?.pcCapabilities).toEqual({ medicineDC: 15 });
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
