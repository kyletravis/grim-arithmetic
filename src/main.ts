import { MODULE_ID, MODULE_TITLE } from './constants';
import { registerSettings } from './settings';
import { MortalityPanel } from './ui/mortality-panel';
import { registerTokenControls } from './ui/token-controls';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
  registerTokenControls();
});

Hooks.once('ready', () => {
  if (!game.user?.isGM) return;

  const grimArithmeticModule = game.modules.get(MODULE_ID);
  if (!grimArithmeticModule) return;

  grimArithmeticModule.api = {
    openPanel: () => new MortalityPanel().render(true)
  };
});
