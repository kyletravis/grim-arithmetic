import { MODULE_ID, MODULE_TITLE } from './constants';
import { logDebugCapture } from './debug-capture';
import { registerSettings, applyPlayerSettingsVisibility } from './settings';
import { DangerBoardPanel } from './ui/danger-board-panel';
import { ForecastPanel } from './ui/forecast-panel';
import { PairDetailPanel } from './ui/pair-detail-panel';
import { applyTooltipDelay } from './ui/tooltip-delay';
import { registerTokenControls } from './ui/token-controls';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
  registerTokenControls();
  registerHandlebarsHelpers();
});

function registerHandlebarsHelpers(): void {
  const handlebars = typeof Handlebars === 'undefined' ? undefined : Handlebars;
  if (!handlebars) return;
  handlebars.registerHelper('eq', function (a: unknown, b: unknown): boolean {
    return a === b;
  });
}

Hooks.once('ready', () => {
  applyTooltipDelay(750);
  // Runs before the GM guard below: players must reach this to have their settings hidden.
  applyPlayerSettingsVisibility(game.settings.settings, game.user?.isGM === true);

  if (!game.user?.isGM) return;

  const grimArithmeticModule = game.modules.get(MODULE_ID);
  if (!grimArithmeticModule) return;

  grimArithmeticModule.api = {
    openPanel: () => new DangerBoardPanel().render(true),
    openPairDetail: (pcId: string, enemyId: string, attackId?: string) =>
      PairDetailPanel.openForPair(pcId, enemyId, attackId),
    openPairDetailFromSelection: () => PairDetailPanel.openForSelection(),
    openForecast: () => ForecastPanel.open(),
    captureTokenDebug: (
      token = canvas.tokens?.controlled?.[0] as Parameters<typeof logDebugCapture>[0]
    ) => logDebugCapture(token)
  };
});
