import Phaser from 'phaser';

/** One frame's menu input: each flag is true only on the frame the key went down. */
export interface MenuInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  cancel: boolean;
}

/** Keyboard keys used by every scene: arrows to move/navigate, E/Space/Enter to confirm, Esc to cancel. */
export class Keys {
  readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly e: Phaser.Input.Keyboard.Key;
  private readonly enter: Phaser.Input.Keyboard.Key;
  private readonly esc: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    this.cursors = kb.createCursorKeys();
    this.e = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.enter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.esc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  /** Reads this frame's presses. Call once per update and pass the result around. */
  read(): MenuInput {
    const jd = Phaser.Input.Keyboard.JustDown;
    const c = this.cursors;
    return {
      up: jd(c.up),
      down: jd(c.down),
      left: jd(c.left),
      right: jd(c.right),
      confirm: jd(this.e) || jd(c.space) || jd(this.enter),
      cancel: jd(this.esc),
    };
  }

  /** Held direction as a unit-ish vector, for walking. */
  axis(): { x: number; y: number } {
    const c = this.cursors;
    return { x: (c.right.isDown ? 1 : 0) - (c.left.isDown ? 1 : 0), y: (c.down.isDown ? 1 : 0) - (c.up.isDown ? 1 : 0) };
  }
}
