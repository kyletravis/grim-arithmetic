import { MODULE_ID } from './constants';

export const ENABLE_MONTE_CARLO_SETTING = 'enableMonteCarlo';

export function registerSettings(): void {
  game.settings.register(MODULE_ID, 'defaultStrikes', {
    name: 'Default enemy Strike count',
    hint: 'Default number of Strikes used for immediate-threat estimates.',
    scope: 'world',
    config: true,
    type: Number,
    default: 2,
    choices: {
      1: '1 Strike',
      2: '2 Strikes',
      3: '3 Strikes'
    }
  });

  game.settings.register(MODULE_ID, 'debugLogging', {
    name: 'Debug logging',
    hint: 'Log Grim Arithmetic debug information to the browser console.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, ENABLE_MONTE_CARLO_SETTING, {
    name: 'Enable Monte Carlo encounter simulation',
    hint: 'Disable on low-end machines if simulation runs are too slow. The Encounter Danger Board still works either way.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true
  });
}

/**
 * True when the Monte Carlo simulation feature is enabled for this client.
 *
 * Defaults to true. Returns true when game/settings are unavailable (test
 * environment, pre-init, or unexpected runtime errors) so that test code
 * never has to mock Foundry globals just to exercise downstream logic.
 */
export function isMonteCarloEnabled(): boolean {
  if (typeof game === 'undefined') return true;
  try {
    return Boolean((game as { settings?: { get?: (module: string, key: string) => unknown } })
      .settings
      ?.get?.(MODULE_ID, ENABLE_MONTE_CARLO_SETTING) ?? true);
  } catch {
    return true;
  }
}
