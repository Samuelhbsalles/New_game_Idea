import Phaser from 'phaser';
import homeJson from '../data/home.json';
import interiorsJson from '../data/interiors.json';
import spritesJson from '../data/sprites.json';
import ui from '../data/ui.json';
import type { Game } from '../logic/game';
import { formatCountdown, parseInteriors, stationNear, workPoint, WORK_REACH, type InteriorDef, type Station } from '../logic/interior';
import { followTarget } from '../logic/petBrain';
import { exitAt, wallRects } from '../logic/room';
import { shiftOutput } from '../logic/work';
import { AVATAR_ART, buildAvatar, savedAppearance } from './avatar';
import { SESSION_KEY, type WorldSession } from '../net/world';
import { addBackdrop, preloadBackdrop } from './backdrop';
import { openOverlay } from './overlay';
import { RemotePlayers } from './RemotePlayers';
import { services } from './services';
import { BIRD_TEX } from './TownBirds';
import { createCharacterAnims, extraAnimKey, facingFor, loadCharacter, showMotion, type CharacterArt, type Dir } from './sprites';
import { Keys } from './ui/input';
import { HudChip } from './ui/HudChip';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';
import { addClock } from './clockHud';

/** Every sprite set, plus the player's avatar (built at runtime, not loaded from files). */
const art: Record<string, CharacterArt> = { ...(spritesJson as Record<string, CharacterArt>), [AVATAR_ART.name]: AVATAR_ART };

/** Scene opened by each exit's `to`. */
const EXIT_SCENES: Record<string, string> = { town: 'TownScene' };

/** How the inside was entered. */
export interface InteriorData {
  /** Building id: a key of interiors.json. */
  place: string;
  /** True if the pet was following the player and comes along. */
  petFollowing?: boolean;
}

/** A creature standing at its station, with its countdown label. */
interface Worker {
  slot: number;
  sprite: Phaser.GameObjects.Sprite | null;
  label: HudChip;
  /** The working motion (art without a work animation); stopped once the shift is done. */
  motion: Phaser.Tweens.Tween | null;
  /** Work puffs on a timer (art with a work animation). */
  puffs: Phaser.Time.TimerEvent | null;
  /** True once the finished pose is shown. */
  done: boolean;
}

/**
 * Inside a workplace: the painted room (PixelLab create_room) with its furniture
 * as cut-out pieces that depth-sort against the player, invisible walls, the
 * doorway back to town, and the work stations. E at a station puts a free
 * creature to work, shows the time left, or collects the finished shift.
 * Layout: src/data/interiors.json; rules: src/logic/game.ts (shifts).
 */
export class InteriorScene extends Phaser.Scene {
  private def!: InteriorDef;
  /** Game state (named `world` because Phaser.Scene already owns `game`). */
  private world!: Game;
  /** Other players in this place; null when playing offline. */
  private others: RemotePlayers | null = null;
  private keys!: Keys;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private facing: Dir = 'up';
  private pet: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private petName = '';
  private petFacing: Dir = 'up';
  private panel: MenuPanel | null = null;
  private hint!: Phaser.GameObjects.Container;
  private workers: Worker[] = [];
  private controlsHint!: HudChip;
  private leaving = false;
  private data_!: InteriorData;

  constructor() {
    super('InteriorScene');
  }

  init(data: InteriorData): void {
    this.data_ = data;
    this.leaving = false;
    this.panel = null;
    this.pet = null;
    this.workers = [];
    this.facing = 'up';
  }

