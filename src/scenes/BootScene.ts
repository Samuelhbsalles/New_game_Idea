import Phaser from 'phaser';
import ui from '../data/ui.json';

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
  }

  create(): void {
    const next = this.firstScene();
    const font = `${ui.fontSize}px ${ui.fontFamily}`;
    document.fonts
      .load(font)
      .catch(() => undefined) // a missing font only costs looks; the fallback is in the family list
      .then(() => this.scene.start(next));
  }

  /** TitleScene, or in dev `?scene=home` / `?scene=town` jumps straight in for quick testing. */
  private firstScene(): string {
    const dev: Record<string, string> = { home: 'HomeScene', town: 'TownScene' };
    const want = import.meta.env.DEV ? new URLSearchParams(location.search).get('scene') : null;
    return (want && dev[want]) || 'TitleScene';
  }
}
