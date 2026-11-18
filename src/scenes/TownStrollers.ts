import Phaser from 'phaser';
import { strollStep, type Rng, type StrollState } from '../logic/ambient';
import type { StrollerDef } from '../logic/town';
import { facingFor, showMotion, type Dir } from './sprites';

/** Sprite centre to feet (bottom of the 10px body at offset 34 in a 48px frame). */
const FEET_DY = 20;
/** A stroller waits instead of stepping into the player closer than this (px). */
const GIVE_WAY = 18;

interface Walker {
  def: StrollerDef;
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  state: StrollState;
  facing: Dir;
}

/**
 * Visitors who walk fixed looping routes (beachgoers on the shore). Each has an
 * immovable body so the player cannot walk through them, and gives way when the
 * player stands in the path instead of pushing.
 */
export class TownStrollers {
  private readonly walkers: Walker[];

  /** `animName` maps a sprites.json key to its loaded animation name. */
  constructor(
    scene: Phaser.Scene,
    defs: StrollerDef[],
    animName: (art: string) => string,
    private readonly rng: Rng,
  ) {
    this.walkers = defs.map((def, i) => {
      // Start each one somewhere along its route so they do not all set off together.
      const at = Math.floor(rng() * def.route.length);
      const p = def.route[at];
      const name = animName(def.art);
      const sprite = scene.physics.add.sprite(p.x, p.y - FEET_DY, `${name}_idle_down`);
      sprite.body.setSize(16, 10).setOffset(16, 34);
      sprite.body.setImmovable(true);
      sprite.body.pushable = false;
      sprite.setDepth(p.y).setName(`stroller${i}`);
      return { def: { ...def, art: name }, sprite, state: { pos: { ...p }, target: (at + 1) % def.route.length, waitMs: rng() * def.pauseMs[1] }, facing: 'down' as Dir };
    });
  }

  /** The bodies, for colliders. */
  get sprites(): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[] {
    return this.walkers.map((w) => w.sprite);
  }

  /** Advances every walker; `player` is the player's feet, to give way. */
  update(dtMs: number, player: { x: number; y: number }): void {
    for (const w of this.walkers) {
      const step = strollStep(w.state, w.def.route, w.def.speed, w.def.pauseMs, dtMs, this.rng);
      const blocked = (step.dx !== 0 || step.dy !== 0) && Math.hypot(step.state.pos.x - player.x, step.state.pos.y - player.y) < GIVE_WAY;
      if (!blocked) w.state = step.state;
      const moving = !blocked && (step.dx !== 0 || step.dy !== 0);
      if (moving) w.facing = facingFor(step.dx, step.dy, w.facing);
      w.sprite.body.reset(Math.round(w.state.pos.x), Math.round(w.state.pos.y) - FEET_DY);
      w.sprite.setDepth(w.state.pos.y);
      showMotion(w.sprite, w.def.art, w.facing, moving);
    }
  }
}
