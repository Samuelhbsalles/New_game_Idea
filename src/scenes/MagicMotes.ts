import Phaser from 'phaser';
import type { Rng } from '../logic/ambient';
import type { Motes } from '../logic/town';
import { ensureSoftDisc } from './softDisc';

/** Above standing props and critters, under the HUD. */
const MOTE_DEPTH = 40_000;

/**
 * Little magic lights drifting in an area (the forest): each fades in, rises a
 * little while it softly pulses, fades out, and starts again somewhere else.
 */
export class MagicMotes {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: Motes,
    private readonly rng: Rng,
  ) {
    for (let i = 0; i < def.count; i++) {
      const dot = scene.add.circle(0, 0, 1.5, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(MOTE_DEPTH);
      // A soft halo around each light so it reads as a glow, not a pixel.
      const halo = scene.add.image(0, 0, ensureSoftDisc(scene)).setDisplaySize(14, 14).setBlendMode(Phaser.BlendModes.ADD).setDepth(MOTE_DEPTH - 1);
      // Stagger the first cycle so they do not all appear together.
      scene.time.delayedCall(this.between(0, def.lifeMs[1]), () => this.cycle(dot, halo));
    }
  }

  private between(a: number, b: number): number {
    return a + (b - a) * this.rng();
  }

  private cycle(dot: Phaser.GameObjects.Arc, halo: Phaser.GameObjects.Image): void {
    const d = this.def;
    const x = Math.round(this.between(d.area.x, d.area.x + d.area.w));
    const y = Math.round(this.between(d.area.y, d.area.y + d.area.h));
    const color = Phaser.Display.Color.HexStringToColor(d.colors[Math.floor(this.rng() * d.colors.length)]).color;
    const life = this.between(d.lifeMs[0], d.lifeMs[1]);
    const rise = this.between(d.rise[0], d.rise[1]);
    const drift = this.between(-6, 6);
    dot.setFillStyle(color);
    halo.setTint(color);
    for (const [o, peak] of [[dot, d.alpha], [halo, d.alpha * 0.6]] as const) {
      o.setPosition(x, y).setAlpha(0);
      this.scene.tweens.add({ targets: o, y: y - rise, x: x + drift, duration: life, ease: 'Sine.easeInOut' });
      this.scene.tweens.add({ targets: o, alpha: peak, duration: life / 2, yoyo: true, ease: 'Sine.easeInOut', onComplete: o === dot ? () => this.cycle(dot, halo) : undefined });
    }
  }
}
