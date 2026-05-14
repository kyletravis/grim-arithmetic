import { describe, expect, it } from 'vitest';
import { computeEncounterRiskMatrix, MAX_PAIRS } from '../src/engine/encounter-risk';
import { DEFAULT_PANEL_CONTROLS, buildMortalityPanelData } from '../src/ui/panel-data';
import { AttackSnapshot, CombatantSnapshot, SystemAdapter } from '../src/systems/base-adapter';
import { EncounterParticipants } from '../src/foundry/encounter-participants';

function makePc(id: string): { token: { id: string; name: string }; snapshot: CombatantSnapshot } {
  return {
    token: { id, name: `PC ${id}` },
    snapshot: {
      id,
      name: `PC ${id}`,
      disposition: 'pc',
      hp: { current: 20, max: 20 },
      defenses: { ac: 15 },
      traits: [],
      assumptions: []
    }
  };
}

function makeHostile(id: string): { token: { id: string; name: string }; snapshot: CombatantSnapshot } {
  return {
    token: { id, name: `Foe ${id}` },
    snapshot: {
      id,
      name: `Foe ${id}`,
      disposition: 'enemy',
      hp: { current: 30, max: 30 },
      defenses: { ac: 15 },
      traits: [],
      assumptions: []
    }
  };
}

const STANDARD_ATTACK: AttackSnapshot = {
  id: 'a',
  name: 'Strike',
  attackBonus: 10,
  damageFormula: '1d8+2',
  damageType: 'bludgeoning',
  traits: [],
  mapType: 'normal',
  assumptions: []
};

describe('MAX_PAIRS guardrail', () => {
  it('is set to a value that prevents runaway computation', () => {
    expect(MAX_PAIRS).toBeGreaterThan(0);
    expect(MAX_PAIRS).toBeLessThanOrEqual(500);
  });

  it('returns skipped=true when participants exceed the default MAX_PAIRS', () => {
    const pcs = Array.from({ length: MAX_PAIRS + 1 }, (_, i) => makePc(`p${i}`));
    const hostiles = [makeHostile('h1')];

    const participants: EncounterParticipants<{ id: string; name: string }> = {
      pcs,
      hostiles,
      unsupported: [],
      caveats: []
    };

    const adapter: SystemAdapter<{ id: string; name: string }> = {
      id: 'pf2e',
      label: 'Pathfinder Second Edition',
      getCombatantFromToken: () => null,
      getAttacksFromToken: () => [STANDARD_ATTACK]
    };

    const result = computeEncounterRiskMatrix(participants, {
      adapter,
      controls: DEFAULT_PANEL_CONTROLS,
      pairLimit: MAX_PAIRS
    });

    expect(result.skipped).toBe(true);
    expect(result.pairs).toEqual([]);
    expect(result.caveats.length).toBeGreaterThan(0);
  });
});

describe('detail-view regression', () => {
  it('still produces a single-pair risk payload independent of encounter wiring', () => {
    const pcToken = { id: 'pc-token' };
    const enemyToken = { id: 'enemy-token' };

    const adapter: SystemAdapter<object> = {
      id: 'pf2e',
      label: 'Pathfinder Second Edition',
      getCombatantFromToken(token) {
        if (token === pcToken) {
          return {
            id: 'pc-1',
            name: 'Mira',
            disposition: 'pc',
            hp: { current: 20, max: 20 },
            defenses: { ac: 18 },
            traits: [],
            assumptions: []
          };
        }
        return {
          id: 'enemy-1',
          name: 'Troll',
          disposition: 'enemy',
          hp: { current: 60, max: 60 },
          defenses: { ac: 16 },
          traits: [],
          assumptions: []
        };
      },
      getAttacksFromToken() {
        return [
          {
            id: 'claw',
            name: 'Claw',
            attackBonus: 14,
            damageFormula: '2d8+8',
            damageType: 'slashing',
            traits: [],
            mapType: 'normal',
            assumptions: []
          }
        ];
      }
    };

    const data = buildMortalityPanelData({
      selection: { subjectToken: pcToken, enemyToken, errors: [] },
      adapter,
      controls: DEFAULT_PANEL_CONTROLS,
      moduleVersion: '0.5.0'
    });

    expect(data.risk).toBeDefined();
    expect(data.risk?.downPercent).toBeGreaterThanOrEqual(0);
    expect(data.risk?.downPercent).toBeLessThanOrEqual(100);
    expect(data.subject?.name).toBe('Mira');
    expect(data.enemy?.name).toBe('Troll');
    expect(data.attack?.name).toBe('Claw');
  });
});
