import Phaser from 'phaser';
import mapJson from '../data/map.json';
import ui from '../data/ui.json';
import { navigate, parseMap, type Place, type TownMap } from '../logic/map';
import { closeOverlay } from './overlay';
import { services } from './services';
import { Keys } from './ui/input';
import { MenuPanel, textStyle } from './ui/MenuPanel';

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Marker radius (px) when idle and when selected. */
const PIN_R = 4;
const PIN_R_SELECTED = 6;

/** Opened from the town with M (or the pause menu). */
export interface MapData {
  /** Scene to resume on Esc. */
  from?: string;
  /** Place selected when the map opens (the one nearest the player). */
  at?: string;
  /** Carried through so a following pet travels too. */
  petFollowing?: boolean;
}

/**
 * Fast-travel map, drawn over the paused town: the illustrated town with a
 * marker per place from src/data/map.json. Arrows hop between markers, E
 * travels there (the town restarts at that place), Esc returns to the town.
 */
export class MapScene extends Phaser.Scene {
  private map!: TownMap;
  private keys!: Keys;
  private selected = '';
  private pins = new Map<string, Phaser.GameObjects.Arc>();
  private label: MenuPanel | null = null;
  private arrow!: Phaser.GameObjects.Text;
  private data_: MapData = {};

  constructor() {
    super('MapScene');
  }

  init(data: MapData): void {
    this.data_ = data ?? {};
    this.selected = '';
    this.label = null;
  }

  preload(): void {
    this.map = parseMap(mapJson);
    this.load.image(this.map.background, `assets/map/${this.map.background}.png`);
  }

  create(): void {
    const t = services(this).i18n.t;
    this.keys = new Keys(this);
    this.add.image(0, 0, this.map.background).setOrigin(0);

    const outline = { stroke: ui.ink, strokeThickness: 4 };
    this.add.text(this.scale.width / 2, 12, t('map.title'), { ...textStyle(true, 16), color: ui.panel, ...outline }).setOrigin(0.5, 0).setDepth(10);
    this.add
      .text(this.scale.width / 2, this.scale.height - 6, t('map.help'), { ...textStyle(false, 9), color: ui.panel, stroke: ui.ink, strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(10);

    this.pins.clear();
    for (const p of this.map.places) {
      const fill = p.id === 'home' ? ui.heart : p.status === 'open' ? ui.panel : ui.disabled;
      this.pins.set(p.id, this.add.circle(p.x, p.y, PIN_R, color(fill)).setStrokeStyle(2, color(ui.ink)).setDepth(20));
    }
    this.arrow = this.add.text(0, 0, '▼', { ...textStyle(true, 10), color: ui.panel, stroke: ui.ink, strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(30);

    const at = this.data_.at && this.map.places.some((p) => p.id === this.data_.at) ? this.data_.at : this.map.start;
    this.select(at);
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  update(): void {
    const input = this.keys.read();
    if (input.cancel) return closeOverlay(this, this.data_.from ?? 'TownScene');
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      if (input[dir]) {
        const next = navigate(this.map.places, this.selected, dir);
        if (next !== this.selected) this.select(next);
      }
    }
    if (input.confirm) this.travel(this.place(this.selected));
  }

  private place(id: string): Place {
    const p = this.map.places.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown place "${id}"`);
    return p;
  }

  /** Highlights a marker and shows its name panel. */
  private select(id: string): void {
    const t = services(this).i18n.t;
    this.pins.get(this.selected)?.setRadius(PIN_R);
    this.selected = id;
    const p = this.place(id);
    this.pins.get(id)?.setRadius(PIN_R_SELECTED);
    this.tweens.killTweensOf(this.arrow);
    this.arrow.setPosition(p.x, p.y - PIN_R_SELECTED - 2);
    this.tweens.add({ targets: this.arrow, y: '-=3', yoyo: true, repeat: -1, duration: 350, ease: 'Sine.easeInOut' });
    this.label?.destroy();
    const lines = [t('map.travel')];
    if (p.status !== 'open') lines.push(t('map.soon'));
    this.label = new MenuPanel(this, { title: t(`places.${id}`), lines, anchor: { kind: 'above', x: p.x, y: p.y - 20 } });
  }

  /** Restarts the town at the chosen place. */
  private travel(p: Place): void {
    const town = this.data_.from ?? 'TownScene';
    this.scene.stop();
    this.scene.get(town).scene.restart({ from: 'travel', place: p.id, petFollowing: this.data_.petFollowing });
  }
}
