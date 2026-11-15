import Phaser from 'phaser';
import { foamMask, isOpenWater, shoreDistance, type WaterRules } from '../logic/water';

/** Pixel shape of one wave crest ('#' = lit, '-' = trough shadow). */
const CREST = ['...####...', '.##----##.', '#--....--#'];
const CREST_KEY = 'water_crest';

const rgb = (hex: string) => Phaser.Display.Color.HexStringToColor(hex);

/**
 * Animated water for a Wang-tiled town: foam that laps at the bank (two bands
 * built from the water tileset's own pixels, pulsing in turn) and small wave
 * crests that rise, drift and fade on open water in view.
 */
export class WaterFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rules: WaterRules,
    /** Town corner grid (letters; 'w' = water). */
    private readonly corners: string[],
    private readonly tileSize: number,
    private readonly rng: () => number,
  ) {}

  /**
   * Foam layers over the water tilemap: same tile indices as `waterData`,
   * drawn from foam sheets derived from the water tileset `waterKey`.
   */
  addFoam(waterKey: string, waterData: number[][], depth: number): void {
    const s = this.tileSize;
    const f = this.rules.foam;
    const src = this.scene.textures.get(waterKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const w = src.width;
    const h = src.height;
    const read = document.createElement('canvas');
    read.width = w;
    read.height = h;
    const rctx = read.getContext('2d', { willReadFrequently: true });
    if (!rctx) return;
    rctx.drawImage(src, 0, 0);
    const c = rgb(f.color);
    const bands: [string, [number, number], boolean][] = [
      [`${waterKey}_foam_near`, f.near, false],
      [`${waterKey}_foam_far`, f.far, true],
    ];
    const maxDist = Math.max(f.near[1], f.far[1]);
    const sheets = bands.map(() => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      return cv;
    });
    // Each tile frame on its own, so frame edges never count as bank.
    for (let fy = 0; fy + s <= h; fy += s) {
      for (let fx = 0; fx + s <= w; fx += s) {
        const px = rctx.getImageData(fx, fy, s, s).data;
        const dist = shoreDistance(px, s, s, maxDist);
        bands.forEach(([, band, sparse], bi) => {
          const mask = foamMask(dist, s, band, sparse);
          const ctx = sheets[bi].getContext('2d');
          if (!ctx) return;
          const img = ctx.createImageData(s, s);
          for (let i = 0; i < mask.length; i++) {
            if (!mask[i]) continue;
            img.data.set([c.red, c.green, c.blue, 255], i * 4);
          }
          ctx.putImageData(img, fx, fy);
        });
      }
    }
    bands.forEach(([key], bi) => {
      if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, sheets[bi]);
      const tm = this.scene.make.tilemap({ data: waterData.map((r) => [...r]), tileWidth: s, tileHeight: s });
      const tiles = tm.addTilesetImage(key, key, s, s, 0, 0);
      const layer = tiles ? tm.createLayer(0, tiles, 0, 0) : null;
      if (!layer) return;
      // Near and far bands pulse half a cycle apart: the water comes in, then goes out.
      layer.setDepth(depth + bi).setAlpha(bi === 0 ? f.alpha[1] : f.alpha[0]);
      this.scene.tweens.add({ targets: layer, alpha: bi === 0 ? f.alpha[0] : f.alpha[1], duration: f.periodMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  /** Starts spawning wave crests on open water in the camera's view. */
  startCrests(depth: number): void {
    this.makeCrestTexture();
    this.scene.time.addEvent({ delay: this.rules.crests.everyMs, loop: true, callback: () => this.crest(depth) });
  }

  private makeCrestTexture(): void {
    if (this.scene.textures.exists(CREST_KEY)) return;
    const cv = this.scene.textures.createCanvas(CREST_KEY, CREST[0].length, CREST.length);
    if (!cv) return;
    const ctx = cv.getContext();
    const fill = { '#': this.rules.crests.color, '-': this.rules.crests.shadow } as Record<string, string>;
    CREST.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (!fill[ch]) return;
        ctx.fillStyle = fill[ch];
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    cv.refresh();
  }

  private crest(depth: number): void {
    const r = this.rules.crests;
    const view = this.scene.cameras.main.worldView;
    const x = Math.round(view.x + this.rng() * view.width);
    const y = Math.round(view.y + this.rng() * view.height);
    if (!isOpenWater(this.corners, Math.floor(x / this.tileSize), Math.floor(y / this.tileSize))) return;
    const life = r.lifeMs[0] + this.rng() * (r.lifeMs[1] - r.lifeMs[0]);
    const drift = (r.drift[0] + this.rng() * (r.drift[1] - r.drift[0])) * (this.rng() < 0.5 ? -1 : 1);
    const img = this.scene.add.image(x, y, CREST_KEY).setDepth(depth).setAlpha(0);
    this.scene.tweens.add({ targets: img, alpha: r.alpha, duration: life / 2, yoyo: true, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: img, x: x + drift, duration: life, ease: 'Sine.easeInOut', onUpdate: () => img.setX(Math.round(img.x)), onComplete: () => img.destroy() });
  }
}
