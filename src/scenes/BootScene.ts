import itemsJson from '../data/items.json';
import Phaser from 'phaser';
import ui from '../data/ui.json';
import { joinWorld, SESSION_KEY } from '../net/world';
import { preloadCreatorLayers } from './avatar';
import { startMusic } from './music';
import { services } from './services';

/** Texture keys of the shared UI art loaded here. */
export const UI_TEX = { panel: 'ui_menu_panel', titleBg: 'ui_title_bg' } as const;

/**
 * Loads what every screen shares — the menu panel frame, the title backdrop and
 * the pixel font — then hands over to the first real scene. Text drawn before a
 * web font finishes loading would fall back to the system font, hence the wait.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image(UI_TEX.panel, 'assets/ui/menu_panel.png');
    this.load.image(UI_TEX.titleBg, 'assets/ui/title_bg.png');
    preloadCreatorLayers(this);
    // Item icons for the bag, shops and bait on the ground: assets/items/item_<id>.png.
    for (const it of itemsJson) this.load.image(`item_${it.id}`, `assets/items/item_${it.id}.png`);
  }

  create(): void {
    startMusic(this.game);
    const next = this.firstScene();
    const fonts = [`${ui.fontSize}px ${ui.fontFamily}`, `bold ${ui.fontSize}px ${ui.fontFamily}`];
    Promise.all(fonts.map((f) => document.fonts.load(f)))
      .catch(() => undefined) // a missing font only costs looks; the fallback is in the family list
      .then(() => this.devLogin(next))
      .then(() => this.scene.start(next));
  }

  /**
   * Dev shortcut scenes skip the title screen, and with it the login. Online,
   * log in straight away as `?name=` (or the last name used, or "Dev").
   */
  private async devLogin(next: string): Promise<void> {
    const s = services(this);
    if (next === 'TitleScene' || !s.online || this.registry.get(SESSION_KEY)) return;
    let name = new URLSearchParams(location.search).get('name');
    try {
      name ??= window.localStorage.getItem('creatureGame.lastName');
    } catch {
      /* no storage: use the default */
    }
    try {
      const session = await joinWorld(`dev:${name ?? 'Dev'}`, s.localSave);
      s.useSaveStorage(session.storage);
      this.registry.set(SESSION_KEY, session);
    } catch (e) {
      console.warn('[world] dev login failed; playing on the browser save', e);
    }
  }

  /** TitleScene, or in dev `?scene=home` / `?scene=town` jumps straight in for quick testing. */
  private firstScene(): string {
    const dev: Record<string, string> = { home: 'HomeScene', town: 'TownScene', creator: 'CreatorScene' };
    const want = import.meta.env.DEV ? new URLSearchParams(location.search).get('scene') : null;
    return (want && dev[want]) || 'TitleScene';
  }
}
