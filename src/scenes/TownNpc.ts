import Phaser from 'phaser';
import ui from '../data/ui.json';
import { bump, calmDown, decideNext, findPath, type Mood, type NavGrid, type NpcActivity, type Pt } from '../logic/npcMind';
import { arrivalPoint, type NpcDef, type TownDef } from '../logic/town';
import { facingFor, showMotion, type Dir } from './sprites';
import { textStyle } from './ui/MenuPanel';

/** Arrival tolerance (px) for a waypoint. */
const ARRIVE_PX = 3;
/** Fade (ms) when a door is missing and the NPC just fades. */
const DOOR_FADE_MS = 300;
/** Door opening / closing time (ms). */
const DOOR_OPEN_MS = 180;
/** Time (ms) for each step through the doorway. */
const DOOR_STEP_MS = 650;
/** How long (ms) an angry NPC glares before storming off. */
const ANGRY_MS = 1800;
/** Minimum time (ms) between two counted bumps from the player. */
const BUMP_COOLDOWN_MS = 700;
/** Two NPCs closer than this (px) may stop to chat. */
const CHAT_RANGE = 56;
/** Chance an idling NPC starts chatting with one nearby. */
const CHAT_CHANCE = 0.6;
/** Angry NPCs storm off this much faster. */
const ANGRY_SPEED = 1.6;
/** If the next waypoint gets no closer for this long (ms), re-plan (something is in the way). */
const STUCK_MS = 2500;

/** Lines and bubbles, already translated (the scene passes them in). */
export interface NpcTexts {
  angry: string[];
  chat: string[];
  happy: string[];
}

/**
 * One townsperson living by its own decisions: walks a computed path to a
 * favourite building, goes in for a while, comes back out, strolls, idles,
 * chats with a neighbour, and gets angry when the player keeps bumping into
 * it. Has an immovable physics body so the player cannot walk through it.
 */
