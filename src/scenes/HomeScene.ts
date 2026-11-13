import Phaser from 'phaser';
import furnitureJson from '../data/furniture.json';
import homeJson from '../data/home.json';
import spritesJson from '../data/sprites.json';
import ui from '../data/ui.json';
import type { Game } from '../logic/game';
import { buildFloorGrid, exitAt, findUseSpot, parseCatalog, parseRoom, solidRects, wallRects, type ExitDef, type Placed, type RoomDef } from '../logic/room';
import { AVATAR_ART, buildAvatar, savedAppearance } from './avatar';
import { openOverlay } from './overlay';
import { PetController } from './PetController';
import { services } from './services';
import { createCharacterAnims, facingFor, loadCharacter, showMotion, type CharacterArt, type Dir } from './sprites';
import { Keys } from './ui/input';
import { MenuPanel, textStyle, type MenuItem } from './ui/MenuPanel';

/** Every sprite set, plus the player's avatar (built at runtime, not loaded from files). */
const art: Record<string, CharacterArt> = { ...(spritesJson as Record<string, CharacterArt>), [AVATAR_ART.name]: AVATAR_ART };

/** Scene opened by each exit's `to` in home.json. */
const EXIT_SCENES: Record<string, string> = { town: 'TownScene' };

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
  private panel: MenuPanel | null = null;
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

  init(data: { from?: string; petFollowing?: boolean }): void {
    this.arrivedFrom = data?.from ?? null;
    this.petCameAlong = data?.petFollowing === true;
    this.leaving = false;
  }

  preload(): void {
    this.room = parseRoom(homeJson, parseCatalog(furnitureJson));
    const { background, furniture } = this.room;
    this.load.image(background, `assets/home/${background}.png`);
    for (const f of furniture) this.load.image(f.sprite, `assets/home/${f.sprite}.png`);
    // Species art is chosen in create() once the save is known; preload every file-based sprite set.
    for (const a of Object.values(art)) if (a !== AVATAR_ART) loadCharacter(this, a);
  }

  create(): void {
    const svc = services(this);
    const t = (k: string, v?: Record<string, string | number>) => services(this).i18n.t(k, v);
    const { background, width, height, gridSize, furniture, player: p, pet: petDef } = this.room;
    this.world = svc.loadGame();
    this.cameras.main.setBackgroundColor(ui.ink);

    // The painted room; walls are invisible static bodies; the camera centres the (small) room.
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
      if (f.solid) {
        const s = solids.create(f.x, f.y, f.sprite) as Phaser.Physics.Arcade.Sprite;
        s.setDepth(f.y + f.h / 2);
        (s.body as Phaser.Physics.Arcade.StaticBody).setSize(f.w, f.h / 2).setOffset(0, f.h / 2);
      } else {
        this.add.image(f.x, f.y, f.sprite).setDepth(-500);
      }
    }
    this.bowl = furniture.find((f) => f.use?.kind === 'eat') ?? null;
    if (this.bowl) {
      this.bowlLabel = this.add
        .text(this.bowl.x, this.bowl.y + this.bowl.h / 2 - 2, '', { ...textStyle(true, 9), color: ui.panel, backgroundColor: ui.ink, padding: { x: 2, y: 0 } })
        .setOrigin(0.5, 0)
        .setDepth(-400);
      this.refreshBowl();
    }

    // Player.
    const playerArt = art[p.character];
    if (playerArt === AVATAR_ART) buildAvatar(this, savedAppearance(this.world));
    createCharacterAnims(this, playerArt, p.walkFps);
    const door = this.room.exits.find((e) => e.to === this.arrivedFrom);
    const spawn = door ? door.arrive : p;
    this.facing = door ? 'up' : 'down';
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
    // A pet on a shift is at its workplace, not at home.
    this.petAway = this.world.state.creatures.find((c) => c.id === petDef.creatureId)?.status === 'working';
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

    this.keys = new Keys(this);
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
    if (!this.petAway) this.pet.update(dt);
    const input = this.keys.read();

    if (this.panel) {
      this.player.setVelocity(0, 0);
      showMotion(this.player, art[this.room.player.character].name, this.facing, false);
      if (this.panel.handle(input) === 'cancel') this.closePanel();
      return;
    }

    this.movePlayer();
    if (input.cancel) return this.openPause();
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
    if (this.bowl) list.push({ x: this.bowl.x, y: this.bowl.y, open: () => this.openBowlMenu() });
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

  private openPanel(build: () => MenuPanel, pausePet: boolean): void {
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
      this.t('pet.infoEnergy', { energy: Math.round(c.energy), max }),
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
      // Waking up frees the creature again; energy recovery over time is Story 004.
      this.world.creature(id).status = 'idle';
      this.world.save();
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
