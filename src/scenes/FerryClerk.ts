import Phaser from 'phaser';
import { clerkGreets, type ClerkRules } from '../logic/ferry';
import type { Rng } from '../logic/ambient';
import ui from '../data/ui.json';
import { textStyle } from './ui/MenuPanel';

const ART = 'npc_clerk';
const DIR = `assets/characters/${ART}/${ART}`;
const WAVE_FRAMES = 8;
const WAVE_KEY = `${ART}_wave`;
/** Everything of the clerk lower than this many px above the booth's base is cut off (it is behind the counter anyway). */
const HIDE_ABOVE_BASE = 12;
/** Speech bubbles sit above the booth roof: this far above the clerk's (hidden) feet. */
const BUBBLE_DY = 66;
/** How long a speech bubble stays before fading (ms). */
const BUBBLE_MS = 2200;

/**
 * The ferry ticket clerk standing inside the booth: breathes, waves and says
 * hello when the player comes close, and talks during the ticket menu.
 * Drawn between the booth and its front layer (counter and awning), so only
 * the chest and head show through the window.
 */
export class FerryClerk {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private greeted = false;
  private bubble: Phaser.GameObjects.Text | null = null;

  /** Queues the clerk's images (still pose and wave). */
  static preload(scene: Phaser.Scene): void {
    scene.load.image(`${ART}_idle`, `${DIR}_idle_down_01.png`);
    for (let i = 1; i <= WAVE_FRAMES; i++) scene.load.image(`${WAVE_KEY}_${i}`, `${DIR}_wave_down_${String(i).padStart(2, '0')}.png`);
  }

  /**
   * @param at the clerk's feet (hidden behind the counter); depth sits just above the booth at `boothY`.
   * @param greetings lines picked at random when the player arrives.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    at: { x: number; y: number },
    boothY: number,
    private readonly rules: ClerkRules,
    private readonly greetings: string[],
    private readonly rng: Rng,
  ) {
    if (!scene.anims.exists(WAVE_KEY)) {
      scene.anims.create({
        key: WAVE_KEY,
        frames: Array.from({ length: WAVE_FRAMES }, (_, i) => ({ key: `${WAVE_KEY}_${i + 1}` })),
        frameRate: rules.waveFps,
        repeat: 0,
      });
    }
    this.sprite = scene.add.sprite(at.x, at.y, `${ART}_idle`).setOrigin(0.5, 1).setDepth(boothY + 1);
    // Cut the clerk off above the booth's base: the booth has gaps between its legs,
    // and feet showing under it read as someone standing outside.
    const frameH = this.sprite.frame.height;
    const visible = Math.max(0, frameH - (at.y - (boothY - HIDE_ABOVE_BASE)));
    this.sprite.setCrop(0, 0, this.sprite.frame.width, visible);
    // Gentle breathing while idle (the feet are hidden, so stretching from the bottom reads as a breath).
    scene.tweens.add({ targets: this.sprite, scaleY: 1.025, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sprite.setTexture(`${ART}_idle`));
  }

  /** Greets the player (wave + a hello) on arrival; call every frame with the player's feet. */
  update(player: { x: number; y: number }): void {
    const r = clerkGreets(this.greeted, Phaser.Math.Distance.Between(player.x, player.y, this.sprite.x, this.sprite.y), this.rules);
    this.greeted = r.greeted;
    if (r.greetNow && this.greetings.length > 0) {
      this.wave();
      this.say(this.greetings[Math.floor(this.rng() * this.greetings.length)]);
    }
  }

  /** Plays the wave once, then goes back to the still pose. */
  wave(): void {
    this.sprite.play(WAVE_KEY);
  }

  /** Shows a speech bubble over the booth, replacing any earlier one. */
  say(text: string): void {
    this.bubble?.destroy();
    const b = this.scene.add
      .text(this.sprite.x, this.sprite.y - BUBBLE_DY, text, { ...textStyle(false, 10), color: ui.ink, backgroundColor: ui.panel, padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(50_000);
    this.bubble = b;
    this.scene.tweens.add({
      targets: b,
      y: b.y - 4,
      alpha: 0,
      delay: BUBBLE_MS,
      duration: 400,
      onComplete: () => {
        b.destroy();
        if (this.bubble === b) this.bubble = null;
      },
    });
  }
}
