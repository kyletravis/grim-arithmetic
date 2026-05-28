import { afterEach, describe, expect, it } from 'vitest';
import { ENABLE_MONTE_CARLO_SETTING, isMonteCarloEnabled, isSettingsConfigVisible } from '../src/settings';

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

describe('settings: isSettingsConfigVisible (KHT-118)', () => {
  afterEach(() => {
    delete (globalThis as { game?: unknown }).game;
  });

  it('defaults to hidden outside Foundry (test env, no game)', () => {
    expect(isSettingsConfigVisible()).toBe(false);
  });

  it('is hidden for a non-GM user', () => {
    (globalThis as { game?: unknown }).game = { user: { isGM: false } };
    expect(isSettingsConfigVisible()).toBe(false);
  });

  it('is visible for a GM user', () => {
    (globalThis as { game?: unknown }).game = { user: { isGM: true } };
    expect(isSettingsConfigVisible()).toBe(true);
  });
});
