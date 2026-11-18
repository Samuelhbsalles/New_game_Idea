import Phaser from 'phaser';
import furnitureJson from '../data/furniture.json';
import homeJson from '../data/home.json';
import spritesJson from '../data/sprites.json';
import ui from '../data/ui.json';
import type { Game } from '../logic/game';
import { defaultLayout, parseLayout, pieceDepth, SHADOW_DEPTH, type HomeLayout } from '../logic/home';
import { buildFloorGrid, exitAt, findUseSpot, parseCatalog, parseRoom, solidRects, wallRects, type ExitDef, type FurnitureItem, type Placed, type RoomDef } from '../logic/room';
import { SESSION_KEY, type WorldSession } from '../net/world';
import { AVATAR_ART, buildAvatar, savedAppearance } from './avatar';
import { openOverlay } from './overlay';
import { addBackdrop, preloadBackdrop } from './backdrop';
import { HomeDecorator } from './HomeDecorator';
import { PetController } from './PetController';
import { RemotePlayers } from './RemotePlayers';
import { services } from './services';
import { createCharacterAnims, facingFor, loadCharacter, showMotion, type CharacterArt, type Dir } from './sprites';
import { Keys } from './ui/input';
import catchingJson from '../data/catching.json';
import bagJson from '../data/bag.json';
import { parseBagRules } from '../logic/bag';
import { bagContent } from './bagContent';
import { BagPanel } from './ui/BagPanel';
import { HudChip } from './ui/HudChip';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';

/** Every sprite set, plus the player's avatar (built at runtime, not loaded from files). */
const art: Record<string, CharacterArt> = { ...(spritesJson as Record<string, CharacterArt>), [AVATAR_ART.name]: AVATAR_ART };

/** Scene opened by each exit's `to` in home.json. */
const EXIT_SCENES: Record<string, string> = { town: 'TownScene' };

/** Visiting another player's apartment. */
export interface HomeVisit {
  accountId: string;
  name: string;
  /** Their furniture as the server sent it; vetted with parseLayout. */
  home: unknown;
}

/** How HomeScene was entered. */
export interface HomeData {
  from?: string;
  petFollowing?: boolean;
  visit?: HomeVisit;
  resumeAt?: { x: number; y: number };
}

/** Something the player can walk up to and press E on. */
interface Interactable {
  x: number;
  y: number;
  open: () => void;
}

/**
 * The player's home: a painted room picture (PixelLab create_room) with
 * invisible wall bodies from home.json's walkable rects, furniture from the catalog,
 * the player walking with the arrow keys, and the pet NPC living its own life.
 * E near the pet or the bowl opens its menu; Esc opens the pause menu.
 * Layout: src/data/home.json; furniture: src/data/furniture.json.
 */
export class HomeScene extends Phaser.Scene {
  private room!: RoomDef;
  /** Game state and rules (named `world` because Phaser.Scene already owns `game`). */
  private world!: Game;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private pet!: PetController;
  private keys!: Keys;
  private facing: Dir = 'down';
  private hint!: Phaser.GameObjects.Container;
  private panel: MenuPanel | BagPanel | null = null;
  private bagKey!: Phaser.Input.Keyboard.Key;
  private readonly bagRules = parseBagRules(bagJson);
  private bowl: Placed | null = null;
  private bowlLabel: Phaser.GameObjects.Text | null = null;

  /** Set while fading out to another scene, so nothing else runs. */
  private leaving = false;
  /** Where the player appears: the spawn, or the door when coming back from the map. */
  private arrivedFrom: string | null = null;

  constructor() {
    super('HomeScene');
  }

  /** True when the pet was following outside and walks back in with the player. */
  private petCameAlong = false;
  /** True while the pet is away working a shift: hidden, paused, not interactable. */
  private petAway = false;

  /** Visiting someone else's apartment (online): whose, and their furniture as the server sent it. */
  private visit: HomeVisit | null = null;
  /** Where to put the player back after decorating. */
  private resumeAt: { x: number; y: number } | null = null;
  private catalog: FurnitureItem[] = [];
  /** This apartment's furniture (ours, or the host's when visiting). */
  private layout!: HomeLayout;
  /** Everything drawn for the furniture, hidden while decorating. */
  private furnitureObjs: Phaser.GameObjects.GameObject[] = [];
  private decorator: HomeDecorator | null = null;
  private others: RemotePlayers | null = null;

  init(data: HomeData): void {
    this.arrivedFrom = data?.from ?? null;
    this.petCameAlong = data?.petFollowing === true;
    this.visit = data?.visit ?? null;
    this.resumeAt = data?.resumeAt ?? null;
    this.leaving = false;
    this.decorator = null;
    this.furnitureObjs = [];
  }

