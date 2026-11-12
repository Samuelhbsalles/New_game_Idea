import Phaser from 'phaser';
import ui from '../data/ui.json';
import { choices, cycle, defaultAppearance, type Appearance, type Slot } from '../logic/appearance';
import { AVATAR_ART, buildAvatar, COSMETICS } from './avatar';
import { services } from './services';
import { createCharacterAnims, showMotion, type Dir } from './sprites';
import { UI_TEX } from './BootScene';
import { Keys } from './ui/input';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';

/** Preview scale and how long (ms) it faces each way before turning. */
const PREVIEW_SCALE = 3;
const TURN_MS = 1600;
const TURN_ORDER: Dir[] = ['down', 'right', 'up', 'left'];
const PREVIEW_WALK_FPS = 8;

/**
 * Character creator, opened by "New game": body, skin tone, hair and its
 * colour, top, bottom and their colours, with a large walking preview that
 * turns to show every side. "Start" creates the new save with this look.
 * Esc goes back to the title.
 */
export class CreatorScene extends Phaser.Scene {
  private keys!: Keys;
  private menu: MenuPanel | null = null;
  private look!: Appearance;
  private preview!: Phaser.GameObjects.Sprite;
  private swatches: Phaser.GameObjects.Rectangle[] = [];
  private facing = 0;

  constructor() {
    super('CreatorScene');
  }

  create(): void {
    const t = services(this).i18n.t;
    this.keys = new Keys(this);
    this.look = defaultAppearance(COSMETICS);
    this.facing = 0;
    const { width, height } = this.scale;
    this.add.image(0, 0, UI_TEX.titleBg).setOrigin(0).setAlpha(0.35);
    this.add.rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(ui.ink).color, 0.45).setOrigin(0);
    this.add.text(width / 2, 10, t('creator.title'), { ...textStyle(true, 16), color: ui.panel, stroke: ui.ink, strokeThickness: 4 }).setOrigin(0.5, 0);

    // Preview on a little floor shadow, left side.
    this.add.ellipse(120, 214, 70, 14, 0x000000, 0.3);
    this.preview = this.add.sprite(120, 150, `${AVATAR_ART.name}_idle_down`).setScale(PREVIEW_SCALE);
    this.swatches = [0, 1, 2].map((i) => this.add.rectangle(96 + i * 24, 236, 16, 10, 0xffffff).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(ui.ink).color));
    this.rebuild();
    this.time.addEvent({ delay: TURN_MS, loop: true, callback: () => this.turn() });

    this.buildMenu();
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  update(): void {
    if (this.menu?.handle(this.keys.read()) === 'cancel') this.scene.start('TitleScene');
  }

  // ---- preview -----------------------------------------------------------------

  /** Rebuilds the avatar textures for the current look and refreshes the preview. */
  private rebuild(): void {
    buildAvatar(this, this.look);
    createCharacterAnims(this, AVATAR_ART, PREVIEW_WALK_FPS);
    this.showFacing();
    const cat = COSMETICS;
    const colors = [cat.hairColors[this.look.hairColor], cat.clothColors[this.look.topColor], cat.clothColors[this.look.bottomColor]];
    this.swatches.forEach((s, i) => s.setFillStyle(Phaser.Display.Color.HexStringToColor(colors[i]).color));
  }

  private turn(): void {
    this.facing = (this.facing + 1) % TURN_ORDER.length;
    this.showFacing();
  }

  private showFacing(): void {
    showMotion(this.preview, AVATAR_ART.name, TURN_ORDER[this.facing], true);
  }

  // ---- menu ----------------------------------------------------------------------

  private buildMenu(): void {
    const t = services(this).i18n.t;
    const cat = COSMETICS;
    const part = (slot: Slot) => {
      const ids = choices(cat, slot).map((c) => c.id);
      const change = (dir: 1 | -1) => () => {
        this.look = { ...this.look, [slot]: cycle(ids, this.look[slot], dir) };
        this.rebuild();
        this.menu?.refresh();
      };
      return { label: () => t(`creator.${slot}`, { value: t(`cosmetics.${this.look[slot]}`) }), onLeft: change(-1), onRight: change(1), onSelect: change(1) };
    };
    const color = (key: 'skin' | 'hairColor' | 'topColor' | 'bottomColor', list: string[]) => {
      const idx = list.map((_, i) => i);
      const change = (dir: 1 | -1) => () => {
        this.look = { ...this.look, [key]: cycle(idx, this.look[key], dir) };
        this.rebuild();
        this.menu?.refresh();
      };
      return { label: () => t(`creator.${key}`, { value: `${this.look[key] + 1}/${list.length}` }), onLeft: change(-1), onRight: change(1), onSelect: change(1) };
    };
    const items: MenuItem[] = [
      part('body'),
      color('skin', cat.skinTones),
      part('hair'),
      color('hairColor', cat.hairColors),
      part('top'),
      color('topColor', cat.clothColors),
      part('bottom'),
      color('bottomColor', cat.clothColors),
      { label: () => t('creator.start'), onSelect: () => this.start() },
    ];
    this.menu?.destroy();
    // Right half; the preview owns the left.
    this.menu = new MenuPanel(this, { items, help: t('creator.help'), anchor: { kind: 'right', y: 34, margin: 16 }, minWidth: 170 });
  }

  /** Starts a fresh save wearing this look and walks into the home. */
  private start(): void {
    const s = services(this);
    const world = s.newGame();
    world.state.appearance = { ...this.look };
    world.save();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('HomeScene'));
  }
}
