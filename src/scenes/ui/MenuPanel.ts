import Phaser from 'phaser';
import ui from '../../data/ui.json';
import { UI_TEX } from '../BootScene';
import type { MenuInput } from './input';

/** One row in a menu. `label` is re-read on refresh, so it can show live values. */
export interface MenuItem {
  label: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
}

/** Where the panel goes: centred on screen (optionally at a set y), or above a world point (clamped to the screen). */
export type PanelAnchor = { kind: 'center'; y?: number } | { kind: 'right'; y: number; margin: number } | { kind: 'above'; x: number; y: number };

export interface MenuPanelOptions {
  title?: string;
  /** Non-selectable lines under the title (info panels use only these). */
  lines?: string[];
  items?: MenuItem[];
  help?: string;
  anchor: PanelAnchor;
  minWidth?: number;
}

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Text style shared by every panel, from src/data/ui.json. */
export function textStyle(bold = false, size = ui.fontSize): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: ui.fontFamily, fontSize: `${size}px`, color: ui.ink, fontStyle: bold ? 'bold' : 'normal' };
}

/** Space left of each item for the cursor arrow. */
const CURSOR_W = 12;

/**
 * A wood-framed parchment panel (PixelLab art, 9-sliced so it stretches to fit)
 * with an optional title, info lines, a selectable list and a help line.
 * The selected row gets a soft highlight band and a bobbing arrow.
 * Drawn in screen space; the texture is loaded once by BootScene.
 */
export class MenuPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly itemTexts: Phaser.GameObjects.Text[] = [];
  private readonly highlight: Phaser.GameObjects.Rectangle | null = null;
  private readonly cursor: Phaser.GameObjects.Text | null = null;
  private index = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: MenuPanelOptions,
  ) {
    const pad = ui.panelPad;
    const lineH = ui.fontSize + 7;
    const items = opts.items ?? [];
    const objs: Phaser.GameObjects.GameObject[] = [];
    let y = pad - 1;
    let maxW = opts.minWidth ?? 0;
    const add = (t: Phaser.GameObjects.Text) => {
      objs.push(t);
      maxW = Math.max(maxW, t.x + t.width - pad);
      return t;
    };
    if (opts.title) {
      add(scene.add.text(pad, y, opts.title, { ...textStyle(true, ui.fontSize + 1) }));
      y += lineH + 1;
    }
    for (const l of opts.lines ?? []) {
      const t = add(scene.add.text(pad, y, l, { ...textStyle(), lineSpacing: 3 }));
      y += t.height + 4;
    }
    const itemsTop = y;
    for (const item of items) {
      this.itemTexts.push(add(scene.add.text(pad + CURSOR_W, y, item.label(), textStyle())));
      y += lineH;
    }
    if (opts.help) {
      const h = scene.add.text(pad, y + 3, opts.help, { ...textStyle(false, ui.fontSize - 3), color: ui.help });
      add(h);
      y += h.height + 3;
    }
    const w = Math.ceil(maxW + pad * 2);
    const h = Math.ceil(y + pad - 2);
    const s = ui.panelSlice;
    const bg = scene.add.nineslice(0, 0, UI_TEX.panel, undefined, w, h, s, s, s, s).setOrigin(0);
    const under: Phaser.GameObjects.GameObject[] = [bg];
    if (items.length > 0) {
      this.highlight = scene.add.rectangle(pad - 4, itemsTop, w - pad * 2 + 8, lineH - 1, color(ui.highlight)).setOrigin(0, 0.08);
      this.cursor = scene.add.text(pad, itemsTop, '▸', textStyle(true));
      under.push(this.highlight);
      objs.push(this.cursor);
      scene.tweens.add({ targets: this.cursor, x: pad + 2, yoyo: true, repeat: -1, duration: 380, ease: 'Sine.easeInOut' });
    }

    const cam = scene.cameras.main;
    let x: number;
    let top: number;
    if (opts.anchor.kind === 'center') {
      x = (cam.width - w) / 2;
      top = opts.anchor.y ?? (cam.height - h) / 2;
    } else if (opts.anchor.kind === 'right') {
      x = cam.width - w - opts.anchor.margin;
      top = opts.anchor.y;
    } else {
      // World point -> screen point (the camera may be scrolled to centre the room).
      x = opts.anchor.x - cam.scrollX - w / 2;
      top = opts.anchor.y - cam.scrollY - h;
    }
    x = Math.round(Phaser.Math.Clamp(x, 4, cam.width - w - 4));
    top = Math.round(Phaser.Math.Clamp(top, 4, cam.height - h - 4));
    this.container = scene.add.container(x, top, [...under, ...objs]).setDepth(50_000).setScrollFactor(0);
    // A quick pop-in so panels feel like they open rather than appear.
    this.container.setAlpha(0).setY(top + 4);
    scene.tweens.add({ targets: this.container, y: top, alpha: 1, duration: 120, ease: 'Quad.easeOut' });
    this.refresh();
  }

  /** Re-reads item labels (after a value changed) and moves the highlight. */
  refresh(): void {
    const items = this.opts.items ?? [];
    this.itemTexts.forEach((t, i) => {
      t.setText(items[i].label());
      t.setFontStyle(i === this.index ? 'bold' : 'normal');
    });
    const sel = this.itemTexts[this.index];
    if (sel) {
      this.highlight?.setY(sel.y);
      this.cursor?.setY(sel.y);
    }
  }

  /**
   * Applies one frame of input. Returns 'cancel' when Esc was pressed, so the
   * owner decides what closing means; selection calls the item's onSelect.
   */
  handle(input: MenuInput): 'cancel' | null {
    const items = this.opts.items ?? [];
    if (input.cancel) return 'cancel';
    if (items.length === 0) return input.confirm ? 'cancel' : null;
    if (input.down) this.index = (this.index + 1) % items.length;
    if (input.up) this.index = (this.index + items.length - 1) % items.length;
    const item = items[this.index];
    if (input.left) item.onLeft?.();
    if (input.right) item.onRight?.();
    this.refresh();
    if (input.confirm) item.onSelect?.();
    return null;
  }

  destroy(): void {
    if (this.cursor) this.scene.tweens.killTweensOf(this.cursor);
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
