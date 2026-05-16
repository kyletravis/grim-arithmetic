import { describe, expect, it } from 'vitest';
import { applyDamage, deathThresholdFor } from '../src/engine/sim-state';
import type { SimulationCombatant } from '../src/engine/simulation-types';

function makePc(overrides: Partial<SimulationCombatant> = {}): SimulationCombatant {
  return {
    id: 'pc-1',
    name: 'Mira',
    side: 'pc',
    hp: { current: 24, max: 24, temp: 0 },
    defenses: { ac: 21 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    heroPointSurvivalUsed: false,
    downed: false,
    dead: false,
    initiativeBonus: 4,
    traits: [],
    attacks: [],
    ...overrides
  };
}

function makeEnemy(overrides: Partial<SimulationCombatant> = {}): SimulationCombatant {
  return {
    id: 'enemy-1',
    name: 'Troll Mauler',
    side: 'enemy',
    hp: { current: 30, max: 30, temp: 0 },
    defenses: { ac: 19 },
    dying: 0,
    wounded: 0,
    doomed: 0,
    heroPoints: 0,
    heroPointSurvivalUsed: false,
    downed: false,
    dead: false,
    initiativeBonus: 4,
    traits: [],
    attacks: [],
    ...overrides
  };
}

describe('applyDamage', () => {
  it('drains temp HP first', () => {
    const pc = makePc({ hp: { current: 20, max: 20, temp: 5 } });
    const result = applyDamage(pc, { damage: 3, degree: 'success' });
    expect(result.combatant.hp.temp).toBe(2);
    expect(result.combatant.hp.current).toBe(20);
    expect(result.becameDowned).toBe(false);
  });

  it('spills overflow from temp HP into current HP', () => {
    const pc = makePc({ hp: { current: 20, max: 20, temp: 5 } });
    const result = applyDamage(pc, { damage: 12, degree: 'success' });
    expect(result.combatant.hp.temp).toBe(0);
    expect(result.combatant.hp.current).toBe(13);
  });

  it('never reduces current HP below 0', () => {
    const pc = makePc({ hp: { current: 5, max: 20, temp: 0 } });
    const result = applyDamage(pc, { damage: 50, degree: 'success' });
    expect(result.combatant.hp.current).toBe(0);
  });

  it('normal hit that drops PC sets dying = 1 + wounded', () => {
    const pc = makePc({ hp: { current: 4, max: 20, temp: 0 }, wounded: 0 });
    const result = applyDamage(pc, { damage: 4, degree: 'success' });
    expect(result.combatant.downed).toBe(true);
    expect(result.combatant.dying).toBe(1);
    expect(result.combatant.dead).toBe(false);
    expect(result.becameDowned).toBe(true);
  });

  it('critical hit that drops PC sets dying = 2 + wounded', () => {
    const pc = makePc({ hp: { current: 4, max: 20, temp: 0 }, wounded: 0 });
    const result = applyDamage(pc, { damage: 4, degree: 'criticalSuccess' });
    expect(result.combatant.dying).toBe(2);
  });

  it('wounded 1 + normal down becomes Dying 2', () => {
    const pc = makePc({ hp: { current: 4, max: 20, temp: 0 }, wounded: 1 });
    const result = applyDamage(pc, { damage: 4, degree: 'success' });
    expect(result.combatant.dying).toBe(2);
  });

  it('wounded 2 + crit down reaches Dying 4 (default death threshold)', () => {
    const pc = makePc({ hp: { current: 4, max: 20, temp: 0 }, wounded: 2 });
    const result = applyDamage(pc, { damage: 4, degree: 'criticalSuccess' });
    expect(result.combatant.dying).toBe(4);
    expect(result.combatant.dead).toBe(true);
    expect(result.becameDead).toBe(true);
  });

  it('doomed 1 lowers death threshold to 3', () => {
    const pc = makePc({ hp: { current: 4, max: 20, temp: 0 }, wounded: 1, doomed: 1 });
    const result = applyDamage(pc, { damage: 4, degree: 'criticalSuccess' });
    expect(result.combatant.dying).toBe(3);
    expect(result.combatant.dead).toBe(true);
  });

  it('doomed 3 lowers death threshold to 1', () => {
    const pc = makePc({ doomed: 3 });
    expect(deathThresholdFor(pc)).toBe(1);
  });

  it('hits on already-dying PC increment dying by 1 on normal hit', () => {
    const pc = makePc({ hp: { current: 0, max: 20, temp: 0 }, dying: 1, downed: true });
    const result = applyDamage(pc, { damage: 5, degree: 'success' });
    expect(result.combatant.dying).toBe(2);
    expect(result.becameDowned).toBe(false);
  });

  it('hits on already-dying PC increment dying by 2 on crit', () => {
    const pc = makePc({ hp: { current: 0, max: 20, temp: 0 }, dying: 1, downed: true });
    const result = applyDamage(pc, { damage: 5, degree: 'criticalSuccess' });
    expect(result.combatant.dying).toBe(3);
  });

  it('enemy at 0 HP is marked dead directly (no dying spiral)', () => {
    const enemy = makeEnemy({ hp: { current: 3, max: 30, temp: 0 } });
    const result = applyDamage(enemy, { damage: 10, degree: 'success' });
    expect(result.combatant.dying).toBe(0);
    expect(result.combatant.downed).toBe(true);
    expect(result.combatant.dead).toBe(true);
    expect(result.becameDead).toBe(true);
  });

  it('dead target is a no-op', () => {
    const pc = makePc({ dead: true, dying: 4, downed: true, hp: { current: 0, max: 20, temp: 0 } });
    const result = applyDamage(pc, { damage: 50, degree: 'criticalSuccess' });
    expect(result.combatant).toBe(pc);
    expect(result.damageAbsorbed).toBe(0);
    expect(result.becameDead).toBe(false);
  });

  it('zero or negative damage is a no-op', () => {
    const pc = makePc();
    expect(applyDamage(pc, { damage: 0, degree: 'success' }).combatant).toBe(pc);
    expect(applyDamage(pc, { damage: -3, degree: 'success' }).combatant).toBe(pc);
  });

  it('does not mutate the input combatant', () => {
    const pc = makePc({ hp: { current: 4, max: 20, temp: 0 } });
    const snapshot = JSON.stringify(pc);
    applyDamage(pc, { damage: 10, degree: 'criticalSuccess' });
    expect(JSON.stringify(pc)).toBe(snapshot);
  });
});

describe('applyDamage: Hero Point survival (KHT-94)', () => {
  it('spends a Hero Point to avoid death; survives at dying 0', () => {
    const pc = makePc({
      hp: { current: 1, max: 20, temp: 0 },
      wounded: 3,
      heroPoints: 1
    });
    // 1 damage drops HP to 0; dying = 1 + 3 wounded = 4 = death threshold.
    const result = applyDamage(pc, { damage: 1, degree: 'success' });
    expect(result.combatant.dead).toBe(false);
    expect(result.combatant.dying).toBe(0);
    expect(result.combatant.downed).toBe(true);
    expect(result.combatant.heroPoints).toBe(0);
    expect(result.combatant.heroPointSurvivalUsed).toBe(true);
    expect(result.heroPointSurvivalFired).toBe(true);
  });

  it('does not survive when already used HP survival this iteration', () => {
    const pc = makePc({
      hp: { current: 1, max: 20, temp: 0 },
      wounded: 3,
      heroPoints: 1,
      heroPointSurvivalUsed: true
    });
    const result = applyDamage(pc, { damage: 1, degree: 'success' });
    expect(result.combatant.dead).toBe(true);
    expect(result.combatant.heroPoints).toBe(1);
  });

  it('does not survive when no Hero Points remain', () => {
    const pc = makePc({
      hp: { current: 1, max: 20, temp: 0 },
      wounded: 3,
      heroPoints: 0
    });
    const result = applyDamage(pc, { damage: 1, degree: 'success' });
    expect(result.combatant.dead).toBe(true);
  });

  it('does not fire for enemies', () => {
    const enemy = makeEnemy({ hp: { current: 1, max: 30, temp: 0 }, heroPoints: 1 });
    const result = applyDamage(enemy, { damage: 5, degree: 'success' });
    expect(result.combatant.dead).toBe(true);
    expect(result.heroPointSurvivalFired).toBeFalsy();
  });

  it('does not fire when damage does not threaten death (HP > 0 after)', () => {
    const pc = makePc({ hp: { current: 20, max: 20, temp: 0 }, heroPoints: 1 });
    const result = applyDamage(pc, { damage: 5, degree: 'success' });
    expect(result.combatant.heroPoints).toBe(1);
    expect(result.heroPointSurvivalFired).toBeFalsy();
  });
});

describe('deathThresholdFor', () => {
  it('returns 4 for doomed 0', () => {
    expect(deathThresholdFor(makePc({ doomed: 0 }))).toBe(4);
  });

  it('returns 3 for doomed 1', () => {
    expect(deathThresholdFor(makePc({ doomed: 1 }))).toBe(3);
  });

  it('clamps to 1 for very high doomed values', () => {
    expect(deathThresholdFor(makePc({ doomed: 99 }))).toBe(1);
  });
});
