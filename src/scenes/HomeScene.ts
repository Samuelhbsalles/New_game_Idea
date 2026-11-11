import Phaser from 'phaser';
import creaturesJson from '../data/creatures.json';
import homeJson from '../data/home.json';
import itemsJson from '../data/items.json';
import shopsJson from '../data/shops.json';
import spritesJson from '../data/sprites.json';
import startJson from '../data/start.json';
import strings from '../data/strings.pt-BR.json';
import ui from '../data/ui.json';
import { systemClock } from '../logic/clock';
import { parseConfig } from '../logic/config';
import { Game } from '../logic/game';
import { LocalStorageAdapter } from '../logic/localStorageAdapter';
import { MemoryStorage } from '../logic/memoryStorage';
import { buildFloorGrid, buildTileFrames, floorFrame, parseRoom, type RoomDef } from '../logic/room';
import type { Storage } from '../logic/storage';
import { PetController } from './PetController';
import { createCharacterAnims, facingFor, loadCharacter, showMotion, type CharacterArt, type Dir } from './sprites';

const SAVE_KEY = 'creatureGame.save';
const art = spritesJson as Record<string, CharacterArt>;

/** Fills {placeholders} in a UI string. */
function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

function browserStorage(): Storage {
  try {
    return new LocalStorageAdapter(SAVE_KEY, window.localStorage);
  } catch {
    return new MemoryStorage();
  }
}

type MenuAction = 'pet' | 'feed' | 'sleep' | 'info' | 'close';

/**
 * The player's home: Wang-tiled floor and walls, furniture, the player walking
 * with the arrow keys, and the pet NPC living its own life. Walk up to the pet
 * and press E/Space for its menu. Layout: src/data/home.json.
 */
