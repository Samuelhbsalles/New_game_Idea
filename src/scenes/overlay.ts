import Phaser from 'phaser';

/**
 * Opens an overlay scene (options, credits) on top of `from`, pausing `from`
 * until the overlay calls closeOverlay.
 */
export function openOverlay(from: Phaser.Scene, key: string): void {
  from.scene.pause();
  from.scene.launch(key, { from: from.scene.key });
}

/** Closes an overlay and resumes the scene that opened it. */
export function closeOverlay(overlay: Phaser.Scene, from: string): void {
  overlay.scene.stop();
  overlay.scene.resume(from);
}
