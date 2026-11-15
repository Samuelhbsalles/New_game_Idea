import type Phaser from 'phaser';
import music from '../data/music.json';
import { services, SETTINGS_CHANGED } from './services';

/**
 * Background music. Streams through a plain <audio> element, so a few MB of
 * music never hold up the boot screen, and keeps playing across scene changes.
 * Browsers block sound until the player interacts, so playback starts on the
 * first key press or click. A missing file is only a warning: the game runs silent.
 */
export function startMusic(game: Phaser.Game): void {
  const track = music.main;
  const audio = new Audio(track.file);
  audio.loop = track.loop;
  audio.preload = 'auto';
  const apply = () => {
    const s = game.registry.get('services') as ReturnType<typeof services> | undefined;
    audio.volume = Math.max(0, Math.min(1, (s?.settings.musicVolume ?? 0.7) * track.gain));
  };
  apply();
  game.registry.events.on(SETTINGS_CHANGED, apply);
  audio.addEventListener('error', () => console.warn(`[music] could not load ${track.file}`), { once: true });

  const begin = () => {
    audio.play().then(
      () => {
        window.removeEventListener('pointerdown', begin);
        window.removeEventListener('keydown', begin);
      },
      () => undefined, // still blocked: try again on the next interaction
    );
  };
  window.addEventListener('pointerdown', begin);
  window.addEventListener('keydown', begin);
  begin(); // works straight away when the browser already allows sound

  // Pause while the tab is hidden, resume when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else if (audio.currentTime > 0) void audio.play().catch(() => undefined);
  });
}
