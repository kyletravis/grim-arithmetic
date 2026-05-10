import { describe, expect, it } from 'vitest';
import { degreeOfSuccess } from '../src/engine/degree-of-success';

describe('degreeOfSuccess', () => {
  it('returns critical success when total is dc plus 10', () => {
    expect(degreeOfSuccess({ die: 10, total: 30, dc: 20 })).toBe('criticalSuccess');
  });

  it('returns success when total meets dc', () => {
    expect(degreeOfSuccess({ die: 10, total: 20, dc: 20 })).toBe('success');
  });

  it('returns failure when total is below dc', () => {
    expect(degreeOfSuccess({ die: 9, total: 19, dc: 20 })).toBe('failure');
  });

  it('returns critical failure when total is dc minus 10 or lower', () => {
    expect(degreeOfSuccess({ die: 1, total: 10, dc: 20 })).toBe('criticalFailure');
  });

  it('natural 20 improves success by one degree', () => {
    expect(degreeOfSuccess({ die: 20, total: 19, dc: 20 })).toBe('success');
  });

  it('natural 1 worsens success by one degree', () => {
    expect(degreeOfSuccess({ die: 1, total: 20, dc: 20 })).toBe('failure');
  });
});
