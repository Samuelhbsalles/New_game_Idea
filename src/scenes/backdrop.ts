import Phaser from 'phaser';
import ui from '../data/ui.json';

/** How much the backdrop is darkened (0-1), so the room itself stays the bright centre of the screen. */
const DIM = 0.35;

/** Queues a room's backdrop texture (public/assets/backdrops/<key>.png), if it has one. */
export function preloadBackdrop(scene: Phaser.Scene, key: string | null): void {
  if (key && !scene.textures.exists(key)) scene.load.image(key, `assets/backdrops/${key}.png`);
}

/**
 * Fills the screen behind a room picture with its themed texture, tiled and
 * slightly dimmed (brick behind the bakery, tiles behind the pharmacy...).
 * Fixed to the screen: rooms are smaller than the view and do not scroll.
 */
export function addBackdrop(scene: Phaser.Scene, key: string | null): void {
  if (!key || !scene.textures.exists(key)) return;
  const { width, height } = scene.cameras.main;
  scene.add.tileSprite(0, 0, width, height, key).setOrigin(0, 0).setScrollFactor(0).setDepth(-2000);
  scene.add
    .rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(ui.ink).color, DIM)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-1999);
}
