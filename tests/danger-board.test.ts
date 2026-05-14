import { describe, expect, it } from 'vitest';
import { buildDangerBoardData } from '../src/ui/danger-board';
import { EncounterRiskMatrix, PairRisk } from '../src/engine/encounter-risk';

function pair(overrides: Partial<PairRisk>): PairRisk {
  return {
    pcId: 'pc-x',
    pcName: 'PC X',
    enemyId: 'npc-x',
    enemyName: 'Enemy X',
    attackId: 'attack-x',
    attackName: 'Strike',
    downProbability: 0.1,
    riskLabel: 'Guarded',
    caveats: [],
    ...overrides
  };
}

function matrix(pairs: PairRisk[], extras: Partial<EncounterRiskMatrix> = {}): EncounterRiskMatrix {
  return {
    pairs,
    skipped: false,
    caveats: [],
    ...extras
  };
}

describe('buildDangerBoardData', () => {
  it('shows each PC at most once, ranked by their worst threat (desc)', () => {
    const data = buildDangerBoardData(
      matrix([
        pair({ pcId: 'pc-1', pcName: 'Mira', enemyName: 'Cultist', attackName: 'Dagger', downProbability: 0.04, riskLabel: 'Low' }),
        pair({ pcId: 'pc-1', pcName: 'Mira', enemyName: 'Troll', attackName: 'Claw', downProbability: 0.38, riskLabel: 'Severe' }),
        pair({ pcId: 'pc-2', pcName: 'Seam', enemyName: 'Voidglutton', attackName: 'Bite', downProbability: 0.22, riskLabel: 'Dangerous' }),
        pair({ pcId: 'pc-3', pcName: 'Geary', enemyName: 'Cultist', attackName: 'Dagger', downProbability: 0.04, riskLabel: 'Low' })
      ])
    );

    expect(data.empty).toBe(false);
    expect(data.topEndangeredPcs.map((e) => e.pcName)).toEqual(['Mira', 'Seam', 'Geary']);
    expect(data.topEndangeredPcs[0]).toMatchObject({
      pcName: 'Mira',
      enemyName: 'Troll',
      attackName: 'Claw',
      downPercent: 38,
      riskLabel: 'Severe'
    });
  });

  it('passes pcId, enemyId, and attackId through to entries so the UI can wire detail buttons', () => {
    const data = buildDangerBoardData(
      matrix([
        pair({
          pcId: 'pc-1',
          enemyId: 'npc-1',
          attackId: 'claw-1',
          pcName: 'Mira',
          enemyName: 'Troll',
          attackName: 'Claw',
          downProbability: 0.4,
          riskLabel: 'Severe'
        })
      ])
    );

    expect(data.topEndangeredPcs[0]).toMatchObject({
      pcId: 'pc-1',
      enemyId: 'npc-1',
      attackId: 'claw-1'
    });
    expect(data.topDangerousEnemies[0]).toMatchObject({
      pcId: 'pc-1',
      enemyId: 'npc-1',
      attackId: 'claw-1'
    });
  });

  it('exposes a kebab-case riskClass for color-coded risk pills', () => {
    const data = buildDangerBoardData(
      matrix([
        pair({ pcId: 'a', riskLabel: 'Severe', downProbability: 0.5 }),
        pair({ pcId: 'b', riskLabel: 'Guarded', downProbability: 0.1 }),
        pair({ pcId: 'c', riskLabel: 'Low', downProbability: 0.02 })
      ])
    );

    const classes = data.topEndangeredPcs.map((e) => e.riskClass);
    expect(classes).toEqual(['severe', 'guarded', 'low']);
  });

  it('formats the danger label as "PC vs Enemy Attack — XX% Label"', () => {
    const data = buildDangerBoardData(
      matrix([
        pair({ pcId: 'pc-1', pcName: 'Mira', enemyName: 'Troll', attackName: 'Claw', downProbability: 0.382, riskLabel: 'Severe' })
      ])
    );

    expect(data.topEndangeredPcs[0].label).toBe('Mira vs Troll Claw — 38% Severe');
  });

  it('truncates top endangered PCs to the requested limit', () => {
    const pairs: PairRisk[] = [];
    for (let i = 0; i < 8; i++) {
      pairs.push(pair({ pcId: `pc-${i}`, pcName: `PC ${i}`, downProbability: 0.5 - i * 0.05 }));
    }

    const data = buildDangerBoardData(matrix(pairs), { topN: 3 });
    expect(data.topEndangeredPcs).toHaveLength(3);
    expect(data.topEndangeredPcs[0].pcName).toBe('PC 0');
    expect(data.topEndangeredPcs.at(-1)?.pcName).toBe('PC 2');
  });

  it('ranks most dangerous enemies by their worst pair (one entry per enemy)', () => {
    const data = buildDangerBoardData(
      matrix([
        pair({ pcId: 'pc-1', enemyId: 'npc-1', enemyName: 'Troll', downProbability: 0.38 }),
        pair({ pcId: 'pc-2', enemyId: 'npc-1', enemyName: 'Troll', downProbability: 0.10 }),
        pair({ pcId: 'pc-1', enemyId: 'npc-2', enemyName: 'Cultist', downProbability: 0.05 })
      ])
    );

    expect(data.topDangerousEnemies.map((e) => e.enemyName)).toEqual(['Troll', 'Cultist']);
    expect(data.topDangerousEnemies[0].downPercent).toBe(38);
  });

  it('reports empty state without errors when no pairs exist', () => {
    const data = buildDangerBoardData(matrix([]));

    expect(data.empty).toBe(true);
    expect(data.topEndangeredPcs).toEqual([]);
    expect(data.topDangerousEnemies).toEqual([]);
  });

  it('passes through matrix caveats to the board data', () => {
    const data = buildDangerBoardData(
      matrix([], { caveats: ['Troll has no supported attacks.'] })
    );

    expect(data.caveats).toContain('Troll has no supported attacks.');
    expect(data.empty).toBe(true);
  });

  it('marks the board as skipped when the matrix was skipped by guardrail', () => {
    const data = buildDangerBoardData(
      matrix([], { skipped: true, caveats: ['Encounter too large.'] })
    );

    expect(data.skipped).toBe(true);
    expect(data.caveats).toContain('Encounter too large.');
  });
});
