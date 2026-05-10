import { MODULE_ID } from '../constants';
import { MortalityPanel } from './mortality-panel';

interface SceneControlTool {
  name: string;
  title: string;
  icon: string;
  button: true;
  onClick: () => void;
}

interface SceneControl {
  name: string;
  tools: SceneControlTool[];
}

export function registerTokenControls(): void {
  Hooks.on('getSceneControlButtons', (controls: SceneControl[]) => {
    if (!game.user?.isGM) return;

    const tokenControls = controls.find((control) => control.name === 'token');
    if (!tokenControls) return;

    tokenControls.tools.push({
      name: `${MODULE_ID}-open-panel`,
      title: 'Grim Arithmetic',
      icon: 'fas fa-skull',
      button: true,
      onClick: () => new MortalityPanel().render(true)
    });
  });
}
