import Phaser from 'phaser';
import homeJson from '../data/home.json';
import catchingJson from '../data/catching.json';
import mapJson from '../data/map.json';
import spritesJson from '../data/sprites.json';
import townJson from '../data/town.json';
import ui from '../data/ui.json';
import type { Game } from '../logic/game';
import { parseMap, type TownMap } from '../logic/map';
import { followTarget } from '../logic/petBrain';
import { attemptCatch, baitCount, parseCatchRules, type CatchRules } from '../logic/catching';
import { buildNavGrid } from '../logic/npcMind';
import { arrivalPoint, doorAt, parseTown, tileFlip, townLayers, townSolids, type Building, type TownDef } from '../logic/town';
import { AVATAR_ART, buildAvatar, savedAppearance } from './avatar';
import { openOverlay } from './overlay';
import { TownBirds } from './TownBirds';
import { TownNpc } from './TownNpc';
import { TownWild, type Critter } from './TownWild';
import type { Bird } from './TownBirds';
import { services } from './services';
import { createCharacterAnims, facingFor, loadCharacter, showMotion, type CharacterArt, type Dir } from './sprites';
import { Keys } from './ui/input';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';

/** Every sprite set, plus the player's avatar (built at runtime, not loaded from files). */
const art: Record<string, CharacterArt> = { ...(spritesJson as Record<string, CharacterArt>), [AVATAR_ART.name]: AVATAR_ART };

/** How often (ms) a water sparkle appears somewhere in view. */
const SPARKLE_EVERY_MS = 180;
/** How often (ms) a chimney puffs. */
const SMOKE_EVERY_MS = 650;
/** Nav grid cell (px) for NPC paths, and how far paths keep from walls. */
const NAV_CELL = 16;
const NAV_PAD = 6;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Something the player can try to catch right now. */
type CatchTarget = { kind: 'bird'; bird: Bird; species: string; sprite: Phaser.GameObjects.Sprite } | { kind: 'wild'; critter: Critter; species: string; sprite: Phaser.GameObjects.Sprite };

/** How the town was entered. */
export interface TownData {
  /** 'home' = out of the front door; 'travel' = picked a place on the map. */
  from?: 'home' | 'travel';
  /** Place to arrive at (a building id or a named spot). */
  place?: string;
  /** True if the pet was following the player and comes along. */
  petFollowing?: boolean;
}

/**
 * The walkable starter town: Wang-tiled cobble, grass and harbour water,
 * buildings from the Game Bible as PixelLab sprites, props, and the player
 * walking with the camera following. Walking up into a door enters it (home
 * for now; the rest say "soon"). M opens the town map for fast travel; Esc
 * pauses. Layout: src/data/town.json.
 */
export class TownScene extends Phaser.Scene {
  private town!: TownDef;
  private map!: TownMap;
  /** Game state (named `world` because Phaser.Scene already owns `game`). */
  private world!: Game;
  private keys!: Keys;
  private mapKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private pet: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private petName = '';
  private petFacing: Dir = 'down';
  private facing: Dir = 'down';
  private panel: MenuPanel | null = null;
  private leaving = false;
  /** Door the player is standing in, so its "soon" toast shows once per visit. */
  private atDoor: string | null = null;
  private data_: TownData = {};

  constructor() {
    super('TownScene');
  }

  init(data: TownData): void {
    this.data_ = data ?? {};
    this.leaving = false;
    this.panel = null;
    this.atDoor = null;
    this.pet = null;
  }

  preload(): void {
    this.town = parseTown(townJson);
    this.map = parseMap(mapJson);
    const s = this.town.tileSize;
    for (const ts of [this.town.ground, this.town.water]) this.load.spritesheet(ts.key, `assets/town/${ts.key}.png`, { frameWidth: s, frameHeight: s });
    const sprites = new Set([...this.town.buildings.map((b) => b.sprite), ...this.town.props.map((p) => p.sprite)]);
    for (const k of sprites) this.load.image(k, `assets/town/${k}.png`);
    const anims = new Map<string, number>();
    for (const p of this.town.props) if (p.anim) anims.set(p.anim.key, p.anim.frames);
    for (const [key, n] of anims) for (let i = 1; i <= n; i++) this.load.image(`${key}_${pad2(i)}`, `assets/town/${key}_${pad2(i)}.png`);
    for (const a of Object.values(art)) if (a !== AVATAR_ART) loadCharacter(this, a);
    if (this.town.birds) TownBirds.preload(this);
  }

