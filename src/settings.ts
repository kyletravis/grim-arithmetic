import { MODULE_ID } from './constants';

export const ENABLE_MONTE_CARLO_SETTING = 'enableMonteCarlo';

/**
 * True only when the current user is the GM. Used to gate the module's
 * config UI so players see no Grim Arithmetic options (KHT-118). Returns
 * false when game/user are unavailable (test env, pre-init), so settings
 * default to hidden rather than leaking to players.
 */
export function isSettingsConfigVisible(): boolean {
  if (typeof game === 'undefined') return false;
  try {
    return (game as { user?: { isGM?: boolean } }).user?.isGM === true;
  } catch {
    return false;
  }
}

export function registerSettings(): void {
  const config = isSettingsConfigVisible();

  game.settings.register(MODULE_ID, 'defaultStrikes', {
    name: 'GrimArithmetic.Settings.DefaultStrikes.Name',
    hint: 'GrimArithmetic.Settings.DefaultStrikes.Hint',
    scope: 'world',
    config,
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
    config,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, ENABLE_MONTE_CARLO_SETTING, {
    name: 'GrimArithmetic.Settings.EnableMonteCarlo.Name',
    hint: 'GrimArithmetic.Settings.EnableMonteCarlo.Hint',
    scope: 'client',
    config,
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
