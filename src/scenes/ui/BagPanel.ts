import Phaser from 'phaser';
import ui from '../../data/ui.json';
import type { BagTab } from '../../logic/bag';
import type { MenuInput } from './input';
import { textStyle } from './MenuPanel';

/** One square in the bag grid. */
export interface BagSlot {
  /** Stable id (item id or creature id). */
  id: string;
  /** Texture to draw in the square (an item icon or a creature's idle frame). */
  texture: string | null;
  /** Shown in the corner when set. */
  count?: number;
  /** Shown under the grid when selected. */
  name: string;
  description: string;
  /** Dimmed (e.g. a creature left at home). */
  faded?: boolean;
}

/** One thing E can do on a square. */
export interface BagAction {
  label: string;
  run: () => void;
}

/** What the scene puts in the bag and what E does on a square. */
export interface BagContent {
  tabs: BagTab[];
  tabLabel: (tab: BagTab) => string;
  /** Squares of a tab; null leaves a square empty (e.g. the rest of the party row). */
  slots: (tab: BagTab) => (BagSlot | null)[];
  /** What E can do on a square: none, one (E does it), or several (E opens a small list). */
  actions: (tab: BagTab, slot: BagSlot) => BagAction[];
  /** Rows shown for a tab (default: the bag's rows). */
  rows?: (tab: BagTab) => number;
  /** Label for the "choose an option" hint when a square has several actions. */
  options: string;
  title: string;
  /** Shown when a tab is empty. */
  empty: string;
  help: string;
}

/** How long a message stays in the bag (ms). */
const NOTICE_MS = 2200;
const SLOT = 32;
const GAP = 4;
const PAD = 10;
const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/**
 * The bag (user's design 2026-11-15): tabs on top, a grid of squares with an
 * icon and a count, and the selected square's name, description and action
 * below. Arrows move, up from the top row reaches the tabs, E acts, Esc
 * closes. Squares and tabs can also be tapped (tap the selected square again
 * to act). Same handle()/destroy() shape as MenuPanel, so scenes treat it as
 * their open panel.
 */
export class BagPanel {
  private root: Phaser.GameObjects.Container | null = null;
  /** Set by destroy(): an action may close the bag mid-handle, after which nothing is drawn again. */
  private closed = false;
  private tab: number;
  private index = 0;
  /** Keyboard focus: the tab row or the grid. */
  private onTabs = false;
  /** A short message shown inside the bag (e.g. why an action can't be done here). */
  private notice: string | null = null;
  private noticeTimer: Phaser.Time.TimerEvent | null = null;
  /** Open list of options for a square with several actions. */
  private choice: { actions: BagAction[]; index: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: BagContent,
    private readonly cols: number,
    private readonly rows: number,
    startTab: BagTab = content.tabs[0],
  ) {
    this.tab = Math.max(0, content.tabs.indexOf(startTab));
    this.render();
  }

  private get tabId(): BagTab {
    return this.content.tabs[this.tab];
  }

  /** Arrows / E / Esc. Returns 'cancel' when the bag should close. */
  handle(input: MenuInput): 'cancel' | null {
    if (this.choice) {
      // A square's option list: up/down, E picks, Esc goes back to the grid.
      const c = this.choice;
      if (input.cancel) this.choice = null;
      if (input.up) c.index = (c.index - 1 + c.actions.length) % c.actions.length;
      if (input.down) c.index = (c.index + 1) % c.actions.length;
      if (input.confirm) {
        this.choice = null;
        c.actions[c.index].run();
      }
      if (input.cancel || input.up || input.down || input.confirm) this.render();
      return null;
    }
    if (input.cancel) return 'cancel';
    const slots = this.content.slots(this.tabId);
    const n = this.cols * this.rowsHere();
    if (this.onTabs) {
      if (input.left) this.switchTab(-1);
      if (input.right) this.switchTab(1);
      if (input.down || input.confirm) this.onTabs = false;
    } else {
      if (input.left) this.index = Math.max(0, this.index - 1);
      if (input.right) this.index = Math.min(n - 1, this.index + 1);
      if (input.down) this.index = Math.min(n - 1, this.index + this.cols);
      if (input.up) {
        if (this.index < this.cols) this.onTabs = true;
        else this.index -= this.cols;
      }
      if (input.confirm) this.act(slots);
    }
    if (input.left || input.right || input.up || input.down) this.notice = null;
    if (input.left || input.right || input.up || input.down || input.confirm) this.render();
    return null;
  }

  /** Rows of the current tab. */
  private rowsHere(): number {
    return this.content.rows?.(this.tabId) ?? this.rows;
  }

  private switchTab(d: number): void {
    const k = this.content.tabs.length;
    this.tab = (this.tab + d + k) % k;
    this.index = 0;
  }

  private act(slots: (BagSlot | null)[]): void {
    const slot = slots[this.index];
    if (!slot) return;
    const list = this.content.actions(this.tabId, slot);
    if (list.length === 1) list[0].run();
    else if (list.length > 1) this.choice = { actions: list, index: 0 };
  }

