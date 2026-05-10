export type DegreeOfSuccess = 'criticalFailure' | 'failure' | 'success' | 'criticalSuccess';

const ORDER: DegreeOfSuccess[] = ['criticalFailure', 'failure', 'success', 'criticalSuccess'];

export interface DegreeOfSuccessInput {
  die: number;
  total: number;
  dc: number;
}

export function degreeOfSuccess(input: DegreeOfSuccessInput): DegreeOfSuccess {
  const { die, total, dc } = input;
  let degree: DegreeOfSuccess;

  if (total >= dc + 10) {
    degree = 'criticalSuccess';
  } else if (total >= dc) {
    degree = 'success';
  } else if (total <= dc - 10) {
    degree = 'criticalFailure';
  } else {
    degree = 'failure';
  }

  if (die === 20) return shiftDegree(degree, 1);
  if (die === 1) return shiftDegree(degree, -1);
  return degree;
}

function shiftDegree(degree: DegreeOfSuccess, shift: -1 | 1): DegreeOfSuccess {
  const index = ORDER.indexOf(degree);
  const nextIndex = Math.max(0, Math.min(ORDER.length - 1, index + shift));
  return ORDER[nextIndex];
}
