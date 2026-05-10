import { MODULE_ID } from './constants';

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
}