  preload(): void {
    // Every catalog piece: the layout (ours or a host's) is only known in create().
    this.catalog = parseCatalog(furnitureJson);
    this.load.image(homeJson.background, `assets/home/${homeJson.background}.png`);
    preloadBackdrop(this, homeJson.backdrop ?? null);
    for (const f of this.catalog) {
      this.load.image(f.sprite, `assets/home/${f.sprite}.png`);
      if (f.shadow) this.load.image(f.shadow.sprite, `assets/home/${f.shadow.sprite}.png`);
    }
    // Species art is chosen in create() once the save is known; preload every file-based sprite set.
    for (const a of Object.values(art)) if (a !== AVATAR_ART) loadCharacter(this, a);
  }

  create(): void {
    const svc = services(this);
    const t = (k: string, v?: Record<string, string | number>) => services(this).i18n.t(k, v);
    this.world = svc.loadGame();
    const starter = defaultLayout(homeJson.placements);
    this.layout = (this.visit ? parseLayout(this.visit.home, this.catalog) : parseLayout(this.world.state.home, this.catalog)) ?? starter;
    this.room = parseRoom({ ...homeJson, placements: this.layout.placements }, this.catalog);
    const { background, width, height, gridSize, furniture, player: p, pet: petDef } = this.room;
    this.cameras.main.setBackgroundColor(ui.ink);

    // The painted room; walls are invisible static bodies; the camera centres the (small) room.
    addBackdrop(this, this.room.backdrop);
    this.add.image(0, 0, background).setOrigin(0, 0).setDepth(-1000);
    const walls = this.physics.add.staticGroup();
    for (const r of wallRects(this.room)) {
      const w = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      walls.add(w);
    }
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.centerOn(width / 2, height / 2);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Furniture: solid pieces block with their lower half and depth-sort by their bottom edge.
    const solids = this.physics.add.staticGroup();
    for (const f of furniture) {
      if (f.shadow) this.furnitureObjs.push(this.add.image(f.x + f.shadow.dx, f.y + f.shadow.dy, f.shadow.sprite).setOrigin(0, 0).setDepth(SHADOW_DEPTH));
      if (f.solid) {
        const s = solids.create(f.x, f.y, f.sprite) as Phaser.Physics.Arcade.Sprite;
        s.setDepth(f.y + f.h / 2);
        (s.body as Phaser.Physics.Arcade.StaticBody).setSize(f.w, f.h / 2).setOffset(0, f.h / 2);
        this.furnitureObjs.push(s);
      } else {
        this.furnitureObjs.push(this.add.image(f.x, f.y, f.sprite).setDepth(pieceDepth(f, f.y)));
      }
    }
    this.bowl = furniture.find((f) => f.use?.kind === 'eat') ?? null;
    if (this.bowl) {
      this.bowlLabel = this.add
        .text(this.bowl.x, this.bowl.y + this.bowl.h / 2 - 2, '', { ...textStyle(true, 9), color: ui.panel, backgroundColor: ui.ink, padding: { x: 2, y: 0 } })
        .setOrigin(0.5, 0)
        .setDepth(-400)
        .setVisible(!this.visit); // the host's bowl count is not ours to show
      this.furnitureObjs.push(this.bowlLabel);
      this.refreshBowl();
    }

    // Player.
    const playerArt = art[p.character];
    if (playerArt === AVATAR_ART) buildAvatar(this, savedAppearance(this.world));
    createCharacterAnims(this, playerArt, p.walkFps);
    const door = this.room.exits.find((e) => e.to === this.arrivedFrom);
    const spawn = this.resumeAt ?? (door ? door.arrive : p);
    this.facing = door && !this.resumeAt ? 'up' : 'down';
    this.player = this.physics.add.sprite(spawn.x, spawn.y, `${playerArt.name}_idle_${this.facing}`);
    this.player.body.setSize(16, 10).setOffset(16, 34);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);
    this.physics.add.collider(this.player, solids);

