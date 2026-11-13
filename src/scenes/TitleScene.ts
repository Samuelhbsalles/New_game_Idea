import Phaser from 'phaser';
import title from '../data/title.json';
import ui from '../data/ui.json';
import { UI_TEX } from './BootScene';
import { openOverlay } from './overlay';
import { services, SETTINGS_CHANGED } from './services';
import { joinWorld, SESSION_KEY } from '../net/world';
import { Keys } from './ui/input';
import { NameInput } from './ui/nameInput';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';

/** Browser key remembering the last dev login name. */
const LAST_NAME_KEY = 'creatureGame.lastName';

function safeGet(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeSet(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* private mode: just not remembered */
  }
}

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

    // Online: log in first (once per page load); the save then comes from the server.
    if (services(this).online && !this.registry.get(SESSION_KEY)) this.showLogin();
    else this.build();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    const onChange = () => (this.login ? this.showLogin() : this.build());
    this.registry.events.on(SETTINGS_CHANGED, onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(SETTINGS_CHANGED, onChange);
      this.endLogin();
    });
  }

  // ---- login (dev name; a platform login replaces it later) ---------------------------

  private login: NameInput | null = null;

  /** "What's your name?" box; Enter connects to the world server. */
  private showLogin(status?: string): void {
    const t = services(this).i18n.t;
    this.menu?.destroy();
    const lines = [t('login.title'), '', '', '', status ?? t('login.help')];
    this.menu = new MenuPanel(this, { lines, anchor: { kind: 'center', y: title.menuY }, minWidth: title.menuMinWidth });
    if (this.login) return;
    const kb = this.input.keyboard;
    kb?.disableGlobalCapture(); // let the text box receive E, Enter and the arrows
    if (kb) kb.enabled = false;
    const remembered = safeGet(LAST_NAME_KEY) ?? '';
    // Over the two blank lines under the question (panel padding + title row + one line).
    const y = title.menuY + ui.panelPad + (ui.fontSize + 7) * 2 + 4;
    this.login = new NameInput(this.game.canvas, { x: this.scale.width / 2, y }, this.scale, remembered, (name) => this.connect(name));
  }

  private async connect(raw: string): Promise<void> {
    const s = services(this);
    const t = s.i18n.t;
    const name = raw.trim();
    if (name.length < 2) return this.showLogin(t('login.badName'));
    this.login?.setEnabled(false);
    this.showLogin(t('login.connecting'));
    try {
      const session = await joinWorld(`dev:${name}`, s.localSave, (reason) => console.warn('[world] save not stored:', reason));
      safeSet(LAST_NAME_KEY, name);
      s.useSaveStorage(session.storage);
      this.registry.set(SESSION_KEY, session);
      this.endLogin();
      this.build();
    } catch (e) {
      console.warn('[world] join failed', e);
      this.login?.setEnabled(true);
      this.showLogin(t('login.failed'));
    }
  }

  private endLogin(): void {
    if (!this.login) return;
    this.login.destroy();
    this.login = null;
    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = true;
      kb.enableGlobalCapture();
    }
  }

  update(): void {
    if (this.leaving || this.login) return;
    const input = this.keys.read();
    if (this.confirmingNew) {
      if (input.confirm) {
        this.enterGame('CreatorScene');
      } else if (input.cancel) {
        this.confirmingNew = false;
        this.build();
      }
      return;
    }
    this.menu?.handle(input);
  }

  /**
   * Fades to black, then opens the home (continue) or the character creator
   * (new game; the save is only replaced when the creator's "Start" is chosen).
   */
  private enterGame(scene: 'HomeScene' | 'CreatorScene' = 'HomeScene'): void {
    this.leaving = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
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
          this.enterGame('CreatorScene');
        }
      },
    });
    items.push({ label: () => t('mainMenu.options'), onSelect: () => openOverlay(this, 'OptionsScene') });
    items.push({ label: () => t('mainMenu.credits'), onSelect: () => openOverlay(this, 'CreditsScene') });
    this.menu = new MenuPanel(this, { items, help: t('mainMenu.help'), anchor: { kind: 'center', y: title.menuY }, minWidth: title.menuMinWidth });
  }
}
