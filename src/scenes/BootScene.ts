import Phaser from 'phaser';
import ui from '../data/ui.json';
import { preloadCreatorLayers } from './avatar';

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
  }

  create(): void {
    const next = this.firstScene();
    const fonts = [`${ui.fontSize}px ${ui.fontFamily}`, `bold ${ui.fontSize}px ${ui.fontFamily}`];
    Promise.all(fonts.map((f) => document.fonts.load(f)))
      .catch(() => undefined) // a missing font only costs looks; the fallback is in the family list
      .then(() => this.scene.start(next));
  }

  /** TitleScene, or in dev `?scene=home` / `?scene=town` jumps straight in for quick testing. */
  private firstScene(): string {
    const dev: Record<string, string> = { home: 'HomeScene', town: 'TownScene', creator: 'CreatorScene' };
    const want = import.meta.env.DEV ? new URLSearchParams(location.search).get('scene') : null;
    return (want && dev[want]) || 'TitleScene';
  }
}