  preload(): void {
    const cfg = services(this).config;
    const all = parseInteriors(interiorsJson, cfg.shops, cfg.items.filter((i) => i.buyable).map((i) => i.id));
    const def = all[this.data_.place];
    if (!def) throw new Error(`No interior for "${this.data_.place}"`);
    this.def = def;
    const base = `assets/interiors/${def.dir}`;
    this.load.image(this.tex('floor'), `${base}/floor.png`);
    preloadBackdrop(this, def.backdrop);
    for (const p of def.pieces) {
      this.load.image(this.tex(`piece_${p.n}`), `${base}/piece_${p.n}.png`);
      if (p.shadow) this.load.image(this.tex(`shadow_${p.n}`), `${base}/shadow_${p.n}.png`);
    }
    for (const a of Object.values(art)) if (a !== AVATAR_ART) loadCharacter(this, a);
    if (!this.textures.exists(BIRD_TEX.ground)) this.load.image(BIRD_TEX.ground, `assets/town/${BIRD_TEX.ground}.png`);
  }

  /** Texture key for one of this interior's files. */
  private tex(name: string): string {
    return `interior_${this.def.dir}_${name}`;
  }

  create(): void {
    const def = this.def;
    this.world = services(this).loadGame();
    const cam = this.cameras.main;
    cam.setBackgroundColor(ui.ink);

    // Floor, shadows under everything standing, pieces sorted by their foot line.
    addBackdrop(this, def.backdrop);
    this.add.image(0, 0, this.tex('floor')).setOrigin(0, 0).setDepth(-1000);
    for (const p of def.pieces) {
      if (p.shadow) this.add.image(p.shadow.x, p.shadow.y, this.tex(`shadow_${p.n}`)).setOrigin(0, 0).setDepth(-900);
      this.add.image(p.x, p.y, this.tex(`piece_${p.n}`)).setOrigin(0, 0).setDepth(p.foot);
    }
    const walls = this.physics.add.staticGroup();
    for (const r of wallRects(def)) walls.add(this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h));
    for (const p of def.pieces) if (p.block) walls.add(this.add.zone(p.block.x + p.block.w / 2, p.block.y + p.block.h / 2, p.block.w, p.block.h));
    this.physics.world.setBounds(0, 0, def.width, def.height);
    cam.centerOn(def.width / 2, def.height / 2);
    cam.fadeIn(300, 0, 0, 0);

