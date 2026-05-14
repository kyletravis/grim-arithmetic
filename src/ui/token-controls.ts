import { MODULE_ID } from '../constants';
import { DangerBoardPanel } from './danger-board-panel';

interface SceneControlToolV13 {
  name: string;
  title: string;
  icon: string;
  order: number;
  button: true;
  visible: boolean;
  onChange: () => void;
}

interface SceneControlV13 {
  tools: Record<string, SceneControlToolV13>;
}

type SceneControlsV13 = Record<string, SceneControlV13>;

const TOOL_NAME = `${MODULE_ID}-open-panel`;

function openDangerBoard(): void {
  new DangerBoardPanel().render(true);
}

export function registerTokenControls(): void {
  Hooks.on('getSceneControlButtons', (controls: SceneControlsV13) => {
    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    tokenControls.tools[TOOL_NAME] = {
      name: TOOL_NAME,
      title: 'Grim Arithmetic',
      icon: 'fa-solid fa-skull',
      order: Object.keys(tokenControls.tools).length,
      button: true,
      visible: Boolean(game.user?.isGM),
      onChange: openDangerBoard
    };
  });
}
