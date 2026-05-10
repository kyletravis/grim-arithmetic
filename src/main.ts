import { MODULE_TITLE } from './constants';
import { registerSettings } from './settings';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
});
