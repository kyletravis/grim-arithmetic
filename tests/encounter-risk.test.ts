import { describe, expect, it } from 'vitest';
import { computeEncounterRiskMatrix } from '../src/engine/encounter-risk';
import { immediateDownRisk } from '../src/engine/mortality';
import { DEFAULT_PANEL_CONTROLS } from '../src/ui/panel-data';
import { AttackSnapshot, CombatantSnapshot, SystemAdapter } from '../src/systems/base-adapter';
import { EncounterParticipants } from '../src/foundry/encounter-participants';

function makePcSnapshot(id: string, name: string): CombatantSnapshot {
  return {
    id,
    name,
    disposition: 'pc',
    hp: { current: 24, max: 30 },
    defenses: { ac: 19 },
    deathState: { wounded: 0, doomed: 0, heroPoints: 1 },
    traits: [],
    assumptions: []
  };
}

function makeHostileSnapshot(id: string, name: string): CombatantSnapshot {
  return {
    id,
    name,
    disposition: 'enemy',
    hp: { current: 50, max: 50 },
    defenses: { ac: 17 },
    traits: [],
    assumptions: []
  };
}

function makeAttack(id: string, name: string, overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
  return {
    id,
    name,
    attackBonus: 12,
    damageFormula: '2d8+6',
    damageType: 'bludgeoning',
    traits: [],
    mapType: 'normal',
    assumptions: [],
    ...overrides
  };
}

type FakeToken = { id: string; name: string };
const pcToken1: FakeToken = { id: 'pc-1', name: 'Mira' };
const pcToken2: FakeToken = { id: 'pc-2', name: 'Seam' };
const enemyToken1: FakeToken = { id: 'npc-1', name: 'Troll' };
const enemyToken2: FakeToken = { id: 'npc-2', name: 'Cultist' };

function makeParticipants(): EncounterParticipants<FakeToken> {
  return {
    pcs: [
      { token: pcToken1, snapshot: makePcSnapshot('pc-1', 'Mira') },
      { token: pcToken2, snapshot: makePcSnapshot('pc-2', 'Seam') }
    ],
    hostiles: [
      { token: enemyToken1, snapshot: makeHostileSnapshot('npc-1', 'Troll') },
      { token: enemyToken2, snapshot: makeHostileSnapshot('npc-2', 'Cultist') }
    ],
    unsupported: [],
    caveats: []
  };
}

function makeAdapter(
  attacksByEnemyId: Record<string, AttackSnapshot[]>
): SystemAdapter<FakeToken> {
  return {
    id: 'pf2e',
    label: 'Pathfinder Second Edition',
    getCombatantFromToken() {
      return null;
    },
    getAttacksFromToken(token) {
      return attacksByEnemyId[token.id] ?? [];
    }
  };
}

describe('computeEncounterRiskMatrix', () => {
  it('generates one pair per (PC × hostile attack)', () => {
    const adapter = makeAdapter({
      'npc-1': [makeAttack('claw', 'Claw'), makeAttack('bite', 'Bite')],
      'npc-2': [makeAttack('dagger', 'Dagger')]
    });

    const result = computeEncounterRiskMatrix(makeParticipants(), {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS
    });

    expect(result.pairs).toHaveLength(2 * (2 + 1));
    expect(result.skipped).toBe(false);

    const labels = result.pairs.map((p) => `${p.pcName} vs ${p.enemyName} ${p.attackName}`);
    expect(labels).toContain('Mira vs Troll Claw');
    expect(labels).toContain('Seam vs Cultist Dagger');
  });

  it('reproduces the single-pair downProbability for a 1×1 encounter', () => {
    const attack = makeAttack('claw', 'Claw');
    const adapter = makeAdapter({ 'npc-1': [attack] });

    const participants: EncounterParticipants<FakeToken> = {
      pcs: [{ token: pcToken1, snapshot: makePcSnapshot('pc-1', 'Mira') }],
      hostiles: [{ token: enemyToken1, snapshot: makeHostileSnapshot('npc-1', 'Troll') }],
      unsupported: [],
      caveats: []
    };

    const result = computeEncounterRiskMatrix(participants, {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS
    });

    const directly = immediateDownRisk({
      hp: 24,
      ac: 19,
      attackBonus: 12,
      damageFormula: '2d8+6',
      strikes: DEFAULT_PANEL_CONTROLS.strikes,
      mapType: 'normal',
      wounded: 0,
      doomed: 0,
      assumeHeroPointAvailable: true,
      damageType: 'bludgeoning',
      targetAdjustments: undefined
    });

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].downProbability).toBeCloseTo(directly.downProbability, 10);
    expect(result.pairs[0].riskLabel).toBe(directly.riskLabel);
  });

  it('isolates failures so one bad pair does not poison the rest', () => {
    const adapter: SystemAdapter<FakeToken> = {
      id: 'pf2e',
      label: 'Pathfinder Second Edition',
      getCombatantFromToken() {
        return null;
      },
      getAttacksFromToken(token) {
        if (token.id === 'npc-1') {
          return [makeAttack('broken', 'Broken Strike', { damageFormula: 'not-a-valid-formula' })];
        }
        return [makeAttack('claw', 'Claw')];
      }
    };

    const result = computeEncounterRiskMatrix(makeParticipants(), {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS
    });

    const goodPairs = result.pairs.filter((p) => p.enemyId === 'npc-2');
    expect(goodPairs.length).toBeGreaterThan(0);
    const badPairs = result.pairs.filter((p) => p.enemyId === 'npc-1');
    badPairs.forEach((pair) => {
      expect(pair.caveats.length).toBeGreaterThan(0);
    });
  });

  it('records a caveat when a hostile has no supported attacks', () => {
    const adapter = makeAdapter({});

    const result = computeEncounterRiskMatrix(makeParticipants(), {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS
    });

    expect(result.pairs).toEqual([]);
    expect(result.caveats.some((c) => c.toLowerCase().includes('no supported'))).toBe(true);
  });

  it('returns skipped=true with a guardrail caveat when pair count exceeds pairLimit', () => {
    const adapter = makeAdapter({
      'npc-1': [makeAttack('a', 'A'), makeAttack('b', 'B')],
      'npc-2': [makeAttack('c', 'C')]
    });

    const result = computeEncounterRiskMatrix(makeParticipants(), {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS,
      pairLimit: 2
    });

    expect(result.skipped).toBe(true);
    expect(result.pairs).toEqual([]);
    expect(result.caveats.some((c) => c.toLowerCase().includes('too large'))).toBe(true);
  });
});
