import { describe, expect, it } from 'vitest';
import en from '../../../src/data/strings.en.json';
import pt from '../../../src/data/strings.pt-BR.json';
import { createI18n, format, missingKeys } from '../../../src/logic/i18n';
import { MemoryStorage } from '../../../src/logic/memoryStorage';
import { cycleLanguage, defaultSettings, loadSettings, saveSettings, stepVolume } from '../../../src/logic/settings';

const LANGS = ['pt-BR', 'en'];

describe('i18n', () => {
  it('every Portuguese string has an English translation and vice versa', () => {
    expect(missingKeys(pt, en)).toEqual([]);
    expect(missingKeys(en, pt)).toEqual([]);
  });

  it('looks up dotted keys and fills placeholders', () => {
    const i18n = createI18n({ 'pt-BR': pt, en }, 'en', 'pt-BR');
    expect(i18n.t('pet.feed', { count: 2 })).toBe('Feed (2)');
    expect(createI18n({ 'pt-BR': pt, en }, 'pt-BR', 'pt-BR').t('pet.feed', { count: 2 })).toBe('Dar comida (2)');
  });

  it('falls back to the fallback language, then to the key', () => {
    const i18n = createI18n({ 'pt-BR': { a: 'só pt' }, en: {} }, 'en', 'pt-BR');
    expect(i18n.t('a')).toBe('só pt');
    expect(i18n.t('nope.missing')).toBe('nope.missing');
  });

  it('an unknown language uses the fallback', () => {
    expect(createI18n({ 'pt-BR': pt, en }, 'xx', 'pt-BR').language).toBe('pt-BR');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(format('{a} {b}', { a: 1 })).toBe('1 {b}');
  });
});

describe('settings', () => {
  const defaults = defaultSettings(LANGS, 'en');

  it('defaults to the preferred language when supported, else the first', () => {
    expect(defaults.language).toBe('en');
    expect(defaultSettings(LANGS, 'fr').language).toBe('pt-BR');
  });

  it('round-trips through storage', () => {
    const s = new MemoryStorage();
    saveSettings(s, { language: 'pt-BR', musicVolume: 0.3, sfxVolume: 0 });
    expect(loadSettings(s, defaults, LANGS)).toEqual({ language: 'pt-BR', musicVolume: 0.3, sfxVolume: 0 });
  });

  it('repairs bad fields one by one and never throws', () => {
    const s = new MemoryStorage();
    s.save(JSON.stringify({ language: 'klingon', musicVolume: 7, sfxVolume: 'loud' }));
    expect(loadSettings(s, defaults, LANGS)).toEqual({ language: 'en', musicVolume: 1, sfxVolume: defaults.sfxVolume });
    s.save('not json');
    expect(loadSettings(s, defaults, LANGS)).toEqual(defaults);
  });

  it('steps volume within 0..1 without float drift', () => {
    expect(stepVolume(0.7, 0.1)).toBe(0.8);
    expect(stepVolume(1, 0.1)).toBe(1);
    expect(stepVolume(0, -0.1)).toBe(0);
  });

  it('cycles languages both ways', () => {
    expect(cycleLanguage('pt-BR', LANGS)).toBe('en');
    expect(cycleLanguage('en', LANGS)).toBe('pt-BR');
    expect(cycleLanguage('pt-BR', LANGS, -1)).toBe('en');
  });
});
