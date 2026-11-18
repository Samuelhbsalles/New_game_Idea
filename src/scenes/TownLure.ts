import Phaser from 'phaser';
import { nextDelay } from '../logic/ambient';
import { acceptsBait, catchCreature, returnBait, takeBait, type CatchRules } from '../logic/catching';
import type { Game } from '../logic/game';
import { noticeRadius, spooked, temperOf, tensionFor, type LureRules, type Temper } from '../logic/lure';
import { startTension, stepTension, type TensionState, type TensionTuning } from '../logic/tension';
import { extraAnimKey, facingFor, showMotion, type CharacterArt } from './sprites';
import type { Bird, TownBirds } from './TownBirds';
import type { Critter, TownWild } from './TownWild';
import { TensionBar } from './ui/TensionBar';
import ui from '../data/ui.json';
import { textStyle } from './ui/MenuPanel';

/** Texture drawn at runtime for bait lying on the ground (a little pouch). */
const POUCH_TEX = 'bait_pouch';
const POUCH = ['..###..', '.#####.', '##ooo##', '#ooooo#', '#ooooo#', '.#####.'];
/** Item icons are 32px; on the ground they are drawn this much smaller. */
const GROUND_ICON_SCALE = 0.55;
/** Close enough (px) to the bait to count as "arrived" and start eating. */
const ARRIVE_PX = 4;

/** What the scene gives the catching controller. */
export interface LureHost {
  scene: Phaser.Scene;
  game: Game;
  rules: CatchRules;
  lure: LureRules;
  wild: TownWild;
  birds: TownBirds | null;
  art: (species: string) => CharacterArt | null;
  t: (k: string, v?: Record<string, string | number>) => string;
  /** A short floating message at a town point. */
  say: (msg: string, at: { x: number; y: number }) => void;
  /** Save and refresh the HUD after inventory / roster changes. */
  changed: () => void;
  /** A creature was just caught (before saving): the scene decides if it travels with you or goes home. */
  joined: (creatureId: string, species: string) => void;
  /** Play the "caught!" effect on a sprite and remove it. */
  caughtEffect: (sprite: Phaser.GameObjects.Sprite, species: string, firstOfSpecies: boolean) => void;
}

/** Where the player is this frame. */
export interface PlayerNow {
  x: number;
  /** Feet line (y of the body bottom). */
  feet: number;
  moving: boolean;
}

type Target = { kind: 'wild'; critter: Critter } | { kind: 'bird'; bird: Bird };

type LureState =
  | { kind: 'idle' }
  | { kind: 'waiting'; bait: Bait; leftMs: number }
  | { kind: 'approach'; bait: Bait; critter: Critter; temper: Temper; looking: boolean; timerMs: number }
  | { kind: 'eating'; bait: Bait; critter: Critter; leftMs: number }
  | { kind: 'minigame'; target: Target; species: string; tuning: TensionTuning; tension: TensionState; bar: TensionBar; homeX: number };

interface Bait {
  itemId: string;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
}

/**
 * Catching in town (user's design, 2026-11-15): put bait down, step back and
 * wait; a creature that likes it comes over, stopping to look around — move
 * while it looks (or stand too close) and it runs. While it eats, sneak up
 * and press E, then hold E to keep the marker in the green zone of the tension
 * bar until the meter fills. Losing costs the bait; a scared creature leaves
 * the bait where it was. (Pigeons in the plaza are lured the same way; the
 * flocks that fly in and out are only scenery.)
 */
export class TownLure {
  private state: LureState = { kind: 'idle' };
  private emote: Phaser.GameObjects.Text | null = null;

  constructor(private readonly host: LureHost) {
    const scene = host.scene;
    if (!scene.textures.exists(POUCH_TEX)) {
      const cv = scene.textures.createCanvas(POUCH_TEX, POUCH[0].length, POUCH.length);
      if (cv) {
        const ctx = cv.getContext();
        const fill: Record<string, string> = { '#': ui.ink, o: '#c8955a' };
        POUCH.forEach((row, y) => [...row].forEach((ch, x) => ch in fill && ((ctx.fillStyle = fill[ch]), ctx.fillRect(x, y, 1, 1))));
        cv.refresh();
      }
    }
  }