  create(): void {
    const t = (k: string, v?: Record<string, string | number>) => services(this).i18n.t(k, v);
    this.world = services(this).loadGame();
    this.rules = parseCatchRules(catchingJson, this.world.config.species.map((sp) => sp.id));
    const { tileSize: s, cols, rows } = this.town;
    const width = cols * s;
    const height = rows * s;

    // Ground, then water over it where water touches a tile.
    const layers = townLayers(this.town);
    for (const [ts, data, depth] of [
      [this.town.ground, layers.ground, -2000],
      [this.town.water, layers.water, -1900],
    ] as const) {
      const tm = this.make.tilemap({ data: data.map((r) => [...r]), tileWidth: s, tileHeight: s });
      const tiles = tm.addTilesetImage(ts.key, ts.key, s, s, 0, 0);
      if (!tiles) throw new Error(`Tileset "${ts.key}" failed to load`);
      const layer = tm.createLayer(0, tiles, 0, 0);
      layer?.setDepth(depth);
      // Mirror full grass tiles left/right so one repeated tile does not read as a grid.
      // (Not the path: mirrored cobbles form obvious kaleidoscope patterns.)
      const grass = ts.wangToFrame[15];
      layer?.forEachTile((tile) => {
        if (tile.index === grass) tile.flipX = tileFlip(tile.x, tile.y).flipX;
      });
    }

    // Buildings and props stand on their foot line and depth-sort by it.
    for (const b of this.town.buildings) this.add.image(b.x, b.y, b.sprite).setOrigin(0.5, 1).setDepth(b.y);
    for (const p of this.town.props) {
      if (p.anim) {
        const key = `${p.anim.key}_loop`;
        if (!this.anims.exists(key)) {
          this.anims.create({ key, frames: Array.from({ length: p.anim.frames }, (_, i) => ({ key: `${p.anim!.key}_${pad2(i + 1)}` })), frameRate: p.anim.fps, repeat: -1 });
        }
        this.add.sprite(p.x, p.y, `${p.anim.key}_01`).setOrigin(0.5, 1).setDepth(p.y).play(key);
      } else {
        this.add.image(p.x, p.y, p.sprite).setOrigin(0.5, 1).setDepth(p.y);
      }
      if (p.glow) this.addGlow(p.x, p.y + p.glow.dy, p.glow.r);
    }

    const solids = this.physics.add.staticGroup();
    for (const r of townSolids(this.town)) solids.add(this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h));
    this.physics.world.setBounds(0, 0, width, height);