    // Player, just inside the door.
    const pDef = homeJson.player;
    const pArt = art[pDef.character];
    if (pArt === AVATAR_ART) buildAvatar(this, savedAppearance(this.world));
    createCharacterAnims(this, pArt, pDef.walkFps);
    const arrive = def.exits[0].arrive;
    this.player = this.physics.add.sprite(arrive.x, arrive.y, `${pArt.name}_idle_up`);
    this.player.body.setSize(16, 10).setOffset(16, 34);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);
    // Other players here (online): drawn from the world room's synced state.
    const session = this.registry.get(SESSION_KEY) as WorldSession | undefined;
    this.others = session ? new RemotePlayers(this, session.room, `interior:${def.id}`, JSON.stringify(savedAppearance(this.world)), pDef.walkFps) : null;

    // A following pet comes in too (unless it is the one at work here).
    const petId = homeJson.pet.creatureId;
    const petCreature = this.world.state.creatures.find((c) => c.id === petId);
    if (this.data_.petFollowing && petCreature && petCreature.status !== 'working' && art[petCreature.speciesId]) {
      const petArt = art[petCreature.speciesId];
      createCharacterAnims(this, petArt, homeJson.pet.walkFps);
      this.petName = petArt.name;
      this.pet = this.physics.add.sprite(arrive.x - 18, arrive.y + 6, `${petArt.name}_idle_up`);
      this.pet.body.setSize(18, 12).setOffset(15, 30);
      this.pet.setCollideWorldBounds(true);
      this.physics.add.collider(this.pet, walls);
    }

    this.buildWorkers();

    // HUD: place name + controls, the game clock, the material count.
    const t = this.t.bind(this);
    const shop = this.world.shop(def.shopId);
    this.controlsHint = new HudChip(this, cam.width / 2, cam.height - 4, { anchor: 'bottomCenter', fixed: true, depth: 60_000, size: 10 }).setText(t('work.hint'));
    addClock(this, this.world, (k, v) => this.t(k, v));
    const stock = new HudChip(this, 4, 4, { anchor: 'topLeft', fixed: true, depth: 60_000 });
    const refreshStock = () =>
      stock.setText(t('work.inventory', { item: t(`items.${shop.productItemId}`), count: this.world.productCount(def.shopId) }));
    refreshStock();
    this.events.on('stock-changed', refreshStock);

    // "Press E" bubble over the station in reach.
    const bubble = this.add.rectangle(0, 0, 14, 14, Phaser.Display.Color.HexStringToColor(ui.panel).color).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(ui.ink).color);
    const letter = this.add.text(0, 0, t('pet.hint'), textStyle(true)).setOrigin(0.5);
    this.hint = this.add.container(0, 0, [bubble, letter]).setDepth(45_000).setVisible(false);
    this.tweens.add({ targets: this.hint, scale: 1.15, yoyo: true, repeat: -1, duration: 450 });

    this.keys = new Keys(this);
    const onResume = () => this.keys.read();
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.events.off('stock-changed', refreshStock);
    });
  }

  private t(k: string, v?: Record<string, string | number>): string {
    return services(this).i18n.t(k, v);
  }

  /** Species name, numbered when the player owns more than one of that species ("Rabbit 2"). */
  private creatureName(id: string): string {
    const c = this.world.creature(id);
    const same = this.world.state.creatures.filter((x) => x.speciesId === c.speciesId);
    const name = this.t(`species.${c.speciesId}`);
    return same.length > 1 ? `${name} ${same.indexOf(c) + 1}` : name;
  }

  update(): void {
    if (this.leaving) return;
    this.others?.update({ x: this.player.x, y: this.player.y, facing: this.facing, moving: this.player.body.velocity.lengthSq() > 0 }, this.time.now);
    this.refreshWorkers();
    const input = this.keys.read();
    // The controls line would sit under a tall menu; hide it while one is open.
    this.controlsHint.container.setVisible(this.panel === null);
    if (this.panel) {
      this.player.setVelocity(0, 0);
      this.pet?.setVelocity(0, 0);
      showMotion(this.player, art[homeJson.player.character].name, this.facing, false);
      if (this.panel.handle(input) === 'cancel') this.closePanel();
      return;
    }
    this.movePlayer();
    this.movePet();
    if (input.cancel) return this.openPause();
    // Only walking down into the doorway leaves.
    const exit = this.player.body.velocity.y > 0 ? exitAt(this.def, { x: this.player.x, y: this.player.body.bottom }) : null;
    if (exit) return this.leave(exit.to);
    const feet = { x: this.player.x, y: this.player.body.bottom };
    const range = homeJson.player.interactRange;
    const c = this.def.counter;
    // The shop counter wins when the player stands at it.
    if (c && Math.hypot(c.x - feet.x, c.y - feet.y) <= range) {
      this.hint.setVisible(true).setPosition(c.x, c.y - 30);
      if (input.confirm) this.openCounter();
      return;
    }
    const slot = stationNear(this.def, feet, range);
    this.hint.setVisible(slot >= 0);
    if (slot >= 0) {
      const s = this.def.stations[slot];
      this.hint.setPosition(s.x, s.y - 52);
      if (input.confirm) this.openStation(slot);
    }
  }

  // ---- shop counter (story-003) ------------------------------------------------------

  /** Item label with its translated name. */
  private itemName(id: string): string {
    return this.t(`items.${id}`);
  }

  private openCounter(): void {
    const counter = this.def.counter;
    if (!counter) return;
    this.hint.setVisible(false);
    const anchor = { kind: 'center' as const };
    const items: MenuItem[] = [
      ...counter.shelves.map((s) => ({ label: () => this.t(`market.shelf.${s.id}`), onSelect: () => this.openShelf(s.items) })),
      { label: () => this.t('market.sell'), onSelect: () => this.openSell() },
      { label: () => this.t('market.close'), onSelect: () => this.closePanel() },
    ];
    this.panel?.destroy();
    this.panel = new MenuPanel(this, { title: this.t('market.title'), items, help: this.t('market.help'), anchor });
  }

  /** One shelf: each E buys one. */
  private openShelf(ids: string[]): void {
    const c = this.def.counter!;
    const items: MenuItem[] = [
      ...ids.map((id) => ({
        label: () =>
          this.t('market.buyRow', { item: this.itemName(id), price: this.world.config.items.find((i) => i.id === id)!.price, count: this.world.state.inventory[id] ?? 0 }),
        onSelect: () => {
          const r = this.world.buy(id, 1);
          if (r.ok) {
            this.world.save();
            this.events.emit('stock-changed');
            this.floatText(this.t('market.bought', { item: this.itemName(id) }), c.x, c.y - 40);
          } else {
            this.floatText(this.t('market.noCoins'), c.x, c.y - 40);
          }
        },
      })),
      { label: () => this.t('market.back'), onSelect: () => this.openCounter() },
    ];
    this.panel?.destroy();
    this.panel = new MenuPanel(this, { title: this.t('market.title'), items, help: this.t('market.help'), anchor: { kind: 'center' } });
  }

  /** Sell one at a time, or everything sellable at once. */
  private openSell(): void {
    const c = this.def.counter!;
    const goods = this.world.config.items.filter((i) => i.sellable);
    const worth = () => goods.reduce((t, i) => t + i.price * (this.world.state.inventory[i.id] ?? 0), 0);
    const sold = (coins: number) => {
      this.world.save();
      this.events.emit('stock-changed');
      this.floatText(this.t('market.sold', { coins }), c.x, c.y - 40);
    };
    const items: MenuItem[] = [
      {
        label: () => this.t('market.sellAll', { coins: worth() }),
        onSelect: () => {
          const coins = worth();
          if (coins === 0) return this.floatText(this.t('market.notEnough'), c.x, c.y - 40);
          for (const g of goods) {
            const n = this.world.state.inventory[g.id] ?? 0;
            if (n > 0) this.world.sell(g.id, n);
          }
          sold(coins);
        },
      },
      ...goods.map((g) => ({
        label: () => this.t('market.sellRow', { item: this.itemName(g.id), price: g.price, count: this.world.state.inventory[g.id] ?? 0 }),
        onSelect: () => {
          const r = this.world.sell(g.id, 1);
          if (r.ok) sold(g.price);
          else this.floatText(this.t('market.notEnough'), c.x, c.y - 40);
        },
      })),
      { label: () => this.t('market.back'), onSelect: () => this.openCounter() },
    ];
    this.panel?.destroy();
    this.panel = new MenuPanel(this, { title: this.t('market.title'), items, help: this.t('market.help'), anchor: { kind: 'center' } });
  }

  // ---- movement --------------------------------------------------------------------

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

  private leave(to: string): void {
    this.leaving = true;
    this.player.setVelocity(0, 0);
    this.pet?.setVelocity(0, 0);
    this.world.save();
    const petFollowing = this.pet !== null;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(EXIT_SCENES[to] ?? to, { from: 'interior', place: this.def.id, petFollowing }),
    );
  }

  // ---- workers ---------------------------------------------------------------------

  /** Sprites for every creature currently on a shift here. */
  private buildWorkers(): void {
    for (const w of this.workers) {
      w.motion?.remove();
      w.puffs?.remove();
      w.sprite?.destroy();
      w.label.destroy();
    }
    this.workers = [];
    this.def.stations.forEach((st, slot) => {
      const shift = this.world.shiftAt(this.def.shopId, slot);
      if (!shift) return;
      const creature = this.world.creature(shift.creatureId);
      const sprite = this.workerSprite(creature.speciesId, st);
      const label = new HudChip(this, st.x, st.y - 44, { anchor: 'bottomCenter', fixed: false, depth: 44_000 });
      const worker: Worker = { slot, sprite, label, motion: null, puffs: null, done: false };
      const workArt = art[creature.speciesId] ? extraAnimKey(art[creature.speciesId], 'work', st.face) : null;
      if (sprite && workArt) {
        // Its own work animation, with puffs on a beat.
        sprite.setFlipX(workArt.flipX).play(workArt.key);
        const at = workPoint(st, WORK_REACH);
        worker.puffs = this.time.addEvent({ delay: this.def.effect.everyMs, loop: true, callback: () => this.puff(at.x, at.y, st.face === 'down' ? st.y + 1 : st.y - 1) });
      } else if (sprite) {
        worker.motion = this.workMotion(sprite, st);
      }
      this.workers.push(worker);
    });
    this.refreshWorkers();
  }

  /** The creature's own art facing its furniture, the plaza pigeon, or null (a name tag only). */
  private workerSprite(species: string, st: Station): Phaser.GameObjects.Sprite | null {
    const a = art[species];
    // Facing up it stands behind nothing; facing down it stands behind the furniture.
    const depth = st.y;
    if (a) {
      createCharacterAnims(this, a, homeJson.pet.walkFps);
      return this.add.sprite(st.x, st.y, `${a.name}_idle_${st.face}`).setOrigin(0.5, 1).setDepth(depth);
    }
    if (species === 'pigeon' && this.textures.exists(BIRD_TEX.ground)) {
      return this.add.sprite(st.x, st.y, BIRD_TEX.ground).setOrigin(0.5, 1).setDepth(depth).setFlipX(st.face === 'left');
    }
    return null;
  }

  /**
   * Working: the creature leans into its furniture and back, squashing a little
   * like kneading or hammering, and each stroke puffs flour/sawdust/dust there.
   */
  private workMotion(sprite: Phaser.GameObjects.Sprite, st: Station): Phaser.Tweens.Tween {
    const lean = { up: [0, -2], down: [0, 2], left: [-2, 0], right: [2, 0] }[st.face];
    const at = workPoint(st, WORK_REACH);
    return this.tweens.add({
      targets: sprite,
      x: st.x + lean[0],
      y: st.y + lean[1],
      scaleY: 0.94,
      duration: this.def.effect.everyMs / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onYoyo: () => this.puff(at.x, at.y, st.face === 'down' ? st.y + 1 : st.y - 1),
    });
  }

  /** A few specks rising and fading where the work happens. */
  private puff(x: number, y: number, depth: number): void {
    const color = Phaser.Display.Color.HexStringToColor(this.def.effect.color).color;
    for (let i = 0; i < 3; i++) {
      const p = this.add.rectangle(x + Phaser.Math.Between(-5, 5), y + Phaser.Math.Between(-2, 2), 2, 2, color).setDepth(depth);
      this.tweens.add({ targets: p, y: p.y - Phaser.Math.Between(6, 12), x: p.x + Phaser.Math.Between(-4, 4), alpha: 0, duration: 600, onComplete: () => p.destroy() });
    }
  }

  /** Countdown or "Ready!" over each worker. */
  private refreshWorkers(): void {
    for (const w of this.workers) {
      const shift = this.world.shiftAt(this.def.shopId, w.slot);
      if (!shift) continue;
      const left = this.world.shiftTimeLeft(this.def.shopId, w.slot);
      const name = w.sprite ? '' : `${this.creatureName(shift.creatureId)} `;
      w.label.setText(left > 0 ? `${name}${formatCountdown(left)}` : `${name}${this.t('work.ready')}`, left > 0 ? ui.panel : ui.highlight);
      if (left === 0 && !w.done) {
        // Done: stop working and turn round to wait for the player.
        w.done = true;
        w.motion?.remove();
        w.motion = null;
        w.puffs?.remove();
        w.puffs = null;
        w.sprite?.anims.stop();
        w.sprite?.setFlipX(false);
        const st = this.def.stations[w.slot];
        const a = art[this.world.creature(shift.creatureId).speciesId];
        w.sprite?.setPosition(st.x, st.y).setScale(1);
        if (a) w.sprite?.setTexture(`${a.name}_idle_down`);
      }
    }
  }

  // ---- station menu ----------------------------------------------------------------

  private openStation(slot: number): void {
    const shopId = this.def.shopId;
    const shop = this.world.shop(shopId);
    const item = this.t(`items.${shop.productItemId}`);
    const shift = this.world.shiftAt(shopId, slot);
    const st = this.def.stations[slot];
    const anchor = { kind: 'above' as const, x: st.x, y: st.y - 40 };
    const help = this.t('work.help');
    const close: MenuItem = { label: () => this.t('work.close'), onSelect: () => this.closePanel() };
    this.hint.setVisible(false);

    if (!shift) {
      const free = this.world.state.creatures.filter((c) => c.status !== 'working');
      const items: MenuItem[] = free.map((c) => ({
        label: () => `${this.t('work.put', { name: this.creatureName(c.id) })} (${shiftOutput(this.world.speciesOf(c), shop)} ${item})`,
        onSelect: () => this.assign(c.id, slot),
      }));
      const lines = free.length === 0 ? [this.t('work.noneFree')] : undefined;
      this.panel = new MenuPanel(this, { title: this.t('work.freeTitle', { slot: slot + 1 }), lines, items: [...items, close], help, anchor });
      return;
    }

    const c = this.world.creature(shift.creatureId);
    const name = this.creatureName(c.id);
    const count = shiftOutput(this.world.speciesOf(c), shop);
    if (this.world.isShiftComplete(shopId, slot)) {
      const items: MenuItem[] = [{ label: () => this.t('work.collect', { count, item }), onSelect: () => this.collect(slot) }, close];
      this.panel = new MenuPanel(this, { title: this.t('work.doneTitle', { name }), items, help, anchor });
    } else {
      const lines = [
        this.t('work.timeLeft', { time: formatCountdown(this.world.shiftTimeLeft(shopId, slot)) }),
        this.t('work.yields', { count, item }),
      ];
      this.panel = new MenuPanel(this, { title: this.t('work.busyTitle', { name }), lines, items: [close], help, anchor });
    }
  }

  private assign(creatureId: string, slot: number): void {
    this.closePanel();
    const r = this.world.startShift(creatureId, this.def.shopId, slot);
    if (!r.ok) return;
    this.world.save();
    // The following pet walks over to the station instead of tagging along.
    if (creatureId === homeJson.pet.creatureId && this.pet) {
      this.pet.destroy();
      this.pet = null;
    }
    this.buildWorkers();
    const st = this.def.stations[slot];
    this.floatText(this.t('work.started', { name: this.creatureName(creatureId) }), st.x, st.y - 56);
  }

  private collect(slot: number): void {
    this.closePanel();
    const r = this.world.collectShift(this.def.shopId, slot);
    if (!r.ok) return;
    this.world.save();
    this.buildWorkers();
    this.events.emit('stock-changed');
    const st = this.def.stations[slot];
    this.floatText(this.t('work.collected', { count: r.count, item: this.t(`items.${r.itemId}`) }), st.x, st.y - 40);
  }

  private openPause(): void {
    const items: MenuItem[] = [
      { label: () => this.t('pause.resume'), onSelect: () => this.closePanel() },
      {
        label: () => this.t('pause.options'),
        onSelect: () => {
          this.closePanel();
          openOverlay(this, 'OptionsScene');
        },
      },
      {
        label: () => this.t('pause.toMenu'),
        onSelect: () => {
          this.world.save();
          this.scene.start('TitleScene');
        },
      },
    ];
    this.panel = new MenuPanel(this, { title: this.t('pause.title'), items, help: this.t('pause.help'), anchor: { kind: 'center' }, minWidth: 140 });
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  private floatText(msg: string, x: number, y: number): void {
    const txt = this.add
      .text(x, y, msg, { ...textStyle(), backgroundColor: ui.panel, padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(48_000);
    this.tweens.add({ targets: txt, y: y - 16, alpha: 0, delay: 900, duration: 900, onComplete: () => txt.destroy() });
  }
}