  /** True while the minigame runs: the scene keeps the player still and skips its other input. */
  get busy(): boolean {
    return this.state.kind === 'minigame';
  }

  /** True when bait is already on the ground (only one at a time). */
  get baitDown(): boolean {
    return this.state.kind !== 'idle' && this.state.kind !== 'minigame';
  }

  /** Puts one bait from the inventory down at a point. False if none is held. */
  placeBait(itemId: string, at: { x: number; y: number }): boolean {
    if (this.state.kind !== 'idle' || !takeBait(this.host.game, itemId)) return false;
    this.host.changed();
    // The bait's own icon on the ground (shrunk), or a plain pouch if it has none.
    const icon = `item_${itemId}`;
    const hasIcon = this.host.scene.textures.exists(icon);
    const sprite = this.host.scene.add
      .image(Math.round(at.x), Math.round(at.y), hasIcon ? icon : POUCH_TEX)
      .setOrigin(0.5, 1)
      .setScale(hasIcon ? GROUND_ICON_SCALE : 1)
      .setDepth(at.y - 1);
    this.state = { kind: 'waiting', bait: { itemId, x: at.x, y: at.y, sprite }, leftMs: this.host.lure.waitMs };
    this.host.say(this.host.t('catch.placed'), { x: at.x, y: at.y - 14 });
    return true;
  }

  /** Picks the bait back up if the player is next to it and nothing is eating it yet. */
  pickUpNear(p: PlayerNow): boolean {
    const s = this.state;
    if ((s.kind !== 'waiting' && s.kind !== 'approach') || Math.hypot(s.bait.x - p.x, s.bait.y - p.feet) > this.host.rules.catchRange) return false;
    if (s.kind === 'approach') this.giveUp(s.critter);
    this.removeBait(s.bait, true);
    this.host.say(this.host.t('catch.pickedUp'), { x: p.x, y: p.feet - 40 });
    return true;
  }

  /** Where to show the "E" bubble (over a creature busy eating, in reach), or null. */
  hintAt(p: PlayerNow): { x: number; y: number } | null {
    const s = this.state;
    if (s.kind !== 'eating') return null;
    const c = s.critter.sprite;
    return Math.hypot(c.x - p.x, c.y - p.feet) <= this.host.rules.catchRange ? { x: c.x, y: c.y - c.displayHeight - 6 } : null;
  }

  /** Per frame. `confirm` = E just pressed (handled here when it means something). Returns true if E was used. */
  update(dtMs: number, p: PlayerNow, confirm: boolean, holding: boolean): boolean {
    const s = this.state;
    switch (s.kind) {
      case 'idle':
        return false;
      case 'waiting':
        return this.updateWaiting(s, dtMs, p);
      case 'approach':
        this.updateApproach(s, dtMs, p);
        return false;
      case 'eating':
        return this.updateEating(s, dtMs, p, confirm);
      case 'minigame':
        this.updateMinigame(s, dtMs, p, holding);
        return true;
    }
  }

  // ---- phases ------------------------------------------------------------------------

