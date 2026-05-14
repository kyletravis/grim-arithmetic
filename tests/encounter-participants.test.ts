import { describe, expect, it } from 'vitest';
import {
  resolveEncounterParticipants,
  EncounterSource
} from '../src/foundry/encounter-participants';
import { CombatantSnapshot, SystemAdapter } from '../src/systems/base-adapter';

function makePcToken(id: string, name: string) {
  return { id, name, _kind: 'pc' as const };
}
function makeHostileToken(id: string, name: string) {
  return { id, name, _kind: 'hostile' as const };
}
function makeAllyToken(id: string, name: string) {
  return { id, name, _kind: 'ally' as const };
}
function makeUnsupportedToken(id: string, name: string) {
  return { id, name, _kind: 'unsupported' as const };
}

type FakeToken = ReturnType<typeof makePcToken> | ReturnType<typeof makeHostileToken> | ReturnType<typeof makeAllyToken> | ReturnType<typeof makeUnsupportedToken>;

const adapter: SystemAdapter<FakeToken> = {
  id: 'pf2e',
  label: 'Pathfinder Second Edition',
  getCombatantFromToken(token) {
    if (token._kind === 'unsupported') return null;
    const disposition: CombatantSnapshot['disposition'] =
      token._kind === 'pc' ? 'pc' : token._kind === 'hostile' ? 'enemy' : 'ally';
    return {
      id: token.id,
      name: token.name,
      disposition,
      hp: { current: 20, max: 20 },
      defenses: { ac: 15 },
      traits: [],
      assumptions: []
    };
  },
  getAttacksFromToken() {
    return [];
  }
};

describe('resolveEncounterParticipants', () => {
  it('classifies combat combatants into PC and hostile buckets', () => {
    const source: EncounterSource<FakeToken> = {
      combatants: [
        { token: makePcToken('pc-1', 'Mira') },
        { token: makePcToken('pc-2', 'Seam') },
        { token: makeHostileToken('npc-1', 'Troll') },
        { token: makeHostileToken('npc-2', 'Cultist') }
      ]
    };

    const result = resolveEncounterParticipants(source, adapter);

    expect(result.pcs).toHaveLength(2);
    expect(result.hostiles).toHaveLength(2);
    expect(result.pcs.map((p) => p.snapshot.name)).toEqual(['Mira', 'Seam']);
    expect(result.hostiles.map((h) => h.snapshot.name)).toEqual(['Troll', 'Cultist']);
    expect(result.unsupported).toEqual([]);
    expect(result.caveats).toEqual([]);
  });

  it('reports a friendly caveat when no combat is active and scene fallback is not allowed', () => {
    const result = resolveEncounterParticipants({}, adapter);

    expect(result.pcs).toEqual([]);
    expect(result.hostiles).toEqual([]);
    expect(result.caveats).toContain('No active combat encounter.');
  });

  it('uses scene tokens only when explicitly opted in, and adds a caveat', () => {
    const source: EncounterSource<FakeToken> = {
      sceneTokens: [makePcToken('pc-1', 'Mira'), makeHostileToken('npc-1', 'Troll')]
    };

    const result = resolveEncounterParticipants(source, adapter, { allowSceneFallback: true });

    expect(result.pcs.map((p) => p.snapshot.name)).toEqual(['Mira']);
    expect(result.hostiles.map((h) => h.snapshot.name)).toEqual(['Troll']);
    expect(result.caveats.some((c) => c.toLowerCase().includes('scene'))).toBe(true);
  });

  it('does not fall back to scene tokens when allowSceneFallback is not set', () => {
    const source: EncounterSource<FakeToken> = {
      sceneTokens: [makePcToken('pc-1', 'Mira'), makeHostileToken('npc-1', 'Troll')]
    };

    const result = resolveEncounterParticipants(source, adapter);

    expect(result.pcs).toEqual([]);
    expect(result.hostiles).toEqual([]);
    expect(result.caveats).toContain('No active combat encounter.');
  });

  it('collects unsupported actor names without throwing', () => {
    const source: EncounterSource<FakeToken> = {
      combatants: [
        { token: makePcToken('pc-1', 'Mira') },
        { token: makeUnsupportedToken('bad-1', 'Broken Actor') }
      ]
    };

    const result = resolveEncounterParticipants(source, adapter);

    expect(result.pcs).toHaveLength(1);
    expect(result.hostiles).toEqual([]);
    expect(result.unsupported).toContain('Broken Actor');
  });

  it('puts allied/neutral combatants into neither bucket and records them as caveats', () => {
    const source: EncounterSource<FakeToken> = {
      combatants: [
        { token: makePcToken('pc-1', 'Mira') },
        { token: makeAllyToken('ally-1', 'Loyal Wolf') }
      ]
    };

    const result = resolveEncounterParticipants(source, adapter);

    expect(result.pcs).toHaveLength(1);
    expect(result.hostiles).toEqual([]);
    expect(result.caveats.some((c) => c.includes('Loyal Wolf'))).toBe(true);
  });

  it('survives a combatant whose token field is missing', () => {
    const source: EncounterSource<FakeToken> = {
      combatants: [
        { token: makePcToken('pc-1', 'Mira') },
        { token: undefined as unknown as FakeToken }
      ]
    };

    const result = resolveEncounterParticipants(source, adapter);

    expect(result.pcs).toHaveLength(1);
    expect(result.unsupported.length).toBeGreaterThanOrEqual(1);
  });
});