export class HomeScene extends Phaser.Scene {
  private room!: RoomDef;
  /** Game state and rules (named `world` because Phaser.Scene already owns `game`). */
  private world!: Game;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private pet!: PetController;
  private keys!: {
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    e: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
  };
  private facing: Dir = 'down';
  private hint!: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Container | null = null;
  private menuItems: { action: MenuAction; label: string; enabled: boolean }[] = [];
  private menuIndex = 0;
  private menuTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('HomeScene');
  }

  preload(): void {
    this.room = parseRoom(homeJson);
    const { tileSize, tileset, furniture } = this.room;
    this.load.spritesheet(tileset, `assets/home/${tileset}.png`, { frameWidth: tileSize, frameHeight: tileSize });
    for (const f of furniture) this.load.image(f.key, `assets/home/${f.key}.png`);
    loadCharacter(this, art[this.room.player.character]);
    loadCharacter(this, art[this.petSpecies()]);
  }

  create(): void {
    const { tileSize, tileset, furniture, player: p, pet: petDef } = this.room;

    // Floor and walls.
    const map = this.make.tilemap({ data: buildTileFrames(this.room), tileWidth: tileSize, tileHeight: tileSize });
    const tiles = map.addTilesetImage(tileset, tileset, tileSize, tileSize, 0, 0);
    if (!tiles) throw new Error(`Tileset "${tileset}" failed to load`);
    const layer = map.createLayer(0, tiles, 0, 0);
    if (!layer) throw new Error('Tile layer failed to create');
    layer.setCollisionByExclusion([floorFrame(this.room)]);
    layer.setDepth(-1000);

    // Furniture: solid pieces block with their lower half and depth-sort by their bottom edge.
    const solids = this.physics.add.staticGroup();
    const blocked: { x: number; y: number; w: number; h: number }[] = [];
    for (const f of furniture) {
      if (f.solid) {
        const s = solids.create(f.x, f.y, f.key) as Phaser.Physics.Arcade.Sprite;
        s.setDepth(f.y + s.height / 2);
        const body = s.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(s.width, s.height / 2).setOffset(0, s.height / 2);
        blocked.push({ x: f.x - s.width / 2, y: f.y - s.height / 2, w: s.width, h: s.height });
      } else {
        this.add.image(f.x, f.y, f.key).setDepth(-500);
      }
    }

    // Game state (save in localStorage).
    const config = parseConfig({ species: creaturesJson, shops: shopsJson, items: itemsJson, start: startJson });
    this.world = Game.load(config, systemClock, browserStorage());

    // Player.
    const playerArt = art[p.character];
    createCharacterAnims(this, playerArt, p.walkFps);
    this.player = this.physics.add.sprite(p.x, p.y, `${playerArt.name}_idle_down`);
    this.player.body.setSize(16, 10).setOffset(16, 34);
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, solids);

    // Pet.
    const petArt = art[this.petSpecies()];
    createCharacterAnims(this, petArt, petDef.walkFps);
    this.pet = new PetController(this, petDef, petArt.name, buildFloorGrid(this.room), tileSize, blocked, Math.random, ui.sleep);
    this.physics.add.collider(this.pet.sprite, layer);
    this.physics.add.collider(this.pet.sprite, solids);

    // Interaction hint bubble.
    const bubble = this.add.rectangle(0, 0, 14, 14, Phaser.Display.Color.HexStringToColor(ui.panel).color).setStrokeStyle(1, this.ink());
    const letter = this.add.text(0, 0, strings.interactHint, this.textStyle()).setOrigin(0.5);
    this.hint = this.add.container(0, 0, [bubble, letter]).setDepth(20_000).setVisible(false);
    this.tweens.add({ targets: this.hint, scale: 1.15, yoyo: true, repeat: -1, duration: 450 });

    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    this.keys = {
      cursors: kb.createCursorKeys(),
      e: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
  }

  update(_t: number, dt: number): void {
    this.pet.update(dt);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keys.e) || Phaser.Input.Keyboard.JustDown(this.keys.cursors.space);
    const cancel = Phaser.Input.Keyboard.JustDown(this.keys.esc);

    if (this.panel) {
      this.player.setVelocity(0, 0);
      showMotion(this.player, art[this.room.player.character].name, this.facing, false);
      this.updatePanel(confirm, cancel);
      return;
    }

    this.movePlayer();
    const near = this.nearPet();
    this.hint.setVisible(near);
    if (near) this.hint.setPosition(this.pet.sprite.x, this.pet.sprite.y - 30);
    if (near && confirm) this.openMenu();
  }

  // ---- player ---------------------------------------------------------------

  private movePlayer(): void {
    const { speed, character } = this.room.player;
    const c = this.keys.cursors;
    let vx = (c.right.isDown ? 1 : 0) - (c.left.isDown ? 1 : 0);
    let vy = (c.down.isDown ? 1 : 0) - (c.up.isDown ? 1 : 0);
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.player.setVelocity(vx * speed, vy * speed);
    this.facing = facingFor(vx, vy, this.facing);
    showMotion(this.player, art[character].name, this.facing, vx !== 0 || vy !== 0);
    this.player.setDepth(this.player.y + this.player.height / 2);
  }

  private nearPet(): boolean {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.pet.sprite.x, this.pet.sprite.y);
    return d <= this.room.player.interactRange;
  }

  // ---- menu & info panel ---------------------------------------------------

  private petSpecies(): string {
    const id = this.room.pet.creatureId;
    // Before the Game exists (preload), fall back to the start config's first species.
    const c = this.world?.state.creatures.find((x) => x.id === id);
    return c?.speciesId ?? startJson.creatures[0];
  }

  private petName(): string {
    const s = this.petSpecies();
    return (strings.species as Record<string, string>)[s] ?? s;
  }

  private openMenu(): void {
    this.hint.setVisible(false);
    this.pet.setPaused(true);
    this.pet.faceTowards(this.player.x, this.player.y);
    const food = this.world.state.inventory[this.room.pet.foodItemId] ?? 0;
    this.menuItems = [
      { action: 'pet', label: strings.menuPet, enabled: true },
      { action: 'feed', label: fmt(strings.menuFeed, { count: food }), enabled: true },
      { action: 'sleep', label: strings.menuSleep, enabled: true },
      { action: 'info', label: strings.menuInfo, enabled: true },
      { action: 'close', label: strings.menuClose, enabled: true },
    ];
    this.menuIndex = 0;
    const lines = [fmt(strings.menuTitle, { name: this.petName() }), ...this.menuItems.map((m) => m.label)];
    this.buildPanel(lines, strings.menuHelp, true);
  }

  private openInfo(): void {
    const c = this.world.creature(this.room.pet.creatureId);
    const max = this.world.speciesOf(c).maxEnergy;
    const lines = [
      strings.infoTitle,
      fmt(strings.infoSpecies, { species: this.petName() }),
      fmt(strings.infoEnergy, { energy: Math.round(c.energy), max }),
      fmt(strings.infoStatus, { status: (strings.status as Record<string, string>)[c.status] ?? c.status }),
      fmt(strings.infoActivity, { activity: (strings.activity as Record<string, string>)[this.pet.activity] }),
    ];
    this.menuItems = [];
    this.buildPanel(lines, `E / Esc`, false);
  }

  private buildPanel(lines: string[], help: string, selectable: boolean): void {
    this.closePanel(false);
    const pad = 8;
    const lineH = ui.fontSize + 6;
    const texts = lines.map((l, i) =>
      this.add.text(pad + (selectable && i > 0 ? 12 : 0), pad + i * lineH, l, this.textStyle(i === 0)),
    );
    const helpText = this.add.text(pad, pad + lines.length * lineH + 2, help, { ...this.textStyle(), fontSize: `${ui.fontSize - 3}px`, color: ui.disabled });
    const w = Math.max(...texts.map((t) => t.x + t.width), helpText.width + pad) + pad;
    const h = helpText.y + helpText.height + pad;
    const bg = this.add
      .rectangle(0, 0, w, h, Phaser.Display.Color.HexStringToColor(ui.panel).color)
      .setOrigin(0)
      .setStrokeStyle(2, this.ink());
    const x = Phaser.Math.Clamp(this.pet.sprite.x - w / 2, 4, this.scale.width - w - 4);
    const y = Phaser.Math.Clamp(this.pet.sprite.y - h - 30, 4, this.scale.height - h - 4);
    this.panel = this.add.container(x, y, [bg, ...texts, helpText]).setDepth(30_000);
    this.menuTexts = selectable ? texts.slice(1) : [];
    this.highlightMenu();
  }

  private highlightMenu(): void {
    this.menuTexts.forEach((t, i) => {
      const label = this.menuItems[i].label;
      t.setText(i === this.menuIndex ? `▸ ${label}` : `  ${label}`);
      t.setX(8);
    });
  }

  private updatePanel(confirm: boolean, cancel: boolean): void {
    if (this.menuTexts.length === 0) {
      // Info panel: any confirm/cancel closes it.
      if (confirm || cancel) this.closePanel(true);
      return;
    }
    const c = this.keys.cursors;
    if (Phaser.Input.Keyboard.JustDown(c.down)) this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
    if (Phaser.Input.Keyboard.JustDown(c.up)) this.menuIndex = (this.menuIndex + this.menuItems.length - 1) % this.menuItems.length;
    this.highlightMenu();
    if (cancel) return this.closePanel(true);
    if (confirm) this.runAction(this.menuItems[this.menuIndex].action);
  }

  private closePanel(resumePet: boolean): void {
    this.panel?.destroy();
    this.panel = null;
    this.menuTexts = [];
    if (resumePet) this.pet.setPaused(false);
  }

  private runAction(action: MenuAction): void {
    const id = this.room.pet.creatureId;
    switch (action) {
      case 'pet':
        this.closePanel(true);
        this.pet.command('petted');
        this.hearts();
        break;
      case 'feed': {
        const r = this.world.feed(id, this.room.pet.foodItemId);
        this.closePanel(true);
        if (r.ok) {
          this.world.save();
          this.pet.command('eat');
          this.floatText(fmt(strings.feedOk, { energy: Math.round(r.energy) }), ui.ink);
        } else {
          this.floatText(strings.feedNoItem, ui.ink);
        }
        break;
      }
      case 'sleep':
        this.world.rest(id);
        this.world.save();
        this.closePanel(true);
        this.pet.command('sleep', () => {
          // Waking up frees the creature again; energy recovery over time is Story 004.
          this.world.creature(id).status = 'idle';
          this.world.save();
        });
        break;
      case 'info':
        this.openInfo();
        break;
      case 'close':
        this.closePanel(true);
        break;
    }
  }

  // ---- little effects --------------------------------------------------------

  private hearts(): void {
    for (let i = 0; i < 3; i++) {
      const h = this.add
        .text(this.pet.sprite.x + (i - 1) * 8, this.pet.sprite.y - 18, '♥', { fontFamily: ui.fontFamily, fontSize: '12px', color: ui.heart })
        .setOrigin(0.5)
        .setDepth(25_000);
      this.tweens.add({ targets: h, y: h.y - 22, alpha: 0, delay: i * 180, duration: 900, onComplete: () => h.destroy() });
    }
  }

  private floatText(msg: string, color: string): void {
    const t = this.add
      .text(this.pet.sprite.x, this.pet.sprite.y - 30, msg, { ...this.textStyle(), color, backgroundColor: ui.panel, padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(25_000);
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 700, duration: 900, onComplete: () => t.destroy() });
  }

  private textStyle(bold = false): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: ui.fontFamily, fontSize: `${ui.fontSize}px`, color: ui.ink, fontStyle: bold ? 'bold' : 'normal' };
  }

  private ink(): number {
    return Phaser.Display.Color.HexStringToColor(ui.ink).color;
  }
}
