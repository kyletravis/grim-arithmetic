import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/prng';
import type { SimulationCombatant } from '../../src/engine/simulation-types';
import { TACTICS_PROFILES, type TacticsContext } from '../../src/engine/tactics';
import type { AttackSnapshot } from '../../src/systems/base-adapter';

function makeAttack(overrides: Partial<AttackSnapshot> = {}): AttackSnapshot {
  return {
    id: 'claw',
    name: 'Claw',
    attackBonus: 10,
    damageFormula: '1d8+4',
    damageType: 'slashing',
    traits: [],
    mapType: 'normal',
    assumptions: [],
    ...overrides
  };
}

function makePc(
  id: string,
  overrides: Partial<SimulationCombatant> = {}
): SimulationCombatant {
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
    initiativeBonus: 0,
    traits: [],
    attacks: [],
    ...overrides
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
    hp: { current: 40, max: 40, temp: 0 },
    defenses: { ac: 18 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    downed: false,
    dead: false,
    initiativeBonus: 0,
    traits: [],
    attacks,
    ...overrides
  };
}

function makeContext(
  attacker: SimulationCombatant,
  pcs: SimulationCombatant[]
): TacticsContext {
  return { attacker, pcs, enemies: [attacker], round: 1 };
}

describe('TACTICS_PROFILES registry', () => {
  it('contains every documented profile', () => {
    expect(Object.keys(TACTICS_PROFILES).sort()).toEqual([
      'boss-cinematic',
      'focus-fire',
      'predator',
      'random-legal',
      'spread-damage'
    ]);
  });
});

describe('random-legal tactics', () => {
  const profile = TACTICS_PROFILES['random-legal'];
  const enemy = makeEnemy('boss', [makeAttack({ id: 'claw' }), makeAttack({ id: 'bite', damageFormula: '1d10+4' })]);
  const pcs = [makePc('mira'), makePc('seam'), makePc('jor')];

  it('produces DEFAULT_STRIKES_PER_TURN strikes (2) when targets exist', () => {
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('rng-1'));
    expect(plan.strikes).toHaveLength(2);
  });

  it('never selects a downed target', () => {
    const mixed = [
      makePc('mira', { downed: true, hp: { current: 0, max: 20, temp: 0 } }),
      makePc('seam'),
      makePc('jor')
    ];
    for (let seed = 0; seed < 100; seed += 1) {
      const plan = profile.chooseTurn(makeContext(enemy, mixed), createRng(seed));
      for (const strike of plan.strikes) {
        expect(strike.targetId).not.toBe('mira');
      }
    }
  });

  it('is reproducible with the same seed', () => {
    const a = profile.chooseTurn(makeContext(enemy, pcs), createRng('reproducible'));
    const b = profile.chooseTurn(makeContext(enemy, pcs), createRng('reproducible'));
    expect(a).toEqual(b);
  });

  it('returns no strikes when all PCs are downed', () => {
    const downedAll = pcs.map((pc) => makePc(pc.id, { downed: true, hp: { current: 0, max: 20, temp: 0 } }));
    const plan = profile.chooseTurn(makeContext(enemy, downedAll), createRng('seed'));
    expect(plan.strikes).toHaveLength(0);
  });

  it('returns no strikes when the attacker has no attacks', () => {
    const noAttacks = makeEnemy('boss', []);
    const plan = profile.chooseTurn(makeContext(noAttacks, pcs), createRng('seed'));
    expect(plan.strikes).toHaveLength(0);
  });
});

