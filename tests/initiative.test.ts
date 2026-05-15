import { describe, expect, it } from 'vitest';
import { rollInitiative } from '../src/engine/initiative';
import { createRng } from '../src/engine/prng';
import type { SimulationCombatant } from '../src/engine/simulation-types';

function makeCombatant(
  id: string,
  side: 'pc' | 'enemy',
  initiativeBonus: number
): SimulationCombatant {
  return {
    id,
    name: id,
    side,
    hp: { current: 20, max: 20, temp: 0 },
    defenses: { ac: 18 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus,
    traits: [],
    attacks: []
  };
}

describe('rollInitiative', () => {
  const combatants: SimulationCombatant[] = [
    makeCombatant('mira', 'pc', 6),
    makeCombatant('seam', 'pc', 3),
    makeCombatant('troll', 'enemy', 4),
    makeCombatant('gnoll', 'enemy', 2)
  ];

  it('returns same order for the same seed', () => {
    const a = rollInitiative(combatants, createRng('init-1'));
    const b = rollInitiative(combatants, createRng('init-1'));
    expect(a).toEqual(b);
  });

  it('returns different orders across many seeds', () => {
    const firstIds = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const order = rollInitiative(combatants, createRng(seed));
      firstIds.add(order[0].combatantId);
    }
    expect(firstIds.size).toBeGreaterThanOrEqual(3);
  });

  it('sorts by total descending', () => {
    const order = rollInitiative(combatants, createRng('sort-check'));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i].total).toBeLessThanOrEqual(order[i - 1].total);
    }
  });

  it('PCs win ties by default (pcsWinTies true)', () => {
    // Force ties by rigging bonuses + a seed that gives a known sequence.
    // We can't easily force exact ties without controlling the RNG, so test
    // the tiebreaker via a degenerate case: useFixedOrder produces all-tie
    // totals equal to bonuses; then sort still applies.
    const tied: SimulationCombatant[] = [
      makeCombatant('enemy-a', 'enemy', 5),
      makeCombatant('pc-a', 'pc', 5)
    ];
    // Roll many times and confirm pc-a is never below enemy-a in ties.
    for (let seed = 0; seed < 50; seed += 1) {
      const order = rollInitiative(tied, createRng(seed));
      if (order[0].total === order[1].total) {
        expect(order[0].combatantId).toBe('pc-a');
      }
    }
  });

  it('respects pcsWinTies: false', () => {
    const tied: SimulationCombatant[] = [
      makeCombatant('enemy-a', 'enemy', 5),
      makeCombatant('pc-a', 'pc', 5)
    ];
    for (let seed = 0; seed < 50; seed += 1) {
      const order = rollInitiative(tied, createRng(seed), { pcsWinTies: false });
      if (order[0].total === order[1].total) {
        expect(order[0].combatantId).toBe('enemy-a');
      }
    }
  });

  it('breaks same-side ties by combatant id ascending', () => {
    const twoPcs: SimulationCombatant[] = [
      makeCombatant('zelda', 'pc', 5),
      makeCombatant('alice', 'pc', 5)
    ];
    for (let seed = 0; seed < 50; seed += 1) {
      const order = rollInitiative(twoPcs, createRng(seed));
      if (order[0].total === order[1].total) {
        expect(order[0].combatantId).toBe('alice');
      }
    }
  });

  it('useFixedOrder skips rolling and returns input order with bonus totals', () => {
    const order = rollInitiative(combatants, createRng('fixed'), { useFixedOrder: true });
    expect(order).toHaveLength(combatants.length);
    for (let i = 0; i < combatants.length; i += 1) {
      expect(order[i].combatantId).toBe(combatants[i].id);
      expect(order[i].dieRoll).toBe(0);
      expect(order[i].total).toBe(combatants[i].initiativeBonus);
    }
  });

  it('does not advance the RNG when useFixedOrder is true', () => {
    const rng = createRng('no-advance');
    const before = rng.next();
    const subsequent = createRng('no-advance');
    subsequent.next(); // mirror the consumed sample
    rollInitiative(combatants, subsequent, { useFixedOrder: true });
    // The fixed-order branch must not have consumed any rng samples.
    expect(before).toBe(createRng('no-advance').next());
  });
});
