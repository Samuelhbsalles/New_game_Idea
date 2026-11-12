import Phaser from 'phaser';
import cosmeticsJson from '../data/cosmetics.json';
import { composeFrame, defaultAppearance, isValidAppearance, medianLuma, parseCosmetics, type Appearance, type CosmeticCatalog } from '../logic/appearance';
import type { Game } from '../logic/game';
import type { CharacterArt } from './sprites';

/** The player's sprite set, built at runtime from the creator layers (no files of its own). */
export const AVATAR_ART: CharacterArt = { name: 'avatar', folder: '', walkFrames: 4, extras: [] };

/** The parsed cosmetics catalog, shared by every scene. */
export const COSMETICS: CosmeticCatalog = parseCosmetics(cosmeticsJson);

type Frame = { action: 'idle' | 'walk'; dir: string; n: number };

/** Every frame a layer has: 4 idle facings, then a 4-frame walk for down/up/right (left is mirrored). */
const FRAMES: Frame[] = [
  ...['down', 'up', 'right', 'left'].map((dir) => ({ action: 'idle' as const, dir, n: 1 })),
  ...['down', 'up', 'right'].flatMap((dir) => [1, 2, 3, 4].map((n) => ({ action: 'walk' as const, dir, n }))),
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const fileName = (layer: string, f: Frame) => `${layer}_${f.action}_${f.dir}_${pad2(f.n)}`;
const layerKey = (layer: string, f: Frame) => `cr_${fileName(layer, f)}`;

/** Avatar texture key for a frame, matching the loader convention (idle frames have no index). */
const avatarKey = (f: Frame) => (f.action === 'idle' ? `${AVATAR_ART.name}_idle_${f.dir}` : `${AVATAR_ART.name}_walk_${f.dir}_${pad2(f.n)}`);

/** Queues every creator layer frame (assets/creator/<layer>/...). Call from a preload. */
export function preloadCreatorLayers(scene: Phaser.Scene): void {
  const layers = new Set(COSMETICS.items.map((it) => it.layer).filter((l): l is string => l !== null));
  for (const layer of layers) for (const f of FRAMES) scene.load.image(layerKey(layer, f), `assets/creator/${layer}/${fileName(layer, f)}.png`);
}

/** RGBA pixels of a loaded texture. */
function pixels(scene: Phaser.Scene, key: string, size: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(scene.textures.get(key).getSourceImage() as CanvasImageSource, 0, 0);
  return ctx.getImageData(0, 0, size, size).data;
}

/**
 * (Re)builds the avatar textures and walk animations for an appearance:
 * body with recoloured skin, then bottom, top and hair tinted to their
 * colours. Safe to call again whenever the appearance changes.
 */
export function buildAvatar(scene: Phaser.Scene, a: Appearance): void {
  const cat = COSMETICS;
  const size = cat.frameSize;
  const item = (id: string) => cat.items.find((it) => it.id === id);
  const parts: { layer: string; color: string }[] = [];
  const add = (id: string, color: string) => {
    const layer = item(id)?.layer;
    if (layer) parts.push({ layer, color });
  };
  add(a.bottom, cat.clothColors[a.bottomColor]);
  add(a.top, cat.clothColors[a.topColor]);
  add(a.hair, cat.hairColors[a.hairColor]);
  const bodyLayer = item(a.body)?.layer ?? 'body_m';
  // Each layer's mid tone, measured once on its front idle frame so every frame tints alike.
  const mids = new Map(parts.map((p) => [p.layer, medianLuma(pixels(scene, layerKey(p.layer, FRAMES[0]), size))]));

  let created = false;
  for (const f of FRAMES) {
    const out = composeFrame(
      pixels(scene, layerKey(bodyLayer, f), size),
      { from: cat.baseSkin, to: cat.skinTones[a.skin] },
      parts.map((p) => ({ px: pixels(scene, layerKey(p.layer, f), size), color: p.color, mid: mids.get(p.layer) ?? 128 })),
    );
    // Redraw an existing canvas texture in place: sprites and animations showing it
    // keep a reference to the same texture object, so removing it would leave them
    // pointing at nothing (and stop the renderer).
    const key = avatarKey(f);
    const existing = scene.textures.exists(key) ? scene.textures.get(key) : null;
    let tex = existing instanceof Phaser.Textures.CanvasTexture ? existing : null;
    if (!tex) {
      if (existing) scene.textures.remove(key);
      tex = scene.textures.createCanvas(key, size, size);
      if (!tex) throw new Error(`Could not create texture ${key}`);
      created = true;
    }
    tex.context.putImageData(new ImageData(new Uint8ClampedArray(out), size, size), 0, 0);
    tex.refresh();
  }
  // Only freshly created textures invalidate existing walk animations.
  if (created) {
    for (const dir of ['down', 'up', 'right']) {
      const key = `${AVATAR_ART.name}_walk_${dir}`;
      if (scene.anims.exists(key)) scene.anims.remove(key);
    }
  }
}

/** The saved appearance if it is still valid, else the default look. */
export function savedAppearance(world: Game): Appearance {
  const a = world.state.appearance;
  return isValidAppearance(a, COSMETICS, world.state.cosmetics ?? []) ? a : defaultAppearance(COSMETICS);
}
