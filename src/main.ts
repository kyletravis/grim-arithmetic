import { MODULE_ID, MODULE_TITLE } from './constants';
import { logDebugCapture } from './debug-capture';
import { registerSettings } from './settings';
import { DangerBoardPanel } from './ui/danger-board-panel';
import { ForecastPanel } from './ui/forecast-panel';
import { PairDetailPanel } from './ui/pair-detail-panel';
import { registerTokenControls } from './ui/token-controls';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
  registerTokenControls();
  registerHandlebarsHelpers();
});

function registerHandlebarsHelpers(): void {
  const handlebars = (globalThis as { Handlebars?: { registerHelper(name: string, fn: (...args: unknown[]) => unknown): void } }).Handlebars;
  if (!handlebars) return;
  handlebars.registerHelper('eq', function (a: unknown, b: unknown): boolean {
    return a === b;
  });
}

Hooks.once('ready', () => {
  if (!game.user?.isGM) return;

  const grimArithmeticModule = game.modules.get(MODULE_ID);
  if (!grimArithmeticModule) return;

  grimArithmeticModule.api = {
    openPanel: () => new DangerBoardPanel().render(true),
    openPairDetail: (pcId: string, enemyId: string, attackId?: string) =>
      PairDetailPanel.openForPair(pcId, enemyId, attackId),
    openPairDetailFromSelection: () => PairDetailPanel.openForSelection(),
    openForecast: () => ForecastPanel.open(),
    captureTokenDebug: (token = canvas.tokens?.controlled?.[0]) => logDebugCapture(token)
  };
});
