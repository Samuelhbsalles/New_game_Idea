import Phaser from 'phaser';
import ui from '../data/ui.json';
import { checkPlacement, drop, pickUp, pieceAt, pieceDepth, SHADOW_DEPTH, snap, store, unstore, type HomeLayout, type PlaceReason, type Placement } from '../logic/home';
import type { FloorPlan, FurnitureItem } from '../logic/room';
import { HudChip } from './ui/HudChip';
import type { Keys } from './ui/input';
import { MenuPanel, type MenuItem } from './ui/MenuPanel';

/** Cursor speed (px/s) while arranging furniture. */
const CURSOR_SPEED = 90;

/** A piece in hand: what it is, and where it came from (to put it back on cancel). */
interface Held {
  item: string;
  /** Its spot before it was picked up; null when it came out of storage. */
  from: Placement | null;
}

export interface DecoratorOptions {
  catalog: FurnitureItem[];
  plan: FloorPlan;
  layout: HomeLayout;
  keys: Keys;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Called after every change, with the new layout to save. */
  onChange: (layout: HomeLayout) => void;
  /** Called when the player leaves decorating. */
  onExit: () => void;
}

/**
 * Habbo-style arranging of your own apartment, with the keyboard: a cursor
 * (arrows) picks a piece up (E) and puts it down (E) where it fits; the ghost
 * is green where it fits and red where it does not. G packs a piece away, I
 * opens the stored pieces to place one, Esc puts a held piece back or leaves.
 * Draws its own copy of the furniture; the scene hides its own meanwhile.
 * Rules: src/logic/home.ts.
 */
