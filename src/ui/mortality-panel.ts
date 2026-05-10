import { MODULE_ID, MODULE_TITLE } from '../constants';

interface MortalityPanelData {
  message: string;
  permanentDeath: string;
}

export class MortalityPanel extends Application {
  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-panel`,
      title: MODULE_TITLE,
      template: `modules/${MODULE_ID}/templates/mortality-panel.hbs`,
      width: 420,
      height: 'auto',
      resizable: true,
      classes: ['grim-arithmetic-window']
    });
  }

  override async getData(): Promise<MortalityPanelData> {
    return {
      message: 'Select a PC token and target one enemy token to estimate immediate down risk.',
      permanentDeath:
        'Permanent death probability is planned for a future milestone and is not modeled in MVP.'
    };
  }
}