export class TownNpc {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  activity: NpcActivity = 'idle';
  private path: Pt[] = [];
  private timerMs = 0;
  private lastBuilding: string | null;
  private target: string | null = null;
  private facing: Dir = 'down';
  private mood: Mood = { annoyance: 0 };
  private lastBumpAt = -Infinity;
  private stuckMs = 0;
  private lastDist = Infinity;
  private speedMul = 1;
  partner: TownNpc | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: NpcDef,
    private readonly animName: string,
    private readonly town: TownDef,
    private readonly nav: NavGrid,
    private readonly texts: NpcTexts,
    private readonly rng: () => number,
  ) {
    // Starts just outside its home door, as if it had just stepped out.
    const start = arrivalPoint(town, def.home) ?? town.spawn;
    this.sprite = scene.physics.add.sprite(start.x, start.y, `${animName}_idle_down`);
    this.sprite.setOrigin(0.5, 0.92);
    this.sprite.body.setSize(16, 10).setOffset(16, 34);
    this.sprite.body.setImmovable(true);
    this.sprite.body.pushable = false;
    this.lastBuilding = def.home;
    this.startIdle(1000 + rng() * 3000);
  }

  /** Feet position (bottom of the physics body). */
  private feet(): Pt {
    return { x: this.sprite.x, y: this.sprite.body.bottom };
  }

  update(dtMs: number, others: TownNpc[]): void {
    this.mood = calmDown(this.mood, dtMs);
    this.sprite.setDepth(this.sprite.body.bottom);
    switch (this.activity) {
      case 'walking':
        return this.walk(dtMs);
      case 'inside':
        this.timerMs -= dtMs;
        if (this.timerMs <= 0) this.comeOut();
        return;
      case 'idle':
      case 'chatting':
      case 'angry':
        this.sprite.setVelocity(0, 0);
        showMotion(this.sprite, this.animName, this.facing, false);
        this.timerMs -= dtMs;
        if (this.activity === 'idle' && this.partner === null && this.timerMs > 800) this.maybeChat(others);
        if (this.timerMs <= 0) {
          if (this.activity === 'angry') {
            this.speedMul = ANGRY_SPEED;
            return this.strollAway();
          }
          this.partner = null;
          this.next();
        }
        return;
    }
  }

  // ---- decisions -------------------------------------------------------------------

  private next(): void {
    this.speedMul = 1;
    const plan = decideNext(this.def, this.lastBuilding, this.rng);
    if (plan.kind === 'idle') return this.startIdle(plan.ms);
    if (plan.kind === 'stroll') return this.strollAway();
    const door = arrivalPoint(this.town, plan.building);
    if (!door) return this.startIdle(2000);
    this.target = plan.building;
    this.goTo(door);
  }

  private startIdle(ms: number): void {
    this.activity = 'idle';
    this.timerMs = ms;
    this.target = null;
  }

  /** Walk to a random free spot a little way off. */
  private strollAway(): void {
    this.target = null;
    for (let i = 0; i < 12; i++) {
      const cx = Math.floor(this.rng() * this.nav.cols);
      const cy = Math.floor(this.rng() * this.nav.rows);
      if (!this.nav.free[cy][cx]) continue;
      const p = { x: cx * this.nav.cell + this.nav.cell / 2, y: cy * this.nav.cell + this.nav.cell / 2 };
      if (Math.hypot(p.x - this.sprite.x, p.y - this.sprite.y) < 400) return this.goTo(p);
    }
    this.startIdle(2000);
  }

  private goTo(p: Pt): void {
    this.path = findPath(this.nav, this.feet(), p);
    if (this.path.length === 0) return this.startIdle(1500);
    this.activity = 'walking';
    this.stuckMs = 0;
    this.lastDist = Infinity;
  }

  // ---- walking ----------------------------------------------------------------------

  private walk(dtMs: number): void {
    const wp = this.path[0];
    if (!wp) return this.arrived();
    const f = this.feet();
    const dx = wp.x - f.x;
    const dy = wp.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d <= ARRIVE_PX) {
      this.path.shift();
      this.lastDist = Infinity;
      this.stuckMs = 0;
      if (this.path.length === 0) return this.arrived();
      return;
    }
    // Something (usually the player) is in the way: wait a bit, then re-plan.
    if (d >= this.lastDist - 0.05) {
      this.stuckMs += dtMs;
      if (this.stuckMs > STUCK_MS) {
        const goal = this.path[this.path.length - 1];
        this.stuckMs = 0;
        return this.goTo(goal);
      }
    } else {
      this.stuckMs = 0;
    }
    this.lastDist = d;
    const v = this.def.speed * this.speedMul;
    this.sprite.setVelocity((dx / d) * v, (dy / d) * v);
    this.facing = facingFor(dx, dy, this.facing);
    showMotion(this.sprite, this.animName, this.facing, true);
  }

  private arrived(): void {
    this.sprite.setVelocity(0, 0);
    if (this.target) return this.goInside(this.target);
    this.startIdle(this.def.idleMs[0] + (this.def.idleMs[1] - this.def.idleMs[0]) * this.rng());
  }

  // ---- doors -------------------------------------------------------------------------

  /**
   * Walks in through the door: the door opens (a dark opening), the NPC steps
   * up into it and slips behind the facade (drawn under the building, so the
   * wall covers it), then the door closes.
   */
  private goInside(building: string): void {
    const b = this.town.buildings.find((x) => x.id === building);
    this.activity = 'inside';
    this.lastBuilding = building;
    this.timerMs = this.def.insideMs[0] + (this.def.insideMs[1] - this.def.insideMs[0]) * this.rng();
    this.sprite.setVelocity(0, 0);
    this.sprite.body.enable = false;
    this.facing = 'up';
    showMotion(this.sprite, this.animName, 'up', true);
    if (!b) {
      this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: DOOR_FADE_MS });
      return;
    }
    const doorX = b.x + b.doorDx;
    const opening = b.door ? this.openDoor(b.x + b.doorDx, b.y - b.door.dy, b.door, b.y) : null;
    // Step to the threshold in front of the open door, then through it behind the wall.
    this.scene.tweens.add({
      targets: this.sprite,
      x: doorX,
      y: b.y + 8,
      duration: DOOR_STEP_MS,
      onUpdate: () => this.sprite.setDepth(b.y + 2),
      onComplete: () => {
        this.sprite.setDepth(b.y - 1);
        this.scene.tweens.add({
          targets: this.sprite,
          y: b.y - 10,
          duration: DOOR_STEP_MS,
          onComplete: () => {
            this.sprite.setAlpha(0);
            showMotion(this.sprite, this.animName, 'up', false);
            if (opening) this.closeDoor(opening);
          },
        });
      },
    });
  }

  /** Comes back out: the door opens, the NPC steps down out of it and the door closes. */
  private comeOut(): void {
    const b = this.town.buildings.find((x) => x.id === (this.lastBuilding ?? this.def.home));
    const out = arrivalPoint(this.town, this.lastBuilding ?? this.def.home) ?? this.town.spawn;
    this.facing = 'down';
    this.activity = 'idle';
    this.timerMs = DOOR_STEP_MS * 2 + 800;
    const finish = () => {
      this.sprite.body.enable = true;
      this.sprite.body.reset(out.x, out.y);
      showMotion(this.sprite, this.animName, 'down', false);
      if (this.rng() < 0.4) this.say(this.pick(this.texts.happy), ui.ink);
    };
    if (!b) {
      this.sprite.setPosition(out.x, out.y).setAlpha(0);
      this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: DOOR_FADE_MS, onComplete: finish });
      return;
    }
    const opening = b.door ? this.openDoor(b.x + b.doorDx, b.y - b.door.dy, b.door, b.y) : null;
    this.sprite.setPosition(b.x + b.doorDx, b.y - 10).setAlpha(1).setDepth(b.y - 1);
    showMotion(this.sprite, this.animName, 'down', true);
    this.scene.time.delayedCall(DOOR_OPEN_MS, () => {
      this.scene.tweens.add({
        targets: this.sprite,
        y: out.y,
        duration: DOOR_STEP_MS * 2,
        onUpdate: () => {
          // In front of the building once the feet are past the door step.
          if (this.sprite.y > b.y) this.sprite.setDepth(this.sprite.y);
        },
        onComplete: () => {
          if (opening) this.closeDoor(opening);
          finish();
        },
      });
    });
  }

  /** A dark door opening that fades in over the door (above the wall, below the walker). */
  private openDoor(x: number, bottomY: number, size: { w: number; h: number }, depth: number): Phaser.GameObjects.Rectangle {
    const r = this.scene.add.rectangle(x, bottomY - size.h / 2, size.w, size.h, 0x1e1410, 0).setDepth(depth + 1);
    this.scene.tweens.add({ targets: r, fillAlpha: 0.9, duration: DOOR_OPEN_MS });
    return r;
  }

  private closeDoor(r: Phaser.GameObjects.Rectangle): void {
    this.scene.tweens.add({ targets: r, fillAlpha: 0, delay: 150, duration: DOOR_OPEN_MS, onComplete: () => r.destroy() });
  }

  // ---- social ------------------------------------------------------------------------

  private maybeChat(others: TownNpc[]): void {
    if (this.rng() > CHAT_CHANCE * 0.02) return; // checked every frame, so keep the per-frame chance tiny
    const mate = others.find((o) => o !== this && o.partner === null && (o.activity === 'idle' || o.activity === 'walking') && Math.hypot(o.sprite.x - this.sprite.x, o.sprite.y - this.sprite.y) < CHAT_RANGE);
    if (!mate) return;
    const ms = 3000 + this.rng() * 3000;
    for (const [a, b] of [
      [this, mate],
      [mate, this],
    ] as const) {
      a.partner = b;
      a.activity = 'chatting';
      a.timerMs = ms;
      a.path = [];
      a.sprite.setVelocity(0, 0);
      a.facing = facingFor(b.sprite.x - a.sprite.x, b.sprite.y - a.sprite.y, a.facing);
    }
    this.say(this.pick(this.texts.chat), ui.ink);
    this.scene.time.delayedCall(1300, () => mate.activity === 'chatting' && mate.say(mate.pick(mate.texts.chat), ui.ink));
  }

  /**
   * The player walked into this NPC. Counts at most once per cooldown; past
   * its temper the NPC turns to glare, complains and then storms off.
   */
  bumpedBy(player: Pt, now: number): void {
    if (this.activity === 'inside' || now - this.lastBumpAt < BUMP_COOLDOWN_MS) return;
    this.lastBumpAt = now;
    const r = bump(this.mood, this.def.temper);
    this.mood = r.mood;
    if (!r.angry) {
      if (this.mood.annoyance >= this.def.temper - 1) this.say('!', ui.heart);
      return;
    }
    if (this.partner) {
      this.partner.partner = null;
      this.partner.timerMs = 0;
      this.partner = null;
    }
    this.activity = 'angry';
    this.timerMs = ANGRY_MS;
    this.path = [];
    this.sprite.setVelocity(0, 0);
    this.facing = facingFor(player.x - this.sprite.x, player.y - this.sprite.y, this.facing);
    this.say(this.pick(this.texts.angry), '#c0392b');
    this.angryMark();
  }

  /** True while it is fuming (for the scene, e.g. tests or UI). */
  get isAngry(): boolean {
    return this.activity === 'angry';
  }

  private pick(list: string[]): string {
    return list[Math.min(list.length - 1, Math.floor(this.rng() * list.length))] ?? '';
  }

  private say(msg: string, color: string): void {
    if (!msg) return;
    const t = this.scene.add
      .text(this.sprite.x, this.sprite.y - 42, msg, { ...textStyle(true, 10), color, backgroundColor: ui.panel, padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1)
      .setDepth(50_000);
    this.scene.tweens.add({ targets: t, y: t.y - 6, alpha: 0, delay: 1400, duration: 500, onComplete: () => t.destroy() });
  }

  /** A little red anger mark that pulses over the head. */
  private angryMark(): void {
    const m = this.scene.add.text(this.sprite.x + 12, this.sprite.y - 40, '#', { ...textStyle(true, 12), color: '#e74c3c', stroke: ui.ink, strokeThickness: 2 }).setOrigin(0.5).setDepth(50_001);
    this.scene.tweens.add({ targets: m, scale: 1.4, yoyo: true, repeat: 3, duration: 180, onUpdate: () => m.setPosition(this.sprite.x + 12, this.sprite.y - 40), onComplete: () => m.destroy() });
  }
}
