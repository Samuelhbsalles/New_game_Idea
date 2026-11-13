import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CreatorScene } from './scenes/CreatorScene';
import { CreditsScene } from './scenes/CreditsScene';
import { HomeScene } from './scenes/HomeScene';
import { MapScene } from './scenes/MapScene';
import { OptionsScene } from './scenes/OptionsScene';
import { installServices } from './scenes/services';
import { TitleScene } from './scenes/TitleScene';
import { InteriorScene } from './scenes/InteriorScene';
import { TownScene } from './scenes/TownScene';

const WIDTH = 480;
const HEIGHT = 270;

/**
 * Largest whole-number scale that fits the window, measured in physical pixels
 * (devicePixelRatio), so every game pixel becomes an exact NxN block on screen.
 * A fractional scale (e.g. 2.83x) makes some pixels 2 wide and others 3, which
 * reads as blurry, uneven pixel art. Returned as a CSS zoom for Phaser.
 */
function pixelPerfectZoom(): number {
  const dpr = window.devicePixelRatio || 1;
  const n = Math.max(1, Math.floor(Math.min((window.innerWidth * dpr) / WIDTH, (window.innerHeight * dpr) / HEIGHT)));
  return n / dpr;
}

// 16:9 at a low resolution so 32px pixel art reads large, scaled by a whole number.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#3B2A3F',
  physics: { default: 'arcade' },
  // Centring is done by index.html's flex container; Phaser's autoCenter would add a second offset.
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER, zoom: pixelPerfectZoom() },
  scene: [BootScene, TitleScene, CreatorScene, HomeScene, TownScene, InteriorScene, MapScene, OptionsScene, CreditsScene],
});
installServices(game);
window.addEventListener('resize', () => game.scale.setZoom(pixelPerfectZoom()));

// Dev-only handle for inspecting the running game from the browser console.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

// Dev-only shortcut ?scene=home (skips the title) lives in BootScene.
