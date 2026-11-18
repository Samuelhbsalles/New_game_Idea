import Phaser from 'phaser';
import type { Ride } from '../logic/rides';
import type { Dir } from './sprites';

/** Images each ride has: seen from the side (left/right), from the front (up/down), and the bag icon. */
export const RIDE_VIEWS = ['side', 'front', 'icon'] as const;

/**
 * The ride drawn at the player's feet while riding: the side view facing
 * left or right, the front view facing up or down. Hidden on foot.
 */
export class RideSprite {
  private readonly img: Phaser.GameObjects.Image;
  private rideId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.img = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setVisible(false);
  }

  /** Shows `ride` (or hides it for null) under/over the player's feet facing `facing`, as its look says (rides.json). */
  update(ride: Ride | null, feet: { x: number; y: number }, facing: Dir, playerDepth: number): void {
    const look = ride?.look;
    const rideId = ride?.id ?? null;
    if (!rideId || !look) {
      this.img.setVisible(false);
      this.rideId = null;
      return;
    }
    const side = facing === 'left' || facing === 'right';
    const key = `ride_${rideId}_${side ? 'side' : 'front'}`;
    if (this.img.texture.key !== key) this.img.setTexture(key);
    this.rideId = rideId;
    this.img
      .setVisible(true)
      .setFlipX(facing === 'left')
      .setPosition(Math.round(feet.x), Math.round(feet.y + look.dy))
      .setDepth(playerDepth + (look.over ? 0.5 : -0.5));
  }

  /** The ride shown now, or null on foot. */
  get showing(): string | null {
    return this.rideId;
  }
}
