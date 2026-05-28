import { describe, expect, it } from 'vitest';
import { ENABLE_MONTE_CARLO_SETTING, isMonteCarloEnabled, applyPlayerSettingsVisibility } from '../src/settings';

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

describe('settings: applyPlayerSettingsVisibility (KHT-118)', () => {
  const KEYS = ['grim-arithmetic.defaultStrikes', 'grim-arithmetic.debugLogging', 'grim-arithmetic.enableMonteCarlo'];

  function makeRegistry(): Map<string, { config: boolean }> {
    return new Map([
      ['grim-arithmetic.defaultStrikes', { config: true }],
      ['grim-arithmetic.debugLogging', { config: true }],
      ['grim-arithmetic.enableMonteCarlo', { config: true }],
      ['core.someCoreSetting', { config: true }]
    ]);
  }

  it('leaves every setting visible for the GM', () => {
    const registry = makeRegistry();
    applyPlayerSettingsVisibility(registry, true);
    for (const key of KEYS) expect(registry.get(key)!.config).toBe(true);
  });

  it('hides all three Grim Arithmetic settings from non-GM players', () => {
    const registry = makeRegistry();
    applyPlayerSettingsVisibility(registry, false);
    for (const key of KEYS) expect(registry.get(key)!.config).toBe(false);
  });

  it("does not touch other modules' settings", () => {
    const registry = makeRegistry();
    applyPlayerSettingsVisibility(registry, false);
    expect(registry.get('core.someCoreSetting')!.config).toBe(true);
  });

  it('is a no-op when the registry is missing', () => {
    expect(() => applyPlayerSettingsVisibility(undefined, false)).not.toThrow();
  });

  it('is a no-op when the registry is null', () => {
    expect(() => applyPlayerSettingsVisibility(null, false)).not.toThrow();
  });
});
