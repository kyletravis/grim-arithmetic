import { describe, expect, it } from 'vitest';
import { Pf2eAdapter } from '../src/systems/pf2e-adapter';

function condition(slug: string, value: number) {
  return { slug, value };
}

describe('Pf2eAdapter combatant extraction', () => {
  it('extracts a PF2e character combatant snapshot from token actor data', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      id: 'token-1',
      name: 'Mira Stormwake',
      document: { disposition: 1 },
      actor: {
        id: 'actor-1',
        name: 'Mira',
        type: 'character',
        system: {
          attributes: {
            hp: { value: 23, max: 31, temp: 4 },
            ac: { value: 19 }
          },
          saves: {
            fortitude: { value: 8 },
            reflex: { value: 7 },
            will: { value: 10 }
          },
          resources: {
            heroPoints: { value: 1 }
          },
          traits: { value: ['human', 'druid'] }
        },
        itemTypes: {
          condition: [condition('wounded', 1), condition('dying', 0), condition('doomed', 0)]
        }
      }
    };

    const snapshot = adapter.getCombatantFromToken(token);

    expect(snapshot).toMatchObject({
      id: 'token-1',
      name: 'Mira Stormwake',
      disposition: 'pc',
      hp: { current: 23, max: 31, temp: 4 },
      defenses: { ac: 19, fort: 8, reflex: 7, will: 10 },
      deathState: { dying: 0, wounded: 1, doomed: 0, heroPoints: 1 },
      traits: ['human', 'druid']
    });
  });

  it('returns null when required HP or AC fields are missing', () => {
    const adapter = new Pf2eAdapter();
    const token = {
      actor: {
        type: 'character',
        system: {
          attributes: {
            hp: { value: 10, max: 20 }
          }
        }
      }
    };

    expect(adapter.getCombatantFromToken(token)).toBeNull();
  });
});
