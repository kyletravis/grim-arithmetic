import { describe, expect, it } from 'vitest';
import { ENABLE_MONTE_CARLO_SETTING, isMonteCarloEnabled } from '../src/settings';

describe('settings: enableMonteCarlo', () => {
  it('exposes the setting key as a stable constant', () => {
    expect(ENABLE_MONTE_CARLO_SETTING).toBe('enableMonteCarlo');
  });

  it('isMonteCarloEnabled defaults to true outside Foundry (test env)', () => {
    // `game` is undefined in the Vitest node environment; the helper must
    // tolerate that and default to enabled rather than throwing.
    expect(isMonteCarloEnabled()).toBe(true);
  });
});
