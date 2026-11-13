/** An RGB colour. */
export type Rgb = [number, number, number];

/** '#rrggbb' (or 'rrggbb') to RGB; null for anything else (e.g. 'transparent'). */
export function hexToRgb(hex: string | null | undefined): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Makes anti-aliased text pixel-crisp, in place. The browser always smooths
 * canvas text; once the 480x270 canvas is scaled up, those half-pixels read
 * as blurry, merged digits. Every pixel becomes fully opaque or fully clear
 * (cut at half alpha, unless the text has an opaque background) and takes the
 * nearest of the text's own colours (fill, stroke, background).
 * @param data RGBA bytes (ImageData.data)
 * @param palette the text's colours; the first is used when nothing is nearer
 * @param opaqueBackground true when the text has a background colour
 */
export function snapPixels(data: Uint8ClampedArray, palette: Rgb[], opaqueBackground: boolean): void {
  if (palette.length === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    if (!opaqueBackground && data[i + 3] < 128) {
      data[i + 3] = 0;
      continue;
    }
    let best = palette[0];
    let bestD = Infinity;
    for (const p of palette) {
      const d = (data[i] - p[0]) ** 2 + (data[i + 1] - p[1]) ** 2 + (data[i + 2] - p[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    data[i] = best[0];
    data[i + 1] = best[1];
    data[i + 2] = best[2];
    data[i + 3] = 255;
  }
}

/**
 * The size to draw a pixel font at: its native size, or twice it for big
 * titles. Any other size lands glyph pixels between screen pixels.
 */
export function nativeFontSize(requested: number, native: number): number {
  return requested >= native * 1.5 ? native * 2 : native;
}
