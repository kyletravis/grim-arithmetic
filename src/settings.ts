import { MODULE_ID } from './constants';

export const ENABLE_MONTE_CARLO_SETTING = 'enableMonteCarlo';

export function registerSettings(): void {
  game.settings.register(MODULE_ID, 'defaultStrikes', {
    name: 'GrimArithmetic.Settings.DefaultStrikes.Name',
    hint: 'GrimArithmetic.Settings.DefaultStrikes.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 2,
    choices: {
      1: 'GrimArithmetic.Settings.DefaultStrikes.Choices.1',
      2: 'GrimArithmetic.Settings.DefaultStrikes.Choices.2',
      3: 'GrimArithmetic.Settings.DefaultStrikes.Choices.3'
    }
  });

  game.settings.register(MODULE_ID, 'debugLogging', {
    name: 'GrimArithmetic.Settings.DebugLogging.Name',
    hint: 'GrimArithmetic.Settings.DebugLogging.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, ENABLE_MONTE_CARLO_SETTING, {
    name: 'GrimArithmetic.Settings.EnableMonteCarlo.Name',
    hint: 'GrimArithmetic.Settings.EnableMonteCarlo.Hint',
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