  private updateWaiting(s: Extract<LureState, { kind: 'waiting' }>, dtMs: number, p: PlayerNow): boolean {
    s.leftMs -= dtMs;
    if (s.leftMs <= 0) {
      this.removeBait(s.bait, true);
      this.host.say(this.host.t('catch.nobodyCame'), { x: s.bait.x, y: s.bait.y - 14 });
      return false;
    }
    // The nearest free creature that likes this bait and is close enough notices it.
    const { game, rules, lure } = this.host;
    let best: Critter | null = null;
    let bestD = Infinity;
    for (const c of this.host.wild.free()) {
      const likes = acceptsBait(game, rules, c.species, s.bait.itemId);
      if (!likes) continue;
      const d = Math.hypot(c.sprite.x - s.bait.x, c.sprite.y - s.bait.y);
      if (d <= noticeRadius(lure, likes === 'specific') && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (!best) return false;
    best.lured = true;
    const temper = temperOf(lure, best.species);
    this.state = { kind: 'approach', bait: s.bait, critter: best, temper, looking: true, timerMs: nextDelay(temper.lookMs, Math.random) };
    this.showEmote(best.sprite, '?');
    void p;
    return false;
  }

  private updateApproach(s: Extract<LureState, { kind: 'approach' }>, dtMs: number, p: PlayerNow): void {
    const c = s.critter;
    const name = this.host.art(c.species)?.name;
    const distance = Math.hypot(c.sprite.x - p.x, c.sprite.y - p.feet);
    const scare = spooked(s.temper, { looking: s.looking, playerMoving: p.moving, playerDistance: distance });
    if (scare) {
      // It runs; the bait stays on the ground for another try.
      this.showEmote(c.sprite, '!');
      this.host.say(this.host.t(scare === 'moved' ? 'catch.scared' : 'catch.tooClose'), { x: c.sprite.x, y: c.sprite.y - 24 });
      this.host.wild.flee(c, { x: p.x, y: p.feet });
      this.clearEmote();
      this.state = { kind: 'waiting', bait: s.bait, leftMs: this.host.lure.waitMs };
      return;
    }
    s.timerMs -= dtMs;
    if (s.timerMs <= 0) {
      s.looking = !s.looking;
      s.timerMs = nextDelay(s.looking ? s.temper.lookMs : s.temper.lookEveryMs, Math.random);
      if (s.looking) this.showEmote(c.sprite, '?');
      else this.clearEmote();
    }
    if (s.looking) {
      // Stops and looks at the player.
      c.facing = facingFor(p.x - c.sprite.x, p.feet - c.sprite.y, c.facing);
      if (name) showMotion(c.sprite, name, c.facing, false);
      this.followEmote(c.sprite);
      return;
    }
    const dx = s.bait.x - c.sprite.x;
    const dy = s.bait.y - c.sprite.y;
    const d = Math.hypot(dx, dy);
    const step = (s.temper.speed * dtMs) / 1000;
    if (d <= Math.max(step, ARRIVE_PX)) {
      c.sprite.setPosition(s.bait.x, s.bait.y);
      this.clearEmote();
      this.startEating(s.bait, c);
      return;
    }
    c.sprite.setPosition(c.sprite.x + (dx / d) * step, c.sprite.y + (dy / d) * step);
    c.facing = facingFor(dx, dy, c.facing);
    if (name) showMotion(c.sprite, name, c.facing, true);
  }

  private startEating(bait: Bait, c: Critter): void {
    const art = this.host.art(c.species);
    const eat = art ? extraAnimKey(art, 'eat', 'down') : null;
    c.facing = 'down';
    if (eat && this.host.scene.anims.exists(eat.key)) c.sprite.play(eat.key, true);
    else if (art) showMotion(c.sprite, art.name, 'down', false);
    // The pouch shrinks as it is eaten.
    const ms = nextDelay(this.host.lure.eatMs, Math.random);
    this.host.scene.tweens.add({ targets: bait.sprite, scale: bait.sprite.scale * 0.4, duration: ms });
    this.state = { kind: 'eating', bait, critter: c, leftMs: ms };
  }

  private updateEating(s: Extract<LureState, { kind: 'eating' }>, dtMs: number, p: PlayerNow, confirm: boolean): boolean {
    s.leftMs -= dtMs;
    const c = s.critter;
    if (s.leftMs <= 0) {
      // Finished the bait and wandered off: the bait is gone.
      this.removeBait(s.bait, false);
      this.host.say(this.host.t('catch.ateAndLeft'), { x: c.sprite.x, y: c.sprite.y - 24 });
      this.host.wild.release(c);
      this.state = { kind: 'idle' };
      return false;
    }
    if (!confirm || !this.hintAt(p)) return false;
    // Caught it in the act: the bait is spent either way now.
    const specific = acceptsBait(this.host.game, this.host.rules, c.species, s.bait.itemId) === 'specific';
    this.removeBait(s.bait, false);
    this.startMinigame({ kind: 'wild', critter: c }, c.species, specific, c.sprite.x);
    return true;
  }

  private startMinigame(target: Target, species: string, specific: boolean, homeX: number): void {
    const rarity = this.host.game.config.species.find((x) => x.id === species)!.rarity;
    const tuning = tensionFor(this.host.lure, rarity, specific);
    const bar = new TensionBar(this.host.scene, this.host.t('catch.tensionTitle', { species: this.host.t(`species.${species}`) }), this.host.t('catch.hold'));
    const tension = startTension(tuning, Math.random);
    bar.draw(tension, tuning);
    this.state = { kind: 'minigame', target, species, tuning, tension, bar, homeX };
  }

  private updateMinigame(s: Extract<LureState, { kind: 'minigame' }>, dtMs: number, p: PlayerNow, holding: boolean): void {
    const r = stepTension(s.tension, s.tuning, holding, dtMs, Math.random);
    s.tension = r.state;
    s.bar.draw(s.tension, s.tuning);
    const sprite = s.target.kind === 'wild' ? s.target.critter.sprite : s.target.bird.sprite;
    // It struggles: a little shake while the round lasts.
    sprite.setX(s.homeX + (Math.random() < 0.5 ? -1 : 1));
    if (r.result === 'playing') return;
    s.bar.destroy();
    sprite.setX(s.homeX);
    this.state = { kind: 'idle' };
    const at = { x: sprite.x, y: sprite.y - sprite.displayHeight };
    if (r.result === 'caught') {
      const { creature, firstOfSpecies } = catchCreature(this.host.game, s.species);
      this.host.joined(creature.id, s.species);
      this.host.changed();
      if (s.target.kind === 'wild') this.host.wild.remove(s.target.critter);
      else this.host.birds?.take(s.target.bird);
      this.host.caughtEffect(sprite, s.species, firstOfSpecies);
      return;
    }
    this.host.changed();
    this.host.say(this.host.t('catch.escaped'), at);
    if (s.target.kind === 'wild') this.host.wild.flee(s.target.critter, { x: p.x, y: p.feet });
    else this.host.birds?.scare(s.target.bird, { x: p.x, y: p.feet });
  }

  // ---- helpers -----------------------------------------------------------------------

  /** A creature walking to the bait goes back to wandering (the bait was picked up). */
  private giveUp(c: Critter): void {
    this.clearEmote();
    this.host.wild.release(c);
  }

  /** Takes the pouch off the ground; `refund` puts the bait back in the inventory. */
  private removeBait(bait: Bait, refund: boolean): void {
    bait.sprite.destroy();
    if (refund) {
      returnBait(this.host.game, bait.itemId);
      this.host.changed();
    }
    if (this.state.kind !== 'minigame') this.state = { kind: 'idle' };
  }

  private showEmote(sprite: Phaser.GameObjects.Sprite, mark: string): void {
    this.clearEmote();
    this.emote = this.host.scene.add
      .text(sprite.x, sprite.y - sprite.displayHeight - 2, mark, { ...textStyle(true), backgroundColor: ui.panel, padding: { x: 2, y: 0 } })
      .setOrigin(0.5, 1)
      .setDepth(54_000);
  }

  private followEmote(sprite: Phaser.GameObjects.Sprite): void {
    this.emote?.setPosition(Math.round(sprite.x), Math.round(sprite.y - sprite.displayHeight - 2));
  }

  private clearEmote(): void {
    this.emote?.destroy();
    this.emote = null;
  }
}