  /** Redraws everything (cheap: a few dozen objects). */
  private render(): void {
    if (this.closed) return;
    this.root?.destroy();
    const cam = this.scene.cameras.main;
    const gridW = this.cols * SLOT + (this.cols - 1) * GAP;
    const w = gridW + PAD * 2;
    const rows = this.rowsHere();
    const h = 18 + 18 + rows * (SLOT + GAP) + 50 + PAD;
    const x0 = Math.round((cam.width - w) / 2);
    const y0 = Math.round((cam.height - h) / 2) - 6;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(this.scene.add.rectangle(x0 + w / 2, y0 + h / 2, w, h, color(ui.panel)).setStrokeStyle(2, color(ui.ink)));
    parts.push(this.scene.add.text(x0 + PAD, y0 + 4, this.content.title, textStyle(true)));

    // Tabs.
    let tx = x0 + PAD;
    this.content.tabs.forEach((tab, i) => {
      const active = i === this.tab;
      const label = this.scene.add.text(tx + 4, y0 + 22, this.content.tabLabel(tab), { ...textStyle(active), color: active ? ui.ink : ui.help });
      const bw = Math.ceil(label.width) + 8;
      const bg = this.scene.add.rectangle(tx, y0 + 21, bw, 16, color(active ? ui.highlight : ui.panelShade)).setOrigin(0, 0);
      if (active && this.onTabs) bg.setStrokeStyle(1, color(ui.ink));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.tab = i;
        this.index = 0;
        this.onTabs = false;
        this.render();
      });
      parts.push(bg, label);
      tx += bw + 4;
    });

    // Grid.
    const slots = this.content.slots(this.tabId);
    const gy = y0 + 42;
    for (let i = 0; i < this.cols * rows; i++) {
      const sx = x0 + PAD + (i % this.cols) * (SLOT + GAP);
      const sy = gy + Math.floor(i / this.cols) * (SLOT + GAP);
      const selected = !this.onTabs && i === this.index;
      const box = this.scene.add.rectangle(sx, sy, SLOT, SLOT, color(ui.panelShade)).setOrigin(0, 0).setStrokeStyle(selected ? 2 : 1, color(selected ? ui.heart : ui.help));
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        const again = !this.onTabs && this.index === i;
        this.onTabs = false;
        this.index = i;
        if (again) this.act(this.content.slots(this.tabId));
        this.render();
      });
      parts.push(box);
      const slot = slots[i];
      if (!slot) continue;
      if (slot.texture && this.scene.textures.exists(slot.texture)) {
        const img = this.scene.add.image(sx + SLOT / 2, sy + SLOT / 2, slot.texture);
        const fit = Math.min(1, (SLOT - 4) / Math.max(img.width, img.height));
        img.setScale(fit).setAlpha(slot.faded ? 0.45 : 1);
        parts.push(img);
      } else {
        parts.push(this.scene.add.text(sx + SLOT / 2, sy + SLOT / 2, slot.name.slice(0, 3), textStyle(false)).setOrigin(0.5));
      }
      if (slot.count !== undefined) parts.push(this.scene.add.text(sx + SLOT - 1, sy + SLOT, String(slot.count), { ...textStyle(true), stroke: ui.panel, strokeThickness: 3 }).setOrigin(1, 1));
    }

    // Info for the selected square.
    const iy = gy + rows * (SLOT + GAP) + 2;
    const sel = this.onTabs ? null : slots[this.index];
    if (this.choice) {
      // The open option list replaces the info lines.
      this.choice.actions.forEach((a, k) => {
        const on = k === this.choice!.index;
        parts.push(this.scene.add.text(x0 + PAD, iy + k * 15, `${on ? '▸ ' : '  '}${a.label}`, { ...textStyle(on), color: on ? ui.heart : ui.ink }));
      });
    } else if (this.notice) {
      parts.push(this.scene.add.text(x0 + PAD, iy, this.notice, { ...textStyle(true), color: ui.heart, wordWrap: { width: gridW } }));
    } else if (sel) {
      parts.push(this.scene.add.text(x0 + PAD, iy, sel.count !== undefined ? `${sel.name} (${sel.count})` : sel.name, textStyle(true)));
      parts.push(this.scene.add.text(x0 + PAD, iy + 16, sel.description, { ...textStyle(false), wordWrap: { width: gridW } }));
      const list = this.content.actions(this.tabId, sel);
      const hint = list.length === 1 ? list[0].label : list.length > 1 ? this.content.options : null;
      if (hint) parts.push(this.scene.add.text(x0 + w - PAD, iy, `E: ${hint}`, { ...textStyle(true), color: ui.heart }).setOrigin(1, 0));
    } else if (slots.every((x) => !x)) {
      parts.push(this.scene.add.text(x0 + PAD, iy, this.content.empty, { ...textStyle(false), color: ui.help }));
    }
    parts.push(this.scene.add.text(x0 + w / 2, y0 + h - 3, this.content.help, { ...textStyle(false), color: ui.help }).setOrigin(0.5, 1));
    this.root = this.scene.add.container(0, 0, parts).setScrollFactor(0).setDepth(59_000);
  }

  /** Shows a message inside the bag for a moment (messages in the world would be hidden behind it). */
  say(msg: string): void {
    this.notice = msg;
    this.noticeTimer?.remove();
    this.noticeTimer = this.scene.time.delayedCall(NOTICE_MS, () => {
      this.notice = null;
      this.render();
    });
    this.render();
  }

  /** Redraw after the scene changed what is in the bag (an action ran). */
  refresh(): void {
    this.render();
  }

  destroy(): void {
    this.closed = true;
    this.noticeTimer?.remove();
    this.root?.destroy();
    this.root = null;
  }
}
