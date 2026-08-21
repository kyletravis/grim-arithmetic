import { describe, expect, it } from 'vitest';
import { getSystemAdapter } from '../src/systems/adapter-registry';

describe('adapter registry', () => {
  it('returns the PF2e adapter for pf2e and null otherwise', () => {
    expect(getSystemAdapter('pf2e')?.id).toBe('pf2e');
    expect(getSystemAdapter('dnd5e')).toBeNull();
    expect(getSystemAdapter(undefined)).toBeNull();
  });
});
