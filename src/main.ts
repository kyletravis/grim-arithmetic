import { MODULE_ID, MODULE_TITLE } from './constants';
import { buildLiveFixture, logDebugCapture, type DebugTokenLike } from './debug-capture';
import { registerSettings, applyPlayerSettingsVisibility } from './settings';
import { getSystemAdapter } from './systems/adapter-registry';
import { DangerBoardPanel } from './ui/danger-board-panel';
import { ForecastPanel } from './ui/forecast-panel';
import { PairDetailPanel } from './ui/pair-detail-panel';
import { installScopedTooltipDelay } from './ui/tooltip-delay';
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
  handlebars.registerHelper('grimEq', function (a: unknown, b: unknown): boolean {
    return a === b;
  });
}

Hooks.once('ready', () => {
  // Runs before the GM guard below: players must reach this to have their settings hidden.
  applyPlayerSettingsVisibility(game.settings.settings, game.user?.isGM === true);

  if (!game.user?.isGM) return;

  if (!getSystemAdapter()) {
    console.warn(
      `${MODULE_TITLE} | Unsupported game system "${game.system?.id}"; Grim Arithmetic is disabled.`
    );
    return;
  }

  DangerBoardPanel.registerAutoRefresh();
  installScopedTooltipDelay(750);

  const grimArithmeticModule = game.modules.get(MODULE_ID);
  if (!grimArithmeticModule) return;

  grimArithmeticModule.api = {
    openPanel: () => DangerBoardPanel.open(),
    openPairDetail: (pcId: string, enemyId: string, attackId?: string) =>
      PairDetailPanel.openForPair(pcId, enemyId, attackId),
    openPairDetailFromSelection: () => PairDetailPanel.openForSelection(),
    openForecast: () => ForecastPanel.open(),
    captureTokenDebug: (
      token = canvas.tokens?.controlled?.[0] as Parameters<typeof logDebugCapture>[0]
    ) => logDebugCapture(token),
    exportLiveFixture: (token = canvas.tokens?.controlled?.[0] as DebugTokenLike | undefined) => {
      if (!token) return null;
      const fixture = buildLiveFixture(token);
      const json = JSON.stringify(fixture, null, 2);
      console.log(json);
      void (
        globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }
      ).navigator?.clipboard?.writeText(json);
      return fixture;
    }
  };
});
