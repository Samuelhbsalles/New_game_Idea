import Phaser from 'phaser';
import type { Game } from '../logic/game';
import { HudChip } from './ui/HudChip';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Adds the "Day N · HH:MM" game clock to the top-right of the screen and keeps
 * it ticking. Time comes from the save's world start (src/logic/gameTime.ts).
 */
export function addClock(scene: Phaser.Scene, world: Game, t: (k: string, v?: Record<string, string | number>) => string): HudChip {
  const chip = new HudChip(scene, scene.cameras.main.width - 4, 4, { anchor: 'topRight', fixed: true, depth: 60_000 });
  const refresh = () => {
    const g = world.gameTime();
    chip.setText(t('clock.time', { day: g.day, hh: pad2(g.hour), mm: pad2(g.minute) }));
  };
  refresh();
  scene.time.addEvent({ delay: 500, loop: true, callback: refresh });
  return chip;
}
