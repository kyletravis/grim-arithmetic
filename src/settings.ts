import { MODULE_ID } from './constants';

export const ENABLE_MONTE_CARLO_SETTING = 'enableMonteCarlo';
export const DEFAULT_STRIKES_SETTING = 'defaultStrikes';
export const DEBUG_LOGGING_SETTING = 'debugLogging';

export function registerSettings(): void {
  game.settings.register(MODULE_ID, DEFAULT_STRIKES_SETTING, {
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

  game.settings.register(MODULE_ID, DEBUG_LOGGING_SETTING, {
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

const GRIM_SETTING_KEYS = [
  DEFAULT_STRIKES_SETTING,
  DEBUG_LOGGING_SETTING,
  ENABLE_MONTE_CARLO_SETTING
] as const;

export interface SettingsRegistry {
  get(key: string): { config?: boolean } | undefined;
}

/**
 * Hide every Grim Arithmetic setting from non-GM players (KHT-118).
 *
 * Settings must be registered during `init`, but `game.user` is not populated
 * until later — so registration can't know who the GM is. We register with
 * `config: true` and, once `game.user.isGM` is known (the `ready` hook), flip
 * the `config` flag to false for non-GMs. Foundry's settings menu reads each
 * registration's `config` flag at render time and omits a module's heading
 * when it has no visible settings, so this removes the entire Grim Arithmetic
 * section for players — heading included. No-op for the GM.
 */
export function applyPlayerSettingsVisibility(
  registry: SettingsRegistry | undefined | null,
  isGM: boolean
): void {
  if (isGM || !registry) return;
  for (const key of GRIM_SETTING_KEYS) {
    const registration = registry.get(`${MODULE_ID}.${key}`);
    if (registration) registration.config = false;
  }
}

/**
 * Read a module setting, tolerating every "Foundry isn't here" case (tests,
 * pre-init, unexpected errors) by returning the fallback.
 */
export function getModuleSetting<T>(key: string, fallback: T): T {
  if (typeof game === 'undefined') return fallback;
  try {
    const value = game.settings.get(MODULE_ID, key);
    return value === undefined || value === null ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

/**
 * True when the Monte Carlo simulation feature is enabled for this client.
 *
 * Defaults to true. Returns true when game/settings are unavailable (test
 * environment, pre-init, or unexpected runtime errors) so that test code
 * never has to mock Foundry globals just to exercise downstream logic.
 */
export function isMonteCarloEnabled(): boolean {
  return Boolean(getModuleSetting(ENABLE_MONTE_CARLO_SETTING, true));
}

export function isDebugLoggingEnabled(): boolean {
  return Boolean(getModuleSetting(DEBUG_LOGGING_SETTING, false));
}

/** World default for enemy Strikes per turn (Danger Board, Pair Detail initial value, Forecast enemies). */
export function getDefaultStrikes(): 1 | 2 | 3 {
  const value = Number(getModuleSetting(DEFAULT_STRIKES_SETTING, 2));
  return value === 1 || value === 3 ? value : 2;
}