describe('spread-damage tactics', () => {
  const profile = TACTICS_PROFILES['spread-damage'];
  const enemy = makeEnemy('boss', [makeAttack()]);

  it('never targets a downed PC', () => {
    const pcs = [
      makePc('mira', { downed: true, hp: { current: 0, max: 20, temp: 0 } }),
      makePc('seam', { hp: { current: 20, max: 20, temp: 0 } }),
      makePc('jor', { hp: { current: 18, max: 20, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    for (const strike of plan.strikes) {
      expect(strike.targetId).not.toBe('mira');
    }
  });

  it('strike 1 targets the higher-HP PC and strike 2 the next', () => {
    const pcs = [
      makePc('mira', { hp: { current: 10, max: 24, temp: 0 } }),
      makePc('seam', { hp: { current: 22, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('seam');
    expect(plan.strikes[1].targetId).toBe('mira');
  });

  it('wraps to the same target when only one PC is standing', () => {
    const pcs = [
      makePc('mira', { downed: true, hp: { current: 0, max: 20, temp: 0 } }),
      makePc('seam')
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('seam');
    expect(plan.strikes[1].targetId).toBe('seam');
  });
});

describe('focus-fire tactics', () => {
  const profile = TACTICS_PROFILES['focus-fire'];
  const enemy = makeEnemy('boss', [makeAttack()]);

  it('targets the lowest-HP standing PC for every strike', () => {
    const pcs = [
      makePc('mira', { hp: { current: 22, max: 24, temp: 0 } }),
      makePc('seam', { hp: { current: 5, max: 24, temp: 0 } }),
      makePc('jor', { hp: { current: 18, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    for (const strike of plan.strikes) {
      expect(strike.targetId).toBe('seam');
    }
  });

  it('skips a downed PC even if it has lowest "HP" (0)', () => {
    const pcs = [
      makePc('mira', { downed: true, hp: { current: 0, max: 24, temp: 0 } }),
      makePc('seam', { hp: { current: 8, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('seam');
  });
});

describe('predator tactics', () => {
  const profile = TACTICS_PROFILES.predator;
  const enemy = makeEnemy('boss', [makeAttack()]);

  it('prefers wounded PCs over fresher ones', () => {
    const pcs = [
      makePc('mira', { wounded: 0, hp: { current: 10, max: 24, temp: 0 } }),
      makePc('seam', { wounded: 1, hp: { current: 18, max: 24, temp: 0 } }),
      makePc('jor', { wounded: 0, hp: { current: 22, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('seam');
  });

  it('breaks ties by lowest HP within the highest wounded tier', () => {
    const pcs = [
      makePc('mira', { wounded: 1, hp: { current: 18, max: 24, temp: 0 } }),
      makePc('seam', { wounded: 1, hp: { current: 6, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('seam');
  });

  it('attacks downed PCs only when no standing PCs remain', () => {
    const allDowned = [
      makePc('mira', { downed: true, hp: { current: 0, max: 24, temp: 0 } }),
      makePc('seam', { downed: true, hp: { current: 0, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, allDowned), createRng('seed'));
    expect(plan.strikes).toHaveLength(2);
    expect(['mira', 'seam']).toContain(plan.strikes[0].targetId);
  });

  it('returns no strikes when every PC is dead', () => {
    const allDead = [
      makePc('mira', { dead: true, downed: true, hp: { current: 0, max: 24, temp: 0 } }),
      makePc('seam', { dead: true, downed: true, hp: { current: 0, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, allDead), createRng('seed'));
    expect(plan.strikes).toHaveLength(0);
  });
});

describe('boss-cinematic tactics', () => {
  const profile = TACTICS_PROFILES['boss-cinematic'];
  const heavyAttack = makeAttack({ id: 'cleave', damageFormula: '3d8+10' });
  const lightAttack = makeAttack({ id: 'jab', damageFormula: '1d4+2' });
  const enemy = makeEnemy('boss', [lightAttack, heavyAttack]);

  it('uses the highest-mean-damage attack for all strikes', () => {
    const pcs = [makePc('mira'), makePc('seam')];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes).toHaveLength(2);
    for (const strike of plan.strikes) {
      expect(strike.attackId).toBe('cleave');
    }
  });

  it('targets the highest-HP standing PC (the toughest target)', () => {
    const pcs = [
      makePc('mira', { hp: { current: 22, max: 24, temp: 0 } }),
      makePc('seam', { hp: { current: 8, max: 24, temp: 0 } })
    ];
    const plan = profile.chooseTurn(makeContext(enemy, pcs), createRng('seed'));
    expect(plan.strikes[0].targetId).toBe('mira');
    expect(plan.strikes[1].targetId).toBe('mira');
  });

  it('falls back to the only available attack when the highest-damage pick is unparseable', () => {
    const onlyWeird = makeEnemy('weird', [makeAttack({ id: 'unparseable', damageFormula: 'persistent fire' })]);
    const plan = profile.chooseTurn(makeContext(onlyWeird, [makePc('mira')]), createRng('seed'));
    expect(plan.strikes).toHaveLength(2);
    expect(plan.strikes[0].attackId).toBe('unparseable');
  });
});

describe('all profiles share determinism with the same seed', () => {
  const enemy = makeEnemy('boss', [makeAttack()]);
  const pcs = [makePc('mira'), makePc('seam'), makePc('jor')];

  for (const id of Object.keys(TACTICS_PROFILES) as Array<keyof typeof TACTICS_PROFILES>) {
    it(`${id} produces identical plans for identical seeds`, () => {
      const profile = TACTICS_PROFILES[id];
      const a = profile.chooseTurn(makeContext(enemy, pcs), createRng('shared-seed'));
      const b = profile.chooseTurn(makeContext(enemy, pcs), createRng('shared-seed'));
      expect(a).toEqual(b);
    });
  }
});
