import Phaser from 'phaser';
import ui from '../../data/ui.json';
import { textStyle } from './MenuPanel';

/** Where the chip hangs from its x,y. */
export type ChipAnchor = 'topLeft' | 'topRight' | 'bottomCenter';

export interface HudChipOptions {
  anchor: ChipAnchor;
  /** Screen-fixed HUD (true) or a label in the world (false). */
  fixed: boolean;
  depth: number;
  size?: number;
  /** Text colour; defaults to the parchment colour. */
  color?: string;
}

const PAD_X = 4;
const PAD_Y = 2;

/**
 * A small dark rounded plate with plain text on it: HUD lines, counters and
 * countdowns. Replaces thick-stroked text, which at small sizes smears digits
 * together once the canvas is scaled up.
 */
export class HudChip {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private current = '\u0000';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly opts: HudChipOptions,
  ) {
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', { ...textStyle(false, opts.size ?? 12), color: opts.color ?? ui.panel });
    this.container = scene.add.container(x, y, [this.bg, this.label]).setDepth(opts.depth);
    if (opts.fixed) this.container.setScrollFactor(0);
  }

  /** Changes the text (and colour); redraws the plate only when something changed. */
  setText(text: string, color?: string): this {
    const c = color ?? this.opts.color ?? ui.panel;
    if (text === this.current && this.label.style.color === c) return this;
    this.current = text;
    this.label.setText(text).setColor(c);
    const w = Math.ceil(this.label.width) + PAD_X * 2;
    const h = Math.ceil(this.label.height) + PAD_Y * 2;
    const left = this.opts.anchor === 'topLeft' ? 0 : this.opts.anchor === 'topRight' ? -w : -Math.round(w / 2);
    const top = this.opts.anchor === 'bottomCenter' ? -h : 0;
    this.label.setPosition(left + PAD_X, top + PAD_Y);
    this.bg.clear();
    this.bg.fillStyle(Phaser.Display.Color.HexStringToColor(ui.ink).color, 0.85);
    this.bg.fillRoundedRect(left, top, w, h, 3);
    this.container.setVisible(text !== '');
    return this;
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }
}
