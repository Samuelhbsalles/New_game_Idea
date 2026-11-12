import type { Storage } from './storage';

/** Player preferences, kept apart from the game save so a new game keeps them. */
export interface Settings {
  language: string;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
}

/** Defaults when nothing is saved, or a saved value is bad. */
export function defaultSettings(languages: string[], preferred: string): Settings {
  return { language: languages.includes(preferred) ? preferred : languages[0], musicVolume: 0.7, sfxVolume: 0.8 };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Reads settings from storage. Each bad or missing field falls back to its
 * default on its own; never throws.
 */
export function loadSettings(storage: Storage, defaults: Settings, languages: string[]): Settings {
  let raw: unknown = null;
  try {
    const s = storage.load();
    raw = s === null ? null : JSON.parse(s);
  } catch {
    raw = null;
  }
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const vol = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : d);
  return {
    language: typeof o.language === 'string' && languages.includes(o.language) ? o.language : defaults.language,
    musicVolume: vol(o.musicVolume, defaults.musicVolume),
    sfxVolume: vol(o.sfxVolume, defaults.sfxVolume),
  };
}

/** Writes settings through the storage. */
export function saveSettings(storage: Storage, settings: Settings): void {
  storage.save(JSON.stringify(settings));
}

/** Steps a volume by `delta`, clamped to 0..1 and rounded to 1 decimal. */
export function stepVolume(v: number, delta: number): number {
  return Math.round(clamp01(v + delta) * 10) / 10;
}

/** Next language in the list, wrapping around. */
export function cycleLanguage(current: string, languages: string[], dir: 1 | -1 = 1): string {
  const i = languages.indexOf(current);
  return languages[(((i < 0 ? 0 : i) + dir) % languages.length + languages.length) % languages.length];
}