    // Pet.
    const petArt = art[this.petSpecies()];
    createCharacterAnims(this, petArt, petDef.walkFps);
    this.pet = new PetController(this, petDef, petArt.name, buildFloorGrid(this.room), gridSize, solidRects(this.room), Math.random, {
      spot: (kind) => findUseSpot(this.room, kind),
      bowlHasFood: () => (this.world.state.bowl ?? 0) > 0,
      eatFromBowl: () => {
        const r = this.world.eatFromBowl(petDef.creatureId, petDef.foodItemId);
        if (r) {
          this.world.save();
          this.refreshBowl();
        }
        return r !== null;
      },
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      say: (msg) => this.floatText(msg, this.pet.sprite.x, this.pet.sprite.y - 30),
      sleepColor: ui.sleep,
      heartColor: ui.heart,
    });
    this.pet.sprite.setCollideWorldBounds(true);
    if (this.petCameAlong) {
      this.pet.sprite.body.reset(spawn.x - 18, spawn.y + 4);
      this.pet.command('follow');
    }
    this.physics.add.collider(this.pet.sprite, walls);
    this.physics.add.collider(this.pet.sprite, solids);
    // A pet on a shift is at its workplace, not at home; and our pet is not in someone else's apartment.
    this.petAway = this.visit !== null || this.world.state.creatures.find((c) => c.id === petDef.creatureId)?.status === 'working';
    if (this.petAway) {
      this.pet.setPaused(true);
      this.pet.sprite.setVisible(false);
      this.pet.sprite.body.enable = false;
    }

