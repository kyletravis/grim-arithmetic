import { EncounterRiskMatrix, PairRisk } from '../engine/encounter-risk';

export interface DangerBoardEntry {
  pcId: string;
  enemyId: string;
  attackId: string;
  pcName: string;
  enemyName: string;
  attackName: string;
  downPercent: number;
  riskLabel: string;
  riskClass: string;
  label: string;
}

export interface DangerBoardData {
  topEndangeredPcs: DangerBoardEntry[];
  topDangerousEnemies: DangerBoardEntry[];
  caveats: string[];
  empty: boolean;
  skipped: boolean;
}

export interface BuildDangerBoardOptions {
  topN?: number;
}

const DEFAULT_TOP_N = 5;

export function buildDangerBoardData(
  matrix: EncounterRiskMatrix,
  options: BuildDangerBoardOptions = {}
): DangerBoardData {
  const topN = options.topN ?? DEFAULT_TOP_N;

  const topEndangeredPcs = pickTopByKey(matrix.pairs, (p) => p.pcId)
    .sort((a, b) => b.downProbability - a.downProbability)
    .slice(0, topN)
    .map(toEntry);

  const topDangerousEnemies = pickTopByKey(matrix.pairs, (p) => p.enemyId)
    .sort((a, b) => b.downProbability - a.downProbability)
    .slice(0, topN)
    .map(toEntry);

  return {
    topEndangeredPcs,
    topDangerousEnemies,
    caveats: matrix.caveats,
    empty: matrix.pairs.length === 0,
    skipped: matrix.skipped
  };
}

function pickTopByKey(pairs: PairRisk[], keyFn: (p: PairRisk) => string): PairRisk[] {
  const byKey = new Map<string, PairRisk>();
  for (const pair of pairs) {
    const key = keyFn(pair);
    const existing = byKey.get(key);
    if (!existing || pair.downProbability > existing.downProbability) {
      byKey.set(key, pair);
    }
  }
  return Array.from(byKey.values());
}

function toEntry(pair: PairRisk): DangerBoardEntry {
  const downPercent = Math.round(pair.downProbability * 100);
  return {
    pcId: pair.pcId,
    enemyId: pair.enemyId,
    attackId: pair.attackId,
    pcName: pair.pcName,
    enemyName: pair.enemyName,
    attackName: pair.attackName,
    downPercent,
    riskLabel: pair.riskLabel,
    riskClass: pair.riskLabel.toLowerCase(),
    label: `${pair.pcName} vs ${pair.enemyName} ${pair.attackName} — ${downPercent}% ${pair.riskLabel}`
  };
}
