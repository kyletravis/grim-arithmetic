import { describe, expect, it } from 'vitest';
import { resolveTokenSelection } from '../src/foundry/selection';

describe('resolveTokenSelection', () => {
  it('returns selected subject and targeted enemy when exactly one of each exists', () => {
    const subject = { id: 'pc-1' };
    const enemy = { id: 'enemy-1' };

    expect(resolveTokenSelection({ controlled: [subject], targets: new Set([enemy]) })).toEqual({
      subjectToken: subject,
      enemyToken: enemy,
      errors: []
    });
  });

  it('reports helpful errors when selection is incomplete', () => {
    expect(resolveTokenSelection({ controlled: [], targets: [] })).toEqual({
      subjectToken: null,
      enemyToken: null,
      errors: ['Select exactly one PC token.', 'Target exactly one enemy token.']
    });
  });

  it('reports selection errors when too many tokens are selected or targeted', () => {
    const result = resolveTokenSelection({
      controlled: [{ id: 'pc-1' }, { id: 'pc-2' }],
      targets: [{ id: 'enemy-1' }, { id: 'enemy-2' }]
    });

    expect(result.subjectToken).toBeNull();
    expect(result.enemyToken).toBeNull();
    expect(result.errors).toEqual(['Select exactly one PC token.', 'Target exactly one enemy token.']);
  });
});
