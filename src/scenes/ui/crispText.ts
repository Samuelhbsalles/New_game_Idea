import Phaser from 'phaser';
import { hexToRgb, snapPixels } from './snapPixels';

let installed = false;

/**
 * Makes every Phaser Text pixel-crisp: after Phaser draws a text's canvas,
 * its pixels are snapped (see snapPixels) and the texture is uploaded again.
 * Call once before the game starts. Texts only redraw when they change, so
 * the extra pass costs nothing per frame.
 */
export function installCrispText(): void {
  if (installed) return;
  installed = true;
  const proto = Phaser.GameObjects.Text.prototype as unknown as {
    updateText: (this: Phaser.GameObjects.Text) => Phaser.GameObjects.Text;
  };
  const original = proto.updateText;
  proto.updateText = function (this: Phaser.GameObjects.Text) {
    const result = original.call(this);
    const canvas = this.canvas;
    const ctx = this.context;
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return result;
    const style = this.style;
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    const palette = [hexToRgb(str(style.color)), hexToRgb(str(style.stroke)), hexToRgb(str(style.backgroundColor))].filter((c) => c !== null);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    snapPixels(img.data, palette, hexToRgb(str(style.backgroundColor)) !== null);
    ctx.putImageData(img, 0, 0);
    const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer | Phaser.Renderer.Canvas.CanvasRenderer;
    if (renderer && 'gl' in renderer && renderer.gl) {
      this.frame.source.glTexture = renderer.canvasToTexture(canvas, this.frame.source.glTexture ?? undefined, true);
    }
    return result;
  };
}
