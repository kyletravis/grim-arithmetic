import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/prng';
import type { SimulationCombatant } from '../../src/engine/simulation-types';
import { pcDefaultTactics } from '../../src/engine/tactics/pc-default';
import type { TacticsContext } from '../../src/engine/tactics/tactics-types';
import type { AttackSnapshot } from '../../src/systems/base-adapter';

function makeAttack(overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
  return {
    id: 'longsword',
    name: 'Longsword',
    attackBonus: 10,
    damageFormula: '1d8+4',
    damageType: 'slashing',
    traits: [],
    mapType: 'normal',
    assumptions: [],
    ...overrides
  };
}

function makePc(id: string, attacks: AttackSnapshot[]): SimulationCombatant {
  return {
    id,
    name: id,
    side: 'pc',
    hp: { current: 24, max: 24, temp: 0 },
    defenses: { ac: 20 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 5,
    traits: [],
    attacks
  };
}

function makeEnemy(
  id: string,
  attacks: AttackSnapshot[],
  overrides: Partial<SimulationCombatant> = {}
): SimulationCombatant {
  return {
    id,
    name: id,
    side: 'enemy',
    hp: { current: 30, max: 30, temp: 0 },
    defenses: { ac: 19 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 3,
    traits: [],
    attacks,
    ...overrides
  };
}

function makeContext(
  attacker: SimulationCombatant,
  enemies: SimulationCombatant[]
): TacticsContext {
  return { attacker, pcs: [attacker], enemies, round: 1 };
}

describe('pcDefaultTactics: target selection', () => {
  it('targets the enemy with the highest mean damage attack', () => {
    const big = makeEnemy('boss', [makeAttack({ id: 'cleave', damageFormula: '3d8+8' })], {
      hp: { current: 60, max: 60, temp: 0 }
    });
    const small = makeEnemy('mook', [makeAttack({ id: 'jab', damageFormula: '1d4+1' })], {
      hp: { current: 8, max: 8, temp: 0 }
    });
    const pc = makePc('mira', [makeAttack()]);

    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [big, small]), createRng('seed'));
    expect(plan.strikes).toHaveLength(2);
    expect(plan.strikes.every((s) => s.targetId === 'boss')).toBe(true);
  });

  it('breaks threat ties by current HP ascending (finish off the wounded)', () => {
    const wounded = makeEnemy('wounded', [makeAttack({ damageFormula: '1d8+4' })], {
      hp: { current: 5, max: 30, temp: 0 }
    });
    const fresh = makeEnemy('fresh', [makeAttack({ damageFormula: '1d8+4' })], {
      hp: { current: 30, max: 30, temp: 0 }
    });
    const pc = makePc('mira', [makeAttack()]);

    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [wounded, fresh]), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('wounded');
  });

  it('breaks complete ties by id ascending', () => {
    const e1 = makeEnemy('aaa', [makeAttack({ damageFormula: '1d6+2' })], {
      hp: { current: 10, max: 30, temp: 0 }
    });
    const e2 = makeEnemy('bbb', [makeAttack({ damageFormula: '1d6+2' })], {
      hp: { current: 10, max: 30, temp: 0 }
    });
    const pc = makePc('mira', [makeAttack()]);

    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [e1, e2]), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('aaa');
  });

  it('skips downed enemies', () => {
    const downed = makeEnemy('downed', [makeAttack({ damageFormula: '5d12+10' })], {
      downed: true,
      hp: { current: 0, max: 30, temp: 0 }
    });
    const standing = makeEnemy('standing', [makeAttack({ damageFormula: '1d4+1' })]);
    const pc = makePc('mira', [makeAttack()]);

    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [downed, standing]), createRng('seed'));
    expect(plan.strikes.every((s) => s.targetId === 'standing')).toBe(true);
  });
});

describe('pcDefaultTactics: turn structure', () => {
  it('produces exactly 2 strikes per turn (DEFAULT_STRIKES_PER_TURN)', () => {
    const pc = makePc('mira', [makeAttack()]);
    const enemy = makeEnemy('e1', [makeAttack({ damageFormula: '1d8+3' })]);
    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [enemy]), createRng('seed'));
    expect(plan.strikes).toHaveLength(2);
    expect(plan.strikes[0].mapIndex).toBe(0);
    expect(plan.strikes[1].mapIndex).toBe(1);
  });

  it('uses the PC first attack for every strike', () => {
    const sword = makeAttack({ id: 'longsword', name: 'Longsword' });
    const bow = makeAttack({ id: 'shortbow', name: 'Shortbow', damageFormula: '1d6+3' });
    const pc = makePc('mira', [sword, bow]);
    const enemy = makeEnemy('e1', [makeAttack({ damageFormula: '1d6+2' })]);

    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [enemy]), createRng('seed'));
    expect(plan.strikes.every((s) => s.attackId === 'longsword')).toBe(true);
  });
});

describe('pcDefaultTactics: skip-turn cases', () => {
  it('skips the turn when no standing enemies remain', () => {
    const downed = makeEnemy('e1', [makeAttack()], { downed: true, hp: { current: 0, max: 30, temp: 0 } });
    const pc = makePc('mira', [makeAttack()]);
    expect(pcDefaultTactics.chooseTurn(makeContext(pc, [downed]), createRng('seed')).strikes).toHaveLength(0);
  });

  it('skips the turn when the PC has no attacks', () => {
    const pc = makePc('mira', []);
    const enemy = makeEnemy('e1', [makeAttack()]);
    expect(pcDefaultTactics.chooseTurn(makeContext(pc, [enemy]), createRng('seed')).strikes).toHaveLength(0);
  });

  it('tolerates enemies with unparseable damage formulas (threat score 0)', () => {
    const weird = makeEnemy('weird', [makeAttack({ damageFormula: 'persistent fire' })]);
    const real = makeEnemy('real', [makeAttack({ damageFormula: '2d10+8' })]);
    const pc = makePc('mira', [makeAttack()]);

    const plan = pcDefaultTactics.chooseTurn(makeContext(pc, [weird, real]), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('real');
  });
});

describe('pcDefaultTactics: determinism', () => {
  it('produces the same plan across two calls with the same state', () => {
    const pc = makePc('mira', [makeAttack()]);
    const enemies = [makeEnemy('e1', [makeAttack()])];
    const a = pcDefaultTactics.chooseTurn(makeContext(pc, enemies), createRng('seed-1'));
    const b = pcDefaultTactics.chooseTurn(makeContext(pc, enemies), createRng('seed-1'));
    expect(a).toEqual(b);
  });
});
