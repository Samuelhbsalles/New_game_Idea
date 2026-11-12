import Phaser from 'phaser';
import { nextDelay } from '../logic/ambient';
import type { BirdsDef } from '../logic/town';

/** Texture keys: flying flap frames and the grounded pigeon with its peck loop. */
export const BIRD_TEX = {
  fly: 'town_bird_fly',
  flyFrames: 5,
  ground: 'town_pigeon',
  peck: 'town_pigeon_peck',
  peckFrames: 9,
} as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Grounded pigeons are drawn at this scale so they read smaller than people. */
const GROUND_SCALE = 0.75;
/** How far off-screen (px) birds start and leave. */
const OFFSCREEN = 40;
/** Seconds between little hops while grounded, roughly. */
const HOP_EVERY_MS: [number, number] = [1500, 4000];
const HOP_PX = 10;

type BirdState = 'arriving' | 'grounded' | 'leaving';

/** One pigeon of a flock. */
export interface Bird {
  sprite: Phaser.GameObjects.Sprite;
  state: BirdState;
  leaveAt: number;
  nextHopAt: number;
}

/**
 * Flocks of pigeons that arrive on a timer (not constantly), land in the
 * plaza, peck and hop about, and leave when their time is up or when the
 * player runs at them. Grounded birds can be listed for a future capture
 * mechanic (story-006).
 */
export class TownBirds {
  readonly birds: Bird[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: BirdsDef,
    private readonly rng: () => number,
  ) {
    const a = scene.anims;
    if (!a.exists('bird_flap')) a.create({ key: 'bird_flap', frames: Array.from({ length: BIRD_TEX.flyFrames }, (_, i) => ({ key: `${BIRD_TEX.fly}_${pad2(i + 1)}` })), frameRate: def.fps, repeat: -1 });
    if (!a.exists('bird_peck')) a.create({ key: 'bird_peck', frames: Array.from({ length: BIRD_TEX.peckFrames }, (_, i) => ({ key: `${BIRD_TEX.peck}_${pad2(i + 1)}` })), frameRate: def.fps, repeat: -1, repeatDelay: 900 });
    scene.time.delayedCall(def.firstMs, () => this.flockIn());
  }

  /** Queues every bird texture. Call from a preload. */
  static preload(scene: Phaser.Scene): void {
    for (let i = 1; i <= BIRD_TEX.flyFrames; i++) scene.load.image(`${BIRD_TEX.fly}_${pad2(i)}`, `assets/town/${BIRD_TEX.fly}_${pad2(i)}.png`);
    for (let i = 1; i <= BIRD_TEX.peckFrames; i++) scene.load.image(`${BIRD_TEX.peck}_${pad2(i)}`, `assets/town/${BIRD_TEX.peck}_${pad2(i)}.png`);
    scene.load.image(BIRD_TEX.ground, `assets/town/${BIRD_TEX.ground}.png`);
  }

  /** Grounded birds within `range` px of a point (for capture later). */
  grounded(near: { x: number; y: number }, range: number): Bird[] {
    return this.birds.filter((b) => b.state === 'grounded' && Math.hypot(b.sprite.x - near.x, b.sprite.y - near.y) <= range);
  }

  /** Per frame: hops, leaving on time, and fleeing from a moving player. */
  update(now: number, player: { x: number; y: number; moving: boolean }): void {
    for (const b of this.birds) {
      if (b.state !== 'grounded') continue;
      const scared = player.moving && Math.hypot(b.sprite.x - player.x, b.sprite.y - player.y) < this.def.scareRadius;
      if (scared || now >= b.leaveAt) {
        this.flyAway(b, scared ? player : null);
        continue;
      }
      if (now >= b.nextHopAt) {
        b.nextHopAt = now + nextDelay(HOP_EVERY_MS, this.rng);
        const L = this.def.landing;
        const nx = Phaser.Math.Clamp(b.sprite.x + (this.rng() - 0.5) * 2 * HOP_PX, L.x, L.x + L.w);
        const ny = Phaser.Math.Clamp(b.sprite.y + (this.rng() - 0.5) * 2 * HOP_PX, L.y, L.y + L.h);
        b.sprite.setFlipX(nx < b.sprite.x);
        this.scene.tweens.add({ targets: b.sprite, x: nx, y: ny, duration: 220, ease: 'Quad.easeOut', onUpdate: () => b.sprite.setDepth(b.sprite.y) });
      }
    }
  }

  private flockIn(): void {
    const view = this.scene.cameras.main.worldView;
    const n = Math.round(this.def.flock[0] + (this.def.flock[1] - this.def.flock[0]) * this.rng());
    const fromLeft = this.rng() < 0.5;
    const stay = nextDelay(this.def.stayMs, this.rng);
    for (let i = 0; i < n; i++) {
      const L = this.def.landing;
      const land = { x: L.x + this.rng() * L.w, y: L.y + this.rng() * L.h };
      const start = { x: fromLeft ? view.x - OFFSCREEN - i * 18 : view.right + OFFSCREEN + i * 18, y: view.y + this.rng() * view.height * 0.4 };
      const sprite = this.scene.add.sprite(start.x, start.y, `${BIRD_TEX.fly}_01`).play('bird_flap').setDepth(40_000).setFlipX(!fromLeft);
      const bird: Bird = { sprite, state: 'arriving', leaveAt: this.scene.time.now + stay + i * 800, nextHopAt: 0 };
      this.birds.push(bird);
      const dist = Math.hypot(land.x - start.x, land.y - start.y);
      const speed = this.def.speed[0] + (this.def.speed[1] - this.def.speed[0]) * this.rng();
      this.scene.tweens.add({
        targets: sprite,
        x: land.x,
        y: land.y,
        duration: (dist / speed) * 1000,
        ease: 'Sine.easeOut',
        onComplete: () => {
          bird.state = 'grounded';
          bird.nextHopAt = this.scene.time.now + nextDelay(HOP_EVERY_MS, this.rng);
          sprite.setTexture(BIRD_TEX.ground).setOrigin(0.5, 1).setScale(GROUND_SCALE).setDepth(sprite.y).play({ key: 'bird_peck', startFrame: Math.floor(this.rng() * BIRD_TEX.peckFrames) });
        },
      });
    }
    this.scene.time.delayedCall(stay + nextDelay(this.def.everyMs, this.rng), () => this.flockIn());
  }

  /** Takes off away from `from` (the player) or towards the nearest screen edge. */
  private flyAway(b: Bird, from: { x: number; y: number } | null): void {
    b.state = 'leaving';
    const view = this.scene.cameras.main.worldView;
    const goRight = from ? b.sprite.x >= from.x : this.rng() < 0.5;
    const target = { x: goRight ? view.right + OFFSCREEN : view.x - OFFSCREEN, y: view.y - OFFSCREEN };
    b.sprite.setOrigin(0.5, 0.5).setScale(1).setFlipX(!goRight).setDepth(40_000).play('bird_flap');
    this.scene.tweens.add({
      targets: b.sprite,
      x: target.x,
      y: target.y,
      duration: 1600,
      ease: 'Quad.easeIn',
      onComplete: () => {
        b.sprite.destroy();
        this.birds.splice(this.birds.indexOf(b), 1);
      },
    });
  }
}
