import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import ui from '../data/ui.json';
import type { Dir } from '../logic/facing';
import { AVATAR_ART, buildAvatar, lookFromJson } from './avatar';
import { createCharacterAnims, showMotion, type CharacterArt } from './sprites';
import { HudChip } from './ui/HudChip';

/** How often (ms) our own position may be sent, at most. */
const SEND_EVERY_MS = 100;
/** Share of the gap to the latest server position closed each frame (smooths 20 Hz updates). */
const FOLLOW = 0.3;
/** Beyond this distance (px) a remote player snaps instead of gliding (e.g. after fast travel). */
const SNAP_PX = 96;

/** One player as the server syncs them (server/src/rooms/presence.ts). */
interface PlayerView {
  name: string;
  place: string;
  x: number;
  y: number;
  face: string;
  moving: boolean;
  look: string;
}

interface Shown {
  sprite: Phaser.GameObjects.Sprite;
  label: HudChip;
  artName: string;
  look: string;
}

/** Small stable hash, so players with the same look share one set of textures. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Other players in the same place as us, drawn from the world room's synced
 * state with their own looks and name tags, gliding towards their latest
 * position; and our own position sent to the server (only when it changed,
 * at most every SEND_EVERY_MS). Purely visual: no collisions.
 */
export class RemotePlayers {
  private readonly shown = new Map<string, Shown>();
  private lastSent = '';
  private lastSentAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly room: Room,
    /** Where this scene is: 'town' or 'interior:<building>'. */
    private readonly place: string,
    myLook: string,
    private readonly walkFps: number,
  ) {
    room.send('look', myLook);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Per frame: send our position, then add, move and remove the others. */
  update(me: { x: number; y: number; facing: Dir; moving: boolean }, now: number): void {
    this.sendMove(me, now);
    const players = (this.room.state as { players?: Map<string, PlayerView> }).players;
    const here = new Set<string>();
    players?.forEach((p, id) => {
      if (id === this.room.sessionId || p.place !== this.place) return;
      here.add(id);
      const s = this.shown.get(id) ?? this.add(id, p);
      if (s.look !== p.look) this.restyle(s, p.look);
      const dx = p.x - s.sprite.x;
      const dy = p.y - s.sprite.y;
      if (Math.hypot(dx, dy) > SNAP_PX) s.sprite.setPosition(p.x, p.y);
      else s.sprite.setPosition(s.sprite.x + dx * FOLLOW, s.sprite.y + dy * FOLLOW);
      showMotion(s.sprite, s.artName, p.face as Dir, p.moving);
      s.sprite.setDepth(s.sprite.y + s.sprite.height / 2);
      s.label.setText(p.name).setPosition(s.sprite.x, s.sprite.y - s.sprite.height / 2 - 2);
    });
    for (const [id, s] of this.shown) {
      if (here.has(id)) continue;
      s.sprite.destroy();
      s.label.destroy();
      this.shown.delete(id);
    }
  }

  private sendMove(me: { x: number; y: number; facing: Dir; moving: boolean }, now: number): void {
    const msg = { place: this.place, x: Math.round(me.x), y: Math.round(me.y), face: me.facing, moving: me.moving };
    const key = JSON.stringify(msg);
    if (key === this.lastSent || now - this.lastSentAt < SEND_EVERY_MS) return;
    this.room.send('move', msg);
    this.lastSent = key;
    this.lastSentAt = now;
  }

  /** The sprite-set for a look, built once and shared by everyone who looks the same. */
  private artFor(look: string): CharacterArt {
    const art: CharacterArt = { ...AVATAR_ART, name: `pl_${hash(look)}` };
    if (!this.scene.textures.exists(`${art.name}_idle_down`)) buildAvatar(this.scene, lookFromJson(look), art.name);
    if (!this.scene.anims.exists(`${art.name}_walk_down`)) createCharacterAnims(this.scene, art, this.walkFps);
    return art;
  }

  private add(id: string, p: PlayerView): Shown {
    const art = this.artFor(p.look);
    const sprite = this.scene.add.sprite(p.x, p.y, `${art.name}_idle_down`);
    const label = new HudChip(this.scene, p.x, p.y, { anchor: 'bottomCenter', fixed: false, depth: 44_500, color: ui.panel });
    const s: Shown = { sprite, label, artName: art.name, look: p.look };
    this.shown.set(id, s);
    return s;
  }

  private restyle(s: Shown, look: string): void {
    s.artName = this.artFor(look).name;
    s.look = look;
  }

  destroy(): void {
    for (const s of this.shown.values()) {
      s.sprite.destroy();
      s.label.destroy();
    }
    this.shown.clear();
  }
}
