import { MODULE_ID, MODULE_TITLE } from './constants';
import { logDebugCapture } from './debug-capture';
import { registerSettings } from './settings';
import { DangerBoardPanel } from './ui/danger-board-panel';
import { PairDetailPanel } from './ui/pair-detail-panel';
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
    openPanel: () => new DangerBoardPanel().render(true),
    openPairDetail: (pcId: string, enemyId: string, attackId?: string) =>
      PairDetailPanel.openForPair(pcId, enemyId, attackId),
    openPairDetailFromSelection: () => PairDetailPanel.openForSelection(),
    captureTokenDebug: (token = canvas.tokens?.controlled?.[0]) => logDebugCapture(token)
  };
});
