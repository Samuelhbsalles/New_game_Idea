import Phaser from 'phaser';
import { closeOverlay } from './overlay';
import { services } from './services';
import { Keys } from './ui/input';
import { MenuPanel } from './ui/MenuPanel';

/** Credits overlay; any confirm or Esc closes it. */
export class CreditsScene extends Phaser.Scene {
  private keys!: Keys;
  private panel!: MenuPanel;
  private from = 'TitleScene';

  constructor() {
    super('CreditsScene');
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? 'TitleScene';
  }

  create(): void {
    const t = services(this).i18n.t;
    this.keys = new Keys(this);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.45).setOrigin(0);
    this.panel = new MenuPanel(this, {
      title: t('credits.title'),
      lines: [t('credits.body')],
      help: t('credits.back'),
      anchor: { kind: 'center' },
      minWidth: 160,
    });
  }

  update(): void {
    if (this.panel.handle(this.keys.read()) === 'cancel') closeOverlay(this, this.from);
  }
}
