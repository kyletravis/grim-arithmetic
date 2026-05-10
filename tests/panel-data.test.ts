import { describe, expect, it } from 'vitest';
import { buildMortalityPanelData, DEFAULT_PANEL_CONTROLS } from '../src/ui/panel-data';
import { SystemAdapter } from '../src/systems/base-adapter';

const pcToken = { id: 'pc-token' };
const enemyToken = { id: 'enemy-token' };

const adapter: SystemAdapter<object> = {
  id: 'pf2e',
  label: 'Pathfinder Second Edition',
  getCombatantFromToken(token) {
    if (token === pcToken) {
      return {
        id: 'pc-1',
        name: 'Mira Stormwake',
        disposition: 'pc',
        hp: { current: 18, max: 31, temp: 2 },
        defenses: { ac: 19 },
        deathState: { wounded: 1 },
        traits: ['human'],
        assumptions: []
      };
    }

    return {
      id: 'enemy-1',
      name: 'Table Ogre',
      disposition: 'enemy',
      hp: { current: 50, max: 50 },
      defenses: { ac: 17 },
      traits: ['giant'],
      assumptions: []
    };
  },
  getAttacksFromToken() {
    return [
      {
        id: 'jaws',
        name: 'Jaws',
        attackBonus: 12,
        damageFormula: '2d8+6',
        traits: ['unarmed'],
        mapType: 'normal',
        assumptions: ['first strike assumption']
      },
      {
        id: 'claw',
        name: 'Claw',
        attackBonus: 10,
        damageFormula: '1d6+4',
        traits: ['agile'],
        mapType: 'agile',
        assumptions: ['agile strike assumption']
      }
    ];
  }
};

describe('buildMortalityPanelData', () => {
  it('shows module version and lets the GM choose among supported enemy Strikes', () => {
    const data = buildMortalityPanelData({
      selection: { subjectToken: pcToken, enemyToken, errors: [] },
      adapter,
      controls: { ...DEFAULT_PANEL_CONTROLS, attackId: 'claw' },
      moduleVersion: '0.1.1'
    });

    expect(data.moduleVersion).toBe('0.1.1');
    expect(data.controls.attacks).toEqual([
      { value: 'jaws', label: 'Jaws — +12, 2d8+6', selected: false },
      { value: 'claw', label: 'Claw — +10, 1d6+4', selected: true }
    ]);
    expect(data.attack).toMatchObject({ id: 'claw', name: 'Claw', mapType: 'agile' });
    expect(data.risk?.assumptions).toContain('agile strike assumption');
    expect(data.risk?.damage).toMatchObject({ min: 5, max: 10, average: '7.5', critMin: 10, critMax: 20 });
  });

  it('falls back to the first supported Strike when the previous selection no longer exists', () => {
    const data = buildMortalityPanelData({
      selection: { subjectToken: pcToken, enemyToken, errors: [] },
      adapter,
      controls: { ...DEFAULT_PANEL_CONTROLS, attackId: 'missing-strike' },
      moduleVersion: '0.1.1'
    });

    expect(data.attack).toMatchObject({ id: 'jaws', name: 'Jaws' });
    expect(data.controls.attacks[0]?.selected).toBe(true);
  });

  it('reports role and extraction problems in table-facing language', () => {
    const badAdapter: SystemAdapter<object> = {
      ...adapter,
      getCombatantFromToken(token) {
        if (token === pcToken) return { ...adapter.getCombatantFromToken(pcToken)!, disposition: 'neutral' };
        return { ...adapter.getCombatantFromToken(enemyToken)!, disposition: 'pc' };
      },
      getAttacksFromToken() {
        return [];
      }
    };

    const data = buildMortalityPanelData({
      selection: { subjectToken: pcToken, enemyToken, errors: [] },
      adapter: badAdapter,
      controls: DEFAULT_PANEL_CONTROLS,
      moduleVersion: '0.1.1'
    });

    expect(data.errors).toEqual([
      'Selected token is not recognized as a PC/character by the PF2e adapter.',
      'Targeted token is not recognized as an enemy/NPC by the PF2e adapter.',
      'Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula.'
    ]);
  });
});
