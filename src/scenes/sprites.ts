import Phaser from 'phaser';

/** Facing directions used in asset names: <name>_<action>_<dir>_<frame>.png */
export type Dir = 'down' | 'up' | 'right' | 'left';

/** Directions that have their own walk art; 'left' mirrors 'right'. */
export const DRAWN_DIRS: Dir[] = ['down', 'up', 'right'];
export const ALL_DIRS: Dir[] = ['down', 'up', 'right', 'left'];

/** One extra animation drawn facing down only (e.g. rabbit eat/sleep). */
export interface ExtraAnim {
  action: string;
  frames: number;
  fps: number;
  repeat: number;
}

/** What art a character has, so the loader can follow the naming convention. */
export interface CharacterArt {
  name: string;
  folder: string;
  walkFrames: number;
  extras: ExtraAnim[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Queues every image for a character, named by the asset convention. */
export function loadCharacter(scene: Phaser.Scene, art: CharacterArt): void {
  const base = `assets/${art.folder}/${art.name}`;
  for (const d of ALL_DIRS) scene.load.image(`${art.name}_idle_${d}`, `${base}_idle_${d}_01.png`);
  for (const d of DRAWN_DIRS) {
    for (let i = 1; i <= art.walkFrames; i++) scene.load.image(`${art.name}_walk_${d}_${pad(i)}`, `${base}_walk_${d}_${pad(i)}.png`);
  }
  for (const x of art.extras) {
    for (let i = 1; i <= x.frames; i++) scene.load.image(`${art.name}_${x.action}_down_${pad(i)}`, `${base}_${x.action}_down_${pad(i)}.png`);
  }
}

/** Registers walk and extra animations for a loaded character. */
export function createCharacterAnims(scene: Phaser.Scene, art: CharacterArt, walkFps: number): void {
  for (const d of DRAWN_DIRS) {
    scene.anims.create({
      key: `${art.name}_walk_${d}`,
      frames: Array.from({ length: art.walkFrames }, (_, i) => ({ key: `${art.name}_walk_${d}_${pad(i + 1)}` })),
      frameRate: walkFps,
      repeat: -1,
    });
  }
  for (const x of art.extras) {
    scene.anims.create({
      key: `${art.name}_${x.action}`,
      frames: Array.from({ length: x.frames }, (_, i) => ({ key: `${art.name}_${x.action}_down_${pad(i + 1)}` })),
      frameRate: x.fps,
      repeat: x.repeat,
    });
  }
}

/** Facing for a velocity; horizontal wins on diagonals so side-walking reads clearly. */
export function facingFor(vx: number, vy: number, current: Dir): Dir {
  if (vx === 0 && vy === 0) return current;
  if (Math.abs(vx) >= Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/** Plays walk (moving) or shows the idle frame (still) for a facing. */
export function showMotion(sprite: Phaser.GameObjects.Sprite, name: string, facing: Dir, moving: boolean): void {
  sprite.setFlipX(facing === 'left');
  if (moving) {
    sprite.anims.play(`${name}_walk_${facing === 'left' ? 'right' : facing}`, true);
  } else {
    sprite.anims.stop();
    sprite.setFlipX(false);
    sprite.setTexture(`${name}_idle_${facing}`);
  }
}