    // "Press E" bubble over whatever is in reach.
    const bubble = this.add.rectangle(0, 0, 14, 14, Phaser.Display.Color.HexStringToColor(ui.panel).color).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(ui.ink).color);
    const letter = this.add.text(0, 0, t('pet.hint'), textStyle(true)).setOrigin(0.5);
    this.hint = this.add.container(0, 0, [bubble, letter]).setDepth(45_000).setVisible(false);
    this.tweens.add({ targets: this.hint, scale: 1.15, yoyo: true, repeat: -1, duration: 450 });

    // Online: whoever else is in this apartment (the host and other visitors).
    const session = this.registry.get(SESSION_KEY) as WorldSession | undefined;
    if (session) {
      const owner = this.visit?.accountId ?? session.accountId;
      this.others = new RemotePlayers(this, session.room, `home:${owner}`, JSON.stringify(savedAppearance(this.world)), p.walkFps);
    } else {
      this.others = null;
    }
    if (this.visit) new HudChip(this, this.cameras.main.width / 2, 4, { anchor: 'topCenter', fixed: true, depth: 60_000 }).setText(t('home.visiting', { name: this.visit.name }));

    this.keys = new Keys(this);
    this.bagKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    // Coming back from an overlay: drop the key press that closed it.
    const onResume = () => {
      this.keys.read();
      this.openPause();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    // Scene events outlive a restart (Title -> Home again), so unhook on shutdown.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume));
  }

  update(_t: number, dt: number): void {
    if (this.leaving) return;
    this.others?.update({ x: this.player.x, y: this.player.y, facing: this.facing, moving: this.player.body.velocity.lengthSq() > 0 }, this.time.now);
    if (this.decorator) {
      this.player.setVelocity(0, 0);
      this.decorator.update(dt);
      return;
    }
    if (!this.petAway) this.pet.update(dt);
    const input = this.keys.read();

    if (this.panel) {
      this.player.setVelocity(0, 0);
      showMotion(this.player, art[this.room.player.character].name, this.facing, false);
      const bagToggle = this.panel instanceof BagPanel && Phaser.Input.Keyboard.JustDown(this.bagKey);
      if (this.panel.handle(input) === 'cancel' || bagToggle) this.closePanel();
      return;
    }

    this.movePlayer();
    if (input.cancel) return this.openPause();
    if (!this.visit && Phaser.Input.Keyboard.JustDown(this.bagKey)) return this.openBag();
    // Only a player walking down into the doorway leaves (never a stray first-frame overlap).
    const exit = this.player.body.velocity.y > 0 ? exitAt(this.room, { x: this.player.x, y: this.player.body.bottom }) : null;
    if (exit) return this.leave(exit);
    const target = this.nearest();
    this.hint.setVisible(target !== null);
    if (target) this.hint.setPosition(target.x, target.y - 30);
    if (target && input.confirm) target.open();
  }

  // ---- player -------------------------------------------------------------------

  private movePlayer(): void {
    const { speed, character } = this.room.player;
    let { x: vx, y: vy } = this.keys.axis();
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.player.setVelocity(vx * speed, vy * speed);
    this.facing = facingFor(vx, vy, this.facing);
    showMotion(this.player, art[character].name, this.facing, vx !== 0 || vy !== 0);
    this.player.setDepth(this.player.y + this.player.height / 2);
  }

  /** Walked into a doorway: save, fade out and open the exit's scene (the town); a following pet comes too. */
  private leave(exit: ExitDef): void {
    if (this.leaving) return;
    this.leaving = true;
    this.player.setVelocity(0, 0);
    this.world.save();
    const petFollowing = !this.petAway && this.pet.following;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(EXIT_SCENES[exit.to] ?? exit.to, { from: 'home', place: 'home', petFollowing }),
    );
  }

  /** The closest interactable in reach, or null. */
  private nearest(): Interactable | null {
    const list: Interactable[] = this.petAway ? [] : [{ x: this.pet.sprite.x, y: this.pet.sprite.y, open: () => this.openPetMenu() }];
    if (this.bowl && !this.visit) list.push({ x: this.bowl.x, y: this.bowl.y, open: () => this.openBowlMenu() });
    let best: Interactable | null = null;
    let bestD = this.room.player.interactRange;
    for (const it of list) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d <= bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  // ---- menus ------------------------------------------------------------------------

  private t(k: string, v?: Record<string, string | number>): string {
    return services(this).i18n.t(k, v);
  }

  private petSpecies(): string {
    const id = this.room.pet.creatureId;
    return this.world.state.creatures.find((x) => x.id === id)?.speciesId ?? this.world.state.creatures[0].speciesId;
  }

  private petName(): string {
    return this.t(`species.${this.petSpecies()}`);
  }

  /** The bag at home: creatures can be swapped between the bag and the apartment here. */
  private openBag(): void {
    this.player.setVelocity(0, 0);
    this.openPanel(
      () =>
        new BagPanel(
          this,
          bagContent({
            rides: null,
            ridesBlocked: this.t('rides.indoors'),
            ridesOwned: this.world.state.rides ?? [],
            game: this.world,
            rules: this.bagRules,
            genericBaitId: catchingJson.genericBaitId,
            t: (k, v) => this.t(k, v),
            artName: (species) => (spritesJson as Record<string, { name: string }>)[species]?.name ?? null,
            placeBait: null,
            atHome: true,
            changed: () => {
              this.world.save();
              (this.panel as BagPanel | null)?.refresh();
            },
            baitBlocked: this.t('bag.baitInTown'),
            say: (msg) => (this.panel as BagPanel | null)?.say(msg),
          }),
          this.bagRules.cols,
          this.bagRules.rows,
          'creatures',
        ),
      false,
    );
  }

  private openPanel(build: () => MenuPanel | BagPanel, pausePet: boolean): void {
    this.hint.setVisible(false);
    this.panel?.destroy();
    if (pausePet) this.pet.setPaused(true);
    this.panel = build();
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    if (!this.petAway) this.pet.setPaused(false);
  }

  private openPetMenu(): void {
    this.pet.setPaused(true);
    this.pet.faceTowards(this.player.x, this.player.y);
    const def = this.room.pet;
    const food = () => this.world.state.inventory[def.foodItemId] ?? 0;
    const items: MenuItem[] = [
      { label: () => this.t('pet.pet'), onSelect: () => this.doPet() },
      { label: () => this.t('pet.feed', { count: food() }), onSelect: () => this.doFeed() },
      {
        label: () => this.t(this.pet.following ? 'pet.stay' : 'pet.follow'),
        onSelect: () => {
          const follow = !this.pet.following;
          this.closePanel();
          this.pet.command(follow ? 'follow' : 'stay');
          this.floatText(this.t(follow ? 'pet.following' : 'pet.staying'), this.pet.sprite.x, this.pet.sprite.y - 30);
        },
      },
      { label: () => this.t('pet.sleep'), onSelect: () => this.doSleep() },
      { label: () => this.t('pet.info'), onSelect: () => this.openPetInfo() },
      { label: () => this.t('pet.close'), onSelect: () => this.closePanel() },
    ];
    this.openPanel(
      () => new MenuPanel(this, { title: this.t('pet.menuTitle', { name: this.petName() }), items, help: this.t('pet.help'), anchor: this.above(this.pet.sprite) }),
      true,
    );
  }

  private openPetInfo(): void {
    const c = this.world.creature(this.room.pet.creatureId);
    const max = this.world.speciesOf(c).maxEnergy;
    const lines = [
      this.t('pet.infoSpecies', { species: this.petName() }),
      this.t('pet.infoEnergy', { energy: Math.floor(this.world.energyOf(c.id)), max }),
      this.t('pet.infoStatus', { status: this.t(`status.${c.status}`) }),
      this.t('pet.infoActivity', { activity: this.t(`activity.${this.pet.activity}`) }),
    ];
    this.openPanel(
      () => new MenuPanel(this, { title: this.t('pet.infoTitle'), lines, help: this.t('pet.infoClose'), anchor: this.above(this.pet.sprite) }),
      true,
    );
  }

  private openBowlMenu(): void {
    const bowl = this.bowl;
    if (!bowl) return;
    const cap = bowl.use?.capacity ?? 1;
    const def = this.room.pet;
    const items: MenuItem[] = [
      {
        label: () => this.t('bowl.fill', { count: this.world.state.inventory[def.foodItemId] ?? 0 }),
        onSelect: () => {
          const r = this.world.fillBowl(def.foodItemId, cap);
          this.closePanel();
          if (r.ok) {
            this.world.save();
            this.refreshBowl();
            this.floatText(this.t('bowl.filled', { bowl: r.bowl, cap }), bowl.x, bowl.y - 24);
          } else {
            this.floatText(this.t(r.reason === 'full' ? 'bowl.full' : 'bowl.noItem'), bowl.x, bowl.y - 24);
          }
        },
      },
      { label: () => this.t('bowl.close'), onSelect: () => this.closePanel() },
    ];
    this.openPanel(
      () =>
        new MenuPanel(this, {
          title: this.t('bowl.menuTitle', { bowl: this.world.state.bowl ?? 0, cap }),
          items,
          help: this.t('pet.help'),
          anchor: this.above(bowl),
        }),
      false,
    );
  }

  private openPause(): void {
    const items: MenuItem[] = [
      { label: () => this.t('pause.resume'), onSelect: () => this.closePanel() },
      ...(this.visit ? [] : [{ label: () => this.t('decor.start'), onSelect: () => this.startDecorating() }]),
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
    this.openPanel(() => new MenuPanel(this, { title: this.t('pause.title'), items, help: this.t('pause.help'), anchor: { kind: 'center' }, minWidth: 140 }), true);
  }

  // ---- pet actions ------------------------------------------------------------------

  private doPet(): void {
    const wasAsking = this.pet.asking;
    this.closePanel();
    this.pet.command('petted');
    if (wasAsking) {
      this.pet.hearts(6);
      this.floatText(this.t('pet.happy'), this.pet.sprite.x, this.pet.sprite.y - 34);
    }
  }

  private doFeed(): void {
    const r = this.world.feed(this.room.pet.creatureId, this.room.pet.foodItemId);
    this.closePanel();
    if (r.ok) {
      this.world.save();
      this.pet.command('eat');
      this.floatText(this.t('pet.feedOk', { energy: Math.round(r.energy) }), this.pet.sprite.x, this.pet.sprite.y - 30);
    } else {
      this.floatText(this.t('pet.feedNoItem'), this.pet.sprite.x, this.pet.sprite.y - 30);
    }
  }

  private doSleep(): void {
    const id = this.room.pet.creatureId;
    this.world.rest(id);
    this.world.save();
    this.closePanel();
    this.pet.command('sleep', () => {
      // Waking up frees it again, keeping the energy it got back while asleep.
      this.world.wake(id);
      this.world.save();
    });
  }

  // ---- decorating -------------------------------------------------------------------

  /** Arrange our own furniture (src/scenes/HomeDecorator.ts). */
  private startDecorating(): void {
    this.closePanel();
    this.hint.setVisible(false);
    this.pet.setPaused(true);
    this.player.setVisible(false);
    for (const o of this.furnitureObjs) (o as unknown as { setVisible(v: boolean): void }).setVisible(false);
    this.decorator = new HomeDecorator(this, {
      catalog: this.catalog,
      plan: this.room,
      layout: this.layout,
      keys: this.keys,
      t: (k, v) => this.t(k, v),
      onChange: (layout) => {
        this.layout = layout;
        this.world.state.home = layout;
        this.world.save();
      },
      // Rebuild the room (bodies, pet paths, use spots) from the new layout.
      onExit: () => {
        this.decorator?.destroy();
        this.decorator = null;
        this.scene.restart({ resumeAt: { x: this.player.x, y: this.player.y }, petFollowing: false } satisfies HomeData);
      },
    });
  }

  // ---- little effects -----------------------------------------------------------------

  private above(o: { x: number; y: number }): { kind: 'above'; x: number; y: number } {
    return { kind: 'above', x: o.x, y: o.y - 26 };
  }

  private refreshBowl(): void {
    if (!this.bowl || !this.bowlLabel) return;
    const n = this.world.state.bowl ?? 0;
    this.bowlLabel.setText(`${n}/${this.bowl.use?.capacity ?? 1}`);
  }

  private floatText(msg: string, x: number, y: number): void {
    const t = this.add
      .text(x, y, msg, { ...textStyle(), backgroundColor: ui.panel, padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(48_000);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, delay: 900, duration: 900, onComplete: () => t.destroy() });
  }
}