    // Player, at the door they came out of or the place they travelled to.
    const pDef = homeJson.player;
    const pArt = art[pDef.character];
    if (pArt === AVATAR_ART) buildAvatar(this, savedAppearance(this.world));
    createCharacterAnims(this, pArt, pDef.walkFps);
    const start = (this.data_.place && arrivalPoint(this.town, this.data_.place)) || arrivalPoint(this.town, 'home') || this.town.spawn;
    this.player = this.physics.add.sprite(start.x, start.y, `${pArt.name}_idle_down`);
    this.player.body.setSize(16, 10).setOffset(16, 34);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, solids);

    // The pet comes along only if it was following.
    if (this.data_.petFollowing) {
      const id = homeJson.pet.creatureId;
      const species = this.world.state.creatures.find((c) => c.id === id)?.speciesId ?? this.world.state.creatures[0].speciesId;
      const petArt = art[species];
      createCharacterAnims(this, petArt, homeJson.pet.walkFps);
      this.petName = petArt.name;
      this.pet = this.physics.add.sprite(start.x - 20, start.y + 6, `${petArt.name}_idle_down`);
      this.pet.body.setSize(18, 12).setOffset(15, 30);
      this.pet.setCollideWorldBounds(true);
      this.physics.add.collider(this.pet, solids);
    }

    this.startAmbient(solids);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, width, height).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true);
    cam.setBackgroundColor(ui.ink);
    cam.fadeIn(300, 0, 0, 0);

    this.add
      .text(6, 6, t('town.hint'), { ...textStyle(false, 9), color: ui.panel, stroke: ui.ink, strokeThickness: 3 })
      .setScrollFactor(0)
      .setDepth(60_000);
    this.baitText = this.add.text(6, 18, '', { ...textStyle(true, 9), color: ui.panel, stroke: ui.ink, strokeThickness: 3 }).setScrollFactor(0).setDepth(60_000);
    this.refreshBait();

    // "Press E" bubble over whatever can be caught.
    const bubble = this.add.rectangle(0, 0, 14, 14, Phaser.Display.Color.HexStringToColor(ui.panel).color).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(ui.ink).color);
    const letter = this.add.text(0, 0, t('pet.hint'), textStyle(true)).setOrigin(0.5);
    this.catchHint = this.add.container(0, 0, [bubble, letter]).setDepth(45_000).setVisible(false);
    this.tweens.add({ targets: this.catchHint, scale: 1.15, yoyo: true, repeat: -1, duration: 450 });

    this.keys = new Keys(this);
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    this.mapKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    const onResume = () => this.keys.read();
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume));
  }

  update(_t: number, dt: number): void {
    if (this.leaving) return;
    this.moveNpcs(dt);
    const input = this.keys.read();
    if (this.panel) {
      this.player.setVelocity(0, 0);
      showMotion(this.player, art[homeJson.player.character].name, this.facing, false);
      if (this.panel.handle(input) === 'cancel') this.closePanel();
      return;
    }
    this.movePlayer();
    this.movePet();
    if (input.cancel) return this.openPause();
    if (Phaser.Input.Keyboard.JustDown(this.mapKey)) return this.openMap();
    const target = this.catchTarget();
    this.catchHint.setVisible(target !== null);
    if (target) this.catchHint.setPosition(target.sprite.x, target.sprite.y - target.sprite.displayHeight - 6);
    if (target && input.confirm) return this.tryCatch(target);
    this.checkDoor();
  }

  // ---- movement ------------------------------------------------------------------

  private movePlayer(): void {
    const { speed, character } = homeJson.player;
    let { x: vx, y: vy } = this.keys.axis();
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.player.setVelocity(vx * speed, vy * speed);
    this.facing = facingFor(vx, vy, this.facing);
    showMotion(this.player, art[character].name, this.facing, vx !== 0 || vy !== 0);
    this.player.setDepth(this.player.body.bottom);
  }

  private movePet(): void {
    const pet = this.pet;
    if (!pet) return;
    const goal = followTarget(pet, this.player, homeJson.pet.followDistance);
    if (!goal) {
      pet.setVelocity(0, 0);
      showMotion(pet, this.petName, this.petFacing, false);
    } else {
      this.physics.moveTo(pet, goal.x, goal.y, homeJson.pet.speed * 2);
      this.petFacing = facingFor(goal.x - pet.x, goal.y - pet.y, this.petFacing);
      showMotion(pet, this.petName, this.petFacing, true);
    }
    pet.setDepth(pet.body.bottom);
  }

  // ---- ambient life ----------------------------------------------------------------

  /**
   * NPCs (own decisions, solid to the player, get angry when bumped), bird
   * flocks landing in the plaza, chimney smoke and water sparkles.
   * Nothing here is saved.
   */
  private startAmbient(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const t = services(this).i18n;
    const lines = (prefix: string) => [1, 2, 3].map((n) => t.t(`npc.${prefix}${n}`));
    const texts = { angry: lines('angry'), chat: lines('chat'), happy: lines('happy') };
    const nav = buildNavGrid(this.town.cols * this.town.tileSize, this.town.rows * this.town.tileSize, NAV_CELL, townSolids(this.town), NAV_PAD);
    this.npcs = this.town.npcs.map((def) => {
      const a = art[def.art];
      createCharacterAnims(this, a, 6);
      const npc = new TownNpc(this, def, a.name, this.town, nav, texts, Math.random);
      this.physics.add.collider(npc.sprite, solids);
      // Solid to the player; walking into one counts as a bump.
      this.physics.add.collider(this.player, npc.sprite, () => {
        if (this.player.body.velocity.lengthSq() > 0) npc.bumpedBy({ x: this.player.x, y: this.player.y }, this.time.now);
      });
      if (this.pet) this.physics.add.collider(this.pet, npc.sprite);
      return npc;
    });

    if (this.town.birds) this.birds = new TownBirds(this, this.town.birds, Math.random);
    for (const r of this.rules.spawns) {
      const a = art[r.species];
      if (a) createCharacterAnims(this, a, 6);
    }
    this.wild = new TownWild(this, this.rules.spawns, (species) => art[species]?.name ?? null, nav, Math.random, (species) => (spritesJson as Record<string, { scale?: number }>)[species]?.scale ?? 1);

    for (const c of this.town.smoke) {
      this.time.addEvent({ delay: SMOKE_EVERY_MS, loop: true, callback: () => this.puff(c.x, c.y) });
    }
    this.time.addEvent({ delay: SPARKLE_EVERY_MS, loop: true, callback: () => this.sparkle() });
  }

  private npcs: TownNpc[] = [];
  private birds: TownBirds | null = null;
  private wild: TownWild | null = null;
  private rules!: CatchRules;
  private baitText!: Phaser.GameObjects.Text;
  private catchHint!: Phaser.GameObjects.Container;

  private moveNpcs(dt: number): void {
    for (const n of this.npcs) n.update(dt, this.npcs);
    this.wild?.update(dt);
    this.birds?.update(this.time.now, { x: this.player.x, y: this.player.body.bottom, moving: this.player.body.velocity.lengthSq() > 0 });
  }

  /** A grey puff rising and fading from a chimney. */
  private puff(x: number, y: number): void {
    const c = this.add.circle(x + Phaser.Math.Between(-2, 2), y, Phaser.Math.Between(3, 5), 0xd8d2cc, 0.75).setDepth(y + 2000);
    this.tweens.add({ targets: c, y: y - 34, x: c.x + Phaser.Math.Between(4, 12), scale: 2.2, alpha: 0, duration: 2600, ease: 'Sine.easeOut', onComplete: () => c.destroy() });
  }

  /** A warm halo that flickers gently (street lamps). */
  private addGlow(x: number, y: number, r: number): void {
    const glow = this.add.circle(x, y, r, 0xffd27a, 0.28).setDepth(y + 4000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.16, scale: 0.9, yoyo: true, repeat: -1, duration: Phaser.Math.Between(700, 1300), ease: 'Sine.easeInOut' });
  }

  /** A short glint on a water tile in view. */
  private sparkle(): void {
    const view = this.cameras.main.worldView;
    const s = this.town.tileSize;
    const x = view.x + Math.random() * view.width;
    const y = view.y + Math.random() * view.height;
    const tx = Math.floor(x / s);
    const ty = Math.floor(y / s);
    const row = this.town.corners[ty];
    const below = this.town.corners[ty + 1];
    if (!row || !below || [row[tx], row[tx + 1], below[tx], below[tx + 1]].some((c) => c !== 'w')) return;
    const g = this.add.rectangle(Math.round(x), Math.round(y), 2, 1, 0xffffff, 0).setDepth(-1800);
    this.tweens.add({ targets: g, alpha: 0.9, scaleX: 2, yoyo: true, duration: 450, onComplete: () => g.destroy() });
  }

  // ---- catching ----------------------------------------------------------------------

  /** The nearest grounded bird or wild creature within catch range of the player's feet. */
  private catchTarget(): CatchTarget | null {
    const feet = { x: this.player.x, y: this.player.body.bottom };
    const range = this.rules.catchRange;
    const bird = this.birds?.grounded(feet, range)[0];
    const critter = this.wild?.nearest(feet, range) ?? null;
    const dist = (o: { x: number; y: number }) => Math.hypot(o.x - feet.x, o.y - feet.y);
    if (bird && (!critter || dist(bird.sprite) <= dist(critter.sprite))) return { kind: 'bird', bird, species: 'pigeon', sprite: bird.sprite };
    if (critter) return { kind: 'wild', critter, species: critter.species, sprite: critter.sprite };
    return null;
  }

  /** One bait, one try (rules in src/logic/catching.ts). */
  private tryCatch(target: CatchTarget): void {
    const t = (k: string, v?: Record<string, string | number>) => services(this).i18n.t(k, v);
    const at = { x: target.sprite.x, y: target.sprite.y - target.sprite.displayHeight };
    const r = attemptCatch(this.world, this.rules, target.species, Math.random);
    if (!r.ok) {
      if (r.reason === 'no_bait') this.floatText(t('catch.noBait'), at);
      if (r.reason === 'escaped') {
        this.world.save();
        this.refreshBait();
        this.floatText(t('catch.escaped'), at);
        if (target.kind === 'bird') this.birds?.scare(target.bird, this.player);
      }
      return;
    }
    this.world.save();
    this.refreshBait();
    if (target.kind === 'bird') this.birds?.take(target.bird);
    else this.wild?.remove(target.critter);
    this.sparkleBurst(target.sprite.x, target.sprite.y - target.sprite.displayHeight / 2);
    this.tweens.add({ targets: target.sprite, scale: 0, alpha: 0, duration: 350, ease: 'Back.easeIn', onComplete: () => target.sprite.destroy() });
    this.floatText(t('catch.caught', { name: t(`species.${target.species}`) }), at);
    if (r.firstOfSpecies) this.time.delayedCall(700, () => this.floatText(t('catch.newAlbum'), { x: at.x, y: at.y - 12 }));
  }

  private refreshBait(): void {
    this.baitText.setText(services(this).i18n.t('town.bait', { count: baitCount(this.world, this.rules) }));
  }

  private floatText(msg: string, at: { x: number; y: number }): void {
    const txt = this.add
      .text(at.x, at.y, msg, { ...textStyle(true, 10), color: ui.ink, backgroundColor: ui.panel, padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1)
      .setDepth(55_000);
    this.tweens.add({ targets: txt, y: txt.y - 12, alpha: 0, delay: 1100, duration: 700, onComplete: () => txt.destroy() });
  }

  /** Little stars bursting out where something was caught. */
  private sparkleBurst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const star = this.add.rectangle(x, y, 3, 3, 0xffe58a).setDepth(55_000);
      this.tweens.add({ targets: star, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, alpha: 0, angle: 90, duration: 500, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    }
  }

  // ---- doors -----------------------------------------------------------------------

  /** Walking up into a door enters it; a closed one says "soon" once per visit. */
  private checkDoor(): void {
    const b = doorAt(this.town, { x: this.player.x, y: this.player.body.bottom });
    if (!b) {
      this.atDoor = null;
      return;
    }
    if (this.facing !== 'up' || this.player.body.velocity.y >= 0 || this.atDoor === b.id) return;
    this.atDoor = b.id;
    const place = this.map.places.find((p) => p.id === b.id);
    if (place?.status === 'open' && place.scene) return this.enter(place.scene);
    this.toast(b, services(this).i18n.t('map.soonLong', { place: services(this).i18n.t(`places.${b.id}`) }));
  }

  private enter(scene: string): void {
    this.leaving = true;
    this.player.setVelocity(0, 0);
    this.pet?.setVelocity(0, 0);
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(scene, { from: 'town', petFollowing: this.pet !== null }),
    );
  }

  private toast(b: Building, msg: string): void {
    const txt = this.add
      .text(b.x + b.doorDx, b.y - 8, msg, { ...textStyle(true, 10), color: ui.panel, stroke: ui.ink, strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(55_000);
    this.tweens.add({ targets: txt, y: txt.y - 10, alpha: 0, delay: 900, duration: 700, onComplete: () => txt.destroy() });
  }

  // ---- menus ---------------------------------------------------------------------

  /** The place nearest the player, so the map opens on where they are. */
  private nearestPlace(): string {
    let best = this.map.start;
    let bestD = Infinity;
    for (const p of this.map.places) {
      const a = arrivalPoint(this.town, p.id);
      if (!a) continue;
      const d = Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }

  private openMap(): void {
    this.player.setVelocity(0, 0);
    this.pet?.setVelocity(0, 0);
    showMotion(this.player, art[homeJson.player.character].name, this.facing, false);
    this.scene.pause();
    this.scene.launch('MapScene', { from: this.scene.key, at: this.nearestPlace(), petFollowing: this.pet !== null });
  }

  private openPause(): void {
    const t = services(this).i18n.t;
    const items: MenuItem[] = [
      { label: () => t('pause.resume'), onSelect: () => this.closePanel() },
      {
        label: () => t('pause.map'),
        onSelect: () => {
          this.closePanel();
          this.openMap();
        },
      },
      {
        label: () => t('pause.options'),
        onSelect: () => {
          this.closePanel();
          openOverlay(this, 'OptionsScene');
        },
      },
      {
        label: () => t('pause.toMenu'),
        onSelect: () => {
          this.world.save();
          this.scene.start('TitleScene');
        },
      },
    ];
    this.panel = new MenuPanel(this, { title: t('pause.title'), items, help: t('pause.help'), anchor: { kind: 'center' }, minWidth: 140 });
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }
}
