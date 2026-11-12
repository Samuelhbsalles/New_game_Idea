/** Body part a cosmetic fills. */
export type Slot = 'body' | 'hair' | 'top' | 'bottom';
export const SLOTS: Slot[] = ['body', 'hair', 'top', 'bottom'];

/** One cosmetic. `layer` is the art folder under assets/creator/, or null when the base body already shows it (plain tee, shorts). */
export interface Cosmetic {
  id: string;
  slot: Slot;
  layer: string | null;
  /** Owned from the start (shown in the creator); others are bought later. */
  starter: boolean;
  price: number;
}

/** The validated cosmetics catalog (src/data/cosmetics.json). */
export interface CosmeticCatalog {
  frameSize: number;
  /** The base bodies' mid skin tone; skin is recoloured relative to it. */
  baseSkin: string;
  skinTones: string[];
  hairColors: string[];
  clothColors: string[];
  items: Cosmetic[];
}

/** What the player looks like. Colours are indexes into the catalog's lists. */
export interface Appearance {
  body: string;
  skin: number;
  hair: string;
  hairColor: number;
  top: string;
  topColor: number;
  bottom: string;
  bottomColor: number;
}

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid cosmetics at ${path}: ${msg}`);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function colors(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.length === 0 || !v.every((c) => typeof c === 'string' && HEX.test(c))) fail(path, 'expected a non-empty list of #rrggbb');
  return v as string[];
}

/** Validates the catalog. Every slot needs at least one starter item. Throws naming the bad field. */
export function parseCosmetics(raw: unknown): CosmeticCatalog {
  if (typeof raw !== 'object' || raw === null) fail('cosmetics', 'expected object');
  const o = raw as Obj;
  if (typeof o.frameSize !== 'number' || o.frameSize < 1) fail('cosmetics.frameSize', 'expected positive number');
  if (typeof o.baseSkin !== 'string' || !HEX.test(o.baseSkin)) fail('cosmetics.baseSkin', 'expected #rrggbb');
  if (!Array.isArray(o.items)) fail('cosmetics.items', 'expected array');
  const seen = new Set<string>();
  const items = (o.items as unknown[]).map((e, i): Cosmetic => {
    const p = `cosmetics.items[${i}]`;
    const it = e as Obj;
    if (typeof it.id !== 'string' || it.id === '') fail(`${p}.id`, 'expected non-empty string');
    if (seen.has(it.id)) fail(p, `duplicate id "${it.id}"`);
    seen.add(it.id);
    if (!SLOTS.includes(it.slot as Slot)) fail(`${p}.slot`, `expected one of ${SLOTS.join(', ')}`);
    if (it.layer !== null && (typeof it.layer !== 'string' || it.layer === '')) fail(`${p}.layer`, 'expected string or null');
    if (it.slot === 'body' && it.layer === null) fail(`${p}.layer`, 'a body needs art');
    if (typeof it.starter !== 'boolean') fail(`${p}.starter`, 'expected boolean');
    if (typeof it.price !== 'number' || it.price < 0) fail(`${p}.price`, 'expected number >= 0');
    return { id: it.id, slot: it.slot as Slot, layer: it.layer as string | null, starter: it.starter, price: it.price };
  });
  for (const s of SLOTS) if (!items.some((it) => it.slot === s && it.starter)) fail('cosmetics.items', `no starter item for slot "${s}"`);
  return {
    frameSize: o.frameSize,
    baseSkin: o.baseSkin,
    skinTones: colors(o.skinTones, 'cosmetics.skinTones'),
    hairColors: colors(o.hairColors, 'cosmetics.hairColors'),
    clothColors: colors(o.clothColors, 'cosmetics.clothColors'),
    items,
  };
}

/** Items of a slot the player may wear: starters plus anything owned. */
export function choices(cat: CosmeticCatalog, slot: Slot, owned: string[] = []): Cosmetic[] {
  return cat.items.filter((it) => it.slot === slot && (it.starter || owned.includes(it.id)));
}

/** The first starter of each slot, first colours. */
export function defaultAppearance(cat: CosmeticCatalog): Appearance {
  const first = (s: Slot) => choices(cat, s)[0].id;
  return { body: first('body'), skin: 1 % cat.skinTones.length, hair: first('hair'), hairColor: 0, top: first('top'), topColor: 0, bottom: first('bottom'), bottomColor: 0 };
}

/**
 * True when every part exists in the right slot, is wearable (starter or
 * owned) and every colour index is in range. Used to vet saves.
 */
export function isValidAppearance(a: unknown, cat: CosmeticCatalog, owned: string[] = []): a is Appearance {
  if (typeof a !== 'object' || a === null) return false;
  const o = a as Obj;
  const part = (k: Slot) => typeof o[k] === 'string' && choices(cat, k, owned).some((it) => it.id === o[k]);
  const idx = (k: string, list: string[]) => Number.isInteger(o[k]) && (o[k] as number) >= 0 && (o[k] as number) < list.length;
  return SLOTS.every(part) && idx('skin', cat.skinTones) && idx('hairColor', cat.hairColors) && idx('topColor', cat.clothColors) && idx('bottomColor', cat.clothColors);
}

/** Steps a choice by ±1 with wrap-around. */
export function cycle<T>(list: T[], current: T, dir: 1 | -1): T {
  const i = Math.max(0, list.indexOf(current));
  return list[(i + dir + list.length) % list.length];
}

// ---- pixels ----------------------------------------------------------------

/** "#rrggbb" -> [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luma(r: number, g: number, b: number): number {
  return 0.3 * r + 0.59 * g + 0.11 * b;
}

/**
 * Skin-coloured: warm (r > g >= b) and light enough to be face or arms,
 * including the pale pink highlights and the reddish blush and lips;
 * excludes the near-neutral white tee (r ~ g ~ b) and the darker brown shoes.
 */
export function isSkin(r: number, g: number, b: number): boolean {
  return r >= 150 && r > g && g >= b && r - b >= 12 && r - b <= 140;
}

/** RGB 0-255 -> HSL with h in [0, 360), s and l in [0, 1]. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  return [h, s, l];
}

/** HSL (h in degrees, s and l in [0, 1]) -> RGB 0-255. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const ch = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [Math.round(ch(hk + 1 / 3) * 255), Math.round(ch(hk) * 255), Math.round(ch(hk - 1 / 3) * 255)];
}

/**
 * How strongly a pixel's distance from its layer's mid tone carries into the
 * new colour (1 = full contrast). Below 1 keeps highlights from blowing out
 * to white and shadows from crushing to black.
 */
export const SHADE_CONTRAST = 0.75;
/** Lightness never goes past these, so a tinted pixel always keeps some colour. */
const L_MIN = 0.06;
const L_MAX = 0.9;

/**
 * Recolours one pixel: takes the target's hue and saturation, and sets its
 * lightness to the target's lightness shifted by how much lighter or darker
 * the source pixel is than `midLuma` (0-255), scaled by SHADE_CONTRAST.
 * Saturation eases off towards very light or dark results, as real paint does.
 */
export function shadePixel(r: number, g: number, b: number, target: [number, number, number], midLuma: number): [number, number, number] {
  const [th, ts, tl] = rgbToHsl(...target);
  const delta = ((luma(r, g, b) - midLuma) / 255) * SHADE_CONTRAST;
  const l = Math.min(L_MAX, Math.max(L_MIN, tl + delta));
  const edge = Math.abs(l - 0.5) * 2; // 0 at mid lightness, 1 at the extremes
  const s = ts * (1 - 0.35 * edge * edge);
  return hslToRgb(th, s, l);
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** Median brightness of the opaque pixels of an RGBA buffer (the layer's "mid tone"). */
export function medianLuma(px: Uint8ClampedArray): number {
  const ls: number[] = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) ls.push(luma(px[i], px[i + 1], px[i + 2]));
  if (ls.length === 0) return 128;
  ls.sort((a, b) => a - b);
  return ls[Math.floor(ls.length / 2)];
}

/**
 * Builds one frame of the player: the body with its skin recoloured, then
 * each layer recoloured (shadePixel: the layer's mid tone becomes the chosen
 * colour, lighter and darker pixels keep softened shading).
 * All buffers are RGBA of the same size; returns a new buffer.
 */
export function composeFrame(
  body: Uint8ClampedArray,
  skin: { from: string; to: string },
  layers: { px: Uint8ClampedArray; color: string; mid: number }[],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(body);
  const skinTarget = hexToRgb(skin.to);
  const skinMid = luma(...hexToRgb(skin.from));
  const recolourSkin = skin.from.toLowerCase() !== skin.to.toLowerCase();
  for (let i = 0; i < out.length; i += 4) {
    if (recolourSkin && out[i + 3] && isSkin(out[i], out[i + 1], out[i + 2])) {
      [out[i], out[i + 1], out[i + 2]] = shadePixel(out[i], out[i + 1], out[i + 2], skinTarget, skinMid);
    }
  }
  for (const l of layers) {
    const target = hexToRgb(l.color);
    for (let i = 0; i < out.length; i += 4) {
      if (!l.px[i + 3]) continue;
      const [r, g, b] = shadePixel(l.px[i], l.px[i + 1], l.px[i + 2], target, l.mid);
      out[i] = clamp(r);
      out[i + 1] = clamp(g);
      out[i + 2] = clamp(b);
      out[i + 3] = l.px[i + 3];
    }
  }
  return out;
}
