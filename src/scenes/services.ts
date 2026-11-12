import Phaser from 'phaser';
import creaturesJson from '../data/creatures.json';
import itemsJson from '../data/items.json';
import shopsJson from '../data/shops.json';
import startJson from '../data/start.json';
import stringsEn from '../data/strings.en.json';
import stringsPt from '../data/strings.pt-BR.json';
import { systemClock } from '../logic/clock';
import { parseConfig } from '../logic/config';
import { Game } from '../logic/game';
import { createI18n, type I18n, type StringTable } from '../logic/i18n';
import { LocalStorageAdapter } from '../logic/localStorageAdapter';
import { MemoryStorage } from '../logic/memoryStorage';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '../logic/settings';
import type { Config } from '../logic/types';
import type { Storage } from '../logic/storage';

const SAVE_KEY = 'creatureGame.save';
const SETTINGS_KEY = 'creatureGame.settings';
const FALLBACK_LANGUAGE = 'pt-BR';
const TABLES: Record<string, StringTable> = { 'pt-BR': stringsPt, en: stringsEn };

/** Event emitted on the game's registry when settings change (scenes re-label themselves). */
export const SETTINGS_CHANGED = 'settings-changed';

/** Everything scenes share: config, save, settings and the translator. */
export interface Services {
  readonly config: Config;
  readonly languages: string[];
  settings: Settings;
  i18n: I18n;
  /** Loads the save (or a fresh game if there is none). */
  loadGame(): Game;
  /** True if a save exists. */
  hasSave(): boolean;
  /** Replaces the save with a fresh game and returns it. */
  newGame(): Game;
  /** Stores new settings, rebuilds the translator and notifies scenes. */
  updateSettings(next: Settings): void;
}

function browserStorage(key: string): Storage {
  try {
    const ls = window.localStorage;
    ls.getItem(key); // throws in some private modes
    return new LocalStorageAdapter(key, ls);
  } catch {
    return new MemoryStorage();
  }
}

/** Builds the shared services once at boot and stores them on the game registry. */
export function installServices(game: Phaser.Game): Services {
  const config = parseConfig({ species: creaturesJson, shops: shopsJson, items: itemsJson, start: startJson });
  const saveStorage = browserStorage(SAVE_KEY);
  const settingsStorage = browserStorage(SETTINGS_KEY);
  const languages = Object.keys(TABLES);
  const browserLang = navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  const settings = loadSettings(settingsStorage, defaultSettings(languages, browserLang), languages);

  const services: Services = {
    config,
    languages,
    settings,
    i18n: createI18n(TABLES, settings.language, FALLBACK_LANGUAGE),
    loadGame: () => Game.load(config, systemClock, saveStorage),
    hasSave: () => {
      try {
        const s = saveStorage.load();
        return s !== null && s !== '';
      } catch {
        return false;
      }
    },
    newGame: () => {
      const g = Game.create(config, systemClock, saveStorage);
      g.save();
      return g;
    },
    updateSettings(next) {
      services.settings = next;
      services.i18n = createI18n(TABLES, next.language, FALLBACK_LANGUAGE);
      saveSettings(settingsStorage, next);
      game.sound.volume = next.musicVolume;
      game.registry.events.emit(SETTINGS_CHANGED);
    },
  };
  game.sound.volume = settings.musicVolume;
  game.registry.set('services', services);
  return services;
}

/** The shared services, from any scene. */
export function services(scene: Phaser.Scene): Services {
  return scene.registry.get('services') as Services;
}
