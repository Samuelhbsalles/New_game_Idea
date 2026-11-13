import Phaser from 'phaser';

import type { Dir } from '../logic/facing';

export type { Dir };

/** Directions that have their own walk art; 'left' mirrors 'right'. */
export const DRAWN_DIRS: Dir[] = ['down', 'up', 'right'];
export const ALL_DIRS: Dir[] = ['down', 'up', 'right', 'left'];

/**
 * One extra animation (e.g. rabbit eat/sleep/work). Drawn facing down only
 * unless `dirs` lists the drawn directions ('left' always mirrors 'right').
 */
export interface ExtraAnim {
  action: string;
  frames: number;
  fps: number;
  repeat: number;
  dirs?: Dir[];
}

/** Directions an extra is drawn in. */
function extraDirs(x: ExtraAnim): Dir[] {
  return x.dirs ?? ['down'];
}

/**
 * Animation key for an extra facing `facing`, or null if the art lacks it.
 * Down-only extras keep their plain key `<name>_<action>`.
 */
export function extraAnimKey(art: CharacterArt, action: string, facing: Dir): { key: string; flipX: boolean } | null {
  const x = art.extras.find((e) => e.action === action);
  if (!x) return null;
  if (!x.dirs) return facing === 'down' ? { key: `${art.name}_${action}`, flipX: false } : null;
  const d = facing === 'left' ? 'right' : facing;
  return x.dirs.includes(d) ? { key: `${art.name}_${action}_${d}`, flipX: facing === 'left' } : null;
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
    for (const d of extraDirs(x)) {
      for (let i = 1; i <= x.frames; i++) scene.load.image(`${art.name}_${x.action}_${d}_${pad(i)}`, `${base}_${x.action}_${d}_${pad(i)}.png`);
    }
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
    for (const d of extraDirs(x)) {
      scene.anims.create({
        key: x.dirs ? `${art.name}_${x.action}_${d}` : `${art.name}_${x.action}`,
        frames: Array.from({ length: x.frames }, (_, i) => ({ key: `${art.name}_${x.action}_${d}_${pad(i + 1)}` })),
        frameRate: x.fps,
        repeat: x.repeat,
      });
    }
  }
}

export { facingFor } from '../logic/facing';

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
