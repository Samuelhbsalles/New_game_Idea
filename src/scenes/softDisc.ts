import type Phaser from 'phaser';

/** Texture key of a white disc that fades to transparent at its edge. */
export const SOFT_DISC = 'soft_disc';

/** Creates the soft disc texture once (light glows, ground tints, magic motes). */
export function ensureSoftDisc(scene: Phaser.Scene): string {
  if (scene.textures.exists(SOFT_DISC)) return SOFT_DISC;
  const tex = scene.textures.createCanvas(SOFT_DISC, 128, 128);
  if (!tex) throw new Error('Could not create the soft disc texture');
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  tex.refresh();
  return SOFT_DISC;
}
