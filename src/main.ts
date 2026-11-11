import Phaser from 'phaser';
import { HomeScene } from './scenes/HomeScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 352,
  pixelArt: true,
  backgroundColor: '#3B2A3F',
  physics: { default: 'arcade' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [HomeScene],
});