export class HomeDecorator {
  private layout: HomeLayout;
  private held: Held | null = null;
  private readonly cursor: { x: number; y: number };
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Image | null = null;
  private readonly title: HudChip;
  private readonly help: HudChip;
  private panel: MenuPanel | null = null;
  private readonly keyStore: Phaser.Input.Keyboard.Key;
  private readonly keyInventory: Phaser.Input.Keyboard.Key;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: DecoratorOptions,
  ) {
    this.layout = o.layout;
    const bounds = o.plan.walkable[0];
    this.cursor = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    this.gfx = scene.add.graphics().setDepth(46_000);
    const cam = scene.cameras.main;
    this.title = new HudChip(scene, cam.width / 2, 4, { anchor: 'topCenter', fixed: true, depth: 60_000 }).setText(o.t('decor.title'));
    this.help = new HudChip(scene, cam.width / 2, cam.height - 4, { anchor: 'bottomCenter', fixed: true, depth: 60_000, size: 10 }).setText(o.t('decor.help'));
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    this.keyStore = kb.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.keyInventory = kb.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.render();
  }

  private item(id: string): FurnitureItem | undefined {
    return this.o.catalog.find((c) => c.id === id);
  }

  /** Per frame: menu, cursor, keys, then the cursor / hover / ghost drawing. */
  update(dt: number): void {
    const input = this.o.keys.read();
    if (this.panel) {
      if (this.panel.handle(input) === 'cancel') this.closePanel();
      return;
    }
    const { x: vx, y: vy } = this.o.keys.axis();
    const step = (CURSOR_SPEED * dt) / 1000;
    this.cursor.x = Phaser.Math.Clamp(this.cursor.x + vx * step, 0, this.o.plan.width);
    this.cursor.y = Phaser.Math.Clamp(this.cursor.y + vy * step, 0, this.o.plan.height);

    if (input.confirm) this.held ? this.putDown() : this.pickUpHovered();
    else if (Phaser.Input.Keyboard.JustDown(this.keyStore)) this.storeHeldOrHovered();
    else if (Phaser.Input.Keyboard.JustDown(this.keyInventory)) this.openInventory();
    else if (input.cancel) {
      if (this.held) this.putBack();
      else return this.o.onExit();
    }
    this.draw();
  }

  private hovered(): number {
    return this.held ? -1 : pieceAt(this.o.catalog, this.layout, this.cursor.x, this.cursor.y);
  }

  private pickUpHovered(): void {
    const i = this.hovered();
    if (i < 0) return;
    const { layout, held } = pickUp(this.layout, i);
    this.layout = layout;
    this.held = { item: held.item, from: held };
    this.cursor.x = held.x;
    this.cursor.y = held.y;
    this.render();
  }

  private putDown(): void {
    if (!this.held) return;
    const r = drop(this.o.plan, this.o.catalog, this.layout, this.held.item, this.cursor.x, this.cursor.y);
    if (!r.ok) return this.say(this.reasonText(r.reason));
    this.commit(r.layout);
  }

  /** Esc while holding: back where it was, or back into storage. */
  private putBack(): void {
    if (!this.held) return;
    const h = this.held;
    this.layout = h.from ? { ...this.layout, placements: [...this.layout.placements, h.from] } : store(this.layout, h.item);
    this.held = null;
    this.render();
  }

  private storeHeldOrHovered(): void {
    if (this.held) {
      const item = this.held.item;
      this.held = null;
      this.commit(store(this.layout, item));
      return;
    }
    const i = this.hovered();
    if (i < 0) return;
    const { layout, held } = pickUp(this.layout, i);
    this.commit(store(layout, held.item));
  }

  private commit(layout: HomeLayout): void {
    this.layout = layout;
    this.held = null;
    this.o.onChange(layout);
    this.render();
  }

  private openInventory(): void {
    if (this.held) return;
    const t = this.o.t;
    const entries = Object.entries(this.layout.stored);
    const items: MenuItem[] = entries.map(([id]) => ({
      label: () => t('decor.storedRow', { name: t(`furniture.${id}`), count: this.layout.stored[id] ?? 0 }),
      onSelect: () => {
        const next = unstore(this.layout, id);
        if (!next) return;
        this.closePanel();
        // Taken out of storage: saved only once it is put down (Esc puts it back).
        this.layout = next;
        this.held = { item: id, from: null };
        this.render();
      },
    }));
    items.push({ label: () => t('decor.close'), onSelect: () => this.closePanel() });
    const lines = entries.length === 0 ? [t('decor.nothingStored')] : undefined;
    this.panel = new MenuPanel(this.scene, { title: t('decor.inventory'), lines, items, help: t('work.help'), anchor: { kind: 'center' } });
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  private reasonText(reason: PlaceReason): string {
    return this.o.t(`decor.no.${reason}`);
  }

  /** Redraws the placed pieces (same depth rules as HomeScene) and the held one. */
  private render(): void {
    for (const im of this.images) im.destroy();
    this.images.length = 0;
    for (const p of this.layout.placements) {
      const it = this.item(p.item);
      if (!it) continue;
      if (it.shadow) this.images.push(this.scene.add.image(p.x + it.shadow.dx, p.y + it.shadow.dy, it.shadow.sprite).setOrigin(0, 0).setDepth(SHADOW_DEPTH));
      this.images.push(this.scene.add.image(p.x, p.y, it.sprite).setDepth(pieceDepth(it, p.y)));
    }
    this.ghost?.destroy();
    this.ghost = null;
    const held = this.held ? this.item(this.held.item) : undefined;
    if (held) this.ghost = this.scene.add.image(this.cursor.x, this.cursor.y, held.sprite).setDepth(45_000).setAlpha(0.75);
    this.draw();
  }

  /** Cursor cross, hover outline, and the ghost's fit colour. */
  private draw(): void {
    const g = this.gfx.clear();
    const ink = Phaser.Display.Color.HexStringToColor(ui.ink).color;
    const panel = Phaser.Display.Color.HexStringToColor(ui.panel).color;
    if (this.ghost && this.held) {
      const x = snap(this.cursor.x);
      const y = snap(this.cursor.y);
      this.ghost.setPosition(x, y);
      const fits = checkPlacement(this.o.plan, this.o.catalog, this.layout.placements, this.held.item, x, y).ok;
      this.ghost.setTint(fits ? 0xa8f0a0 : 0xf08a80);
    } else {
      const i = this.hovered();
      const p = this.layout.placements[i];
      const it = p ? this.item(p.item) : undefined;
      if (p && it) {
        g.lineStyle(1, panel, 1).strokeRect(Math.round(p.x - it.w / 2) - 1, Math.round(p.y - it.h / 2) - 1, it.w + 2, it.h + 2);
      }
    }
    const cx = Math.round(this.cursor.x);
    const cy = Math.round(this.cursor.y);
    g.fillStyle(ink, 1).fillRect(cx - 4, cy - 1, 9, 3).fillRect(cx - 1, cy - 4, 3, 9);
    g.fillStyle(panel, 1).fillRect(cx - 3, cy, 7, 1).fillRect(cx, cy - 3, 1, 7);
  }

  private say(msg: string): void {
    const txt = this.scene.add
      .text(this.cursor.x, this.cursor.y - 20, msg, { fontFamily: ui.fontFamily, fontSize: `${ui.fontSize}px`, color: ui.ink, backgroundColor: ui.panel, padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(48_000);
    this.scene.tweens.add({ targets: txt, y: txt.y - 12, alpha: 0, delay: 900, duration: 700, onComplete: () => txt.destroy() });
  }

  /** Removes everything this mode drew. */
  destroy(): void {
    this.closePanel();
    for (const im of this.images) im.destroy();
    this.ghost?.destroy();
    this.gfx.destroy();
    this.title.destroy();
    this.help.destroy();
    this.scene.input.keyboard?.removeKey(this.keyStore);
    this.scene.input.keyboard?.removeKey(this.keyInventory);
  }
}
