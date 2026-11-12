import Phaser from 'phaser';
import title from '../data/title.json';
import ui from '../data/ui.json';
import { UI_TEX } from './BootScene';
import { openOverlay } from './overlay';
import { services, SETTINGS_CHANGED } from './services';
import { Keys } from './ui/input';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';

/**
 * Main menu over an illustrated street: the game's name in the sky and
 * continue / new game / options / credits in a framed panel.
 * Layout numbers: src/data/title.json.
 */
export class TitleScene extends Phaser.Scene {
  private keys!: Keys;
  private menu: MenuPanel | null = null;
  private titleText!: Phaser.GameObjects.Text;
  private tagText!: Phaser.GameObjects.Text;
  private confirmingNew = false;
  private leaving = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.confirmingNew = false;
    this.leaving = false;
    this.keys = new Keys(this);
    const { width } = this.scale;
    this.add.image(0, 0, UI_TEX.titleBg).setOrigin(0);

    const outline = { stroke: ui.ink, strokeThickness: title.titleStroke, shadow: { offsetX: 0, offsetY: 3, color: ui.ink, blur: 0, fill: true, stroke: true } };
    this.titleText = this.add.text(width / 2, title.titleY, '', { ...textStyle(true, title.titleSize), color: ui.panel, ...outline }).setOrigin(0.5);
    this.tagText = this.add
      .text(width / 2, title.titleY + title.titleSize / 2 + 10, '', { ...textStyle(false, 10), color: ui.panel, stroke: ui.ink, strokeThickness: 3 })
      .setOrigin(0.5);
    this.tweens.add({ targets: this.titleText, y: title.titleY - 3, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.easeInOut' });

    this.build();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    const onChange = () => this.build();
    this.registry.events.on(SETTINGS_CHANGED, onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.events.off(SETTINGS_CHANGED, onChange));
  }

  update(): void {
    if (this.leaving) return;
    const input = this.keys.read();
    if (this.confirmingNew) {
      if (input.confirm) {
        services(this).newGame();
        this.enterGame();
      } else if (input.cancel) {
        this.confirmingNew = false;
        this.build();
      }
      return;
    }
    this.menu?.handle(input);
  }

  /** Fades to black, then opens the home. */
  private enterGame(): void {
    this.leaving = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('HomeScene'));
  }

  private build(): void {
    const s = services(this);
    const t = s.i18n.t;
    this.titleText.setText(t('title.game'));
    this.tagText.setText(t('title.tag'));
    this.menu?.destroy();
    const items: MenuItem[] = [];
    if (s.hasSave()) items.push({ label: () => t('mainMenu.continue'), onSelect: () => this.enterGame() });
    items.push({
      label: () => t('mainMenu.newGame'),
      onSelect: () => {
        if (s.hasSave()) {
          this.confirmingNew = true;
          this.menu?.destroy();
          this.menu = new MenuPanel(this, { lines: [t('mainMenu.confirmNew')], anchor: { kind: 'center', y: title.menuY } });
        } else {
          s.newGame();
          this.enterGame();
        }
      },
    });
    items.push({ label: () => t('mainMenu.options'), onSelect: () => openOverlay(this, 'OptionsScene') });
    items.push({ label: () => t('mainMenu.credits'), onSelect: () => openOverlay(this, 'CreditsScene') });
    this.menu = new MenuPanel(this, { items, help: t('mainMenu.help'), anchor: { kind: 'center', y: title.menuY }, minWidth: title.menuMinWidth });
  }
}
