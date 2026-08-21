import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pf2eAdapter, type Pf2eTokenLike } from '../src/systems/pf2e-adapter';
import { buildLiveFixture } from '../src/debug-capture';

const dir = join(process.cwd(), 'tests/fixtures/live');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const adapter = new Pf2eAdapter();

describe('live fixtures (drop exportLiveFixture() output into tests/fixtures/live/)', () => {
  it('buildLiveFixture round-trips through the adapter', () => {
    const fixture = buildLiveFixture({
      id: 't',
      name: 'Goblin',
      document: { disposition: -1 },
      actor: {
        id: 'a',
        name: 'Goblin',
        type: 'npc',
        system: { attributes: { hp: { value: 6, max: 6 }, ac: { value: 16 } } },
        items: [
          {
            id: 'm',
            name: 'Dogslicer',
            type: 'melee',
            system: {
              bonus: { value: 8 },
              damageRolls: { a: { damage: '1d6+2', damageType: 'slashing' } },
              traits: { value: ['agile'] }
            }
          }
        ]
      }
    });
    expect(adapter.getCombatantFromToken(fixture.token as Pf2eTokenLike)?.disposition).toBe(
      'enemy'
    );
    expect(adapter.getAttacksFromToken(fixture.token as Pf2eTokenLike)).toHaveLength(1);
  });

  for (const file of files) {
    it(`extracts ${file}`, () => {
      const fixture = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const token = fixture.token as Pf2eTokenLike;
      const snapshot = adapter.getCombatantFromToken(token);
      expect(snapshot).not.toBeNull();
      if (fixture.expect?.disposition)
        expect(snapshot!.disposition).toBe(fixture.expect.disposition);
      const attacks = adapter.getAttacksFromToken(token);
      if (fixture.expect?.minAttacks !== undefined)
        expect(attacks.length).toBeGreaterThanOrEqual(fixture.expect.minAttacks);
      if (fixture.expect?.attackBonusAtLeast !== undefined) {
        expect(Math.max(...attacks.map((a) => a.attackBonus))).toBeGreaterThanOrEqual(
          fixture.expect.attackBonusAtLeast
        );
      }
    });
  }
});
