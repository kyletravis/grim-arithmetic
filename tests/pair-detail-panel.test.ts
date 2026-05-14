import { describe, expect, it } from 'vitest';
import { resolvePairSelection } from '../src/ui/pair-detail-resolver';

describe('resolvePairSelection', () => {
  it('returns both tokens with no errors when both are present', () => {
    const pc = { id: 'pc-1' };
    const enemy = { id: 'enemy-1' };

    expect(resolvePairSelection(pc, enemy)).toEqual({
      subjectToken: pc,
      enemyToken: enemy,
      errors: []
    });
  });

  it('reports a token-missing error when the PC token is no longer on the canvas', () => {
    const enemy = { id: 'enemy-1' };

    const result = resolvePairSelection(null, enemy);

    expect(result.subjectToken).toBeNull();
    expect(result.enemyToken).toBe(enemy);
    expect(result.errors).toEqual([
      'PC token is no longer on the canvas. The encounter may have changed since the danger board was rendered.'
    ]);
  });

  it('reports a token-missing error when the enemy token is no longer on the canvas', () => {
    const pc = { id: 'pc-1' };

    const result = resolvePairSelection(pc, null);

    expect(result.subjectToken).toBe(pc);
    expect(result.enemyToken).toBeNull();
    expect(result.errors).toEqual([
      'Enemy token is no longer on the canvas. The encounter may have changed since the danger board was rendered.'
    ]);
  });

  it('reports both errors when both tokens are missing', () => {
    const result = resolvePairSelection(null, null);

    expect(result.subjectToken).toBeNull();
    expect(result.enemyToken).toBeNull();
    expect(result.errors).toHaveLength(2);
  });
});
