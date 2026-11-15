import Phaser from 'phaser';
import ui from '../../data/ui.json';
import { inZone, type TensionState, type TensionTuning } from '../../logic/tension';
import { textStyle } from './MenuPanel';

/** Bar size in game pixels. */
const BAR_W = 200;
const BAR_H = 12;
/** Catch meter under the bar. */
const METER_H = 5;
/** Space under the panel, from the bottom of the screen (the controls hint lives there). */
const BOTTOM_GAP = 26;
const PAD = 8;

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
/** The zone is green, brighter while the marker is inside it. */
const ZONE = 0x6fbf5a;
const ZONE_HIT = 0x9ae07f;

/**
 * Screen-space view of the catching minigame: a horizontal bar with the green
 * zone (the creature tugging) and the marker the player lifts by holding E,
 * plus the catch meter below. Drawn from a TensionState each frame.
 */
export class TensionBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly zone: Phaser.GameObjects.Rectangle;
  private readonly marker: Phaser.GameObjects.Triangle;
  private readonly meter: Phaser.GameObjects.Rectangle;
  private readonly left: number;

  constructor(scene: Phaser.Scene, title: string, hint: string) {
    const cam = scene.cameras.main;
    const cx = Math.round(cam.width / 2);
    const panelH = 16 + BAR_H + 6 + METER_H + 18 + PAD;
    const top = cam.height - BOTTOM_GAP - panelH;
    this.left = cx - BAR_W / 2;
    const plate = scene.add.rectangle(cx, top + panelH / 2, BAR_W + PAD * 2, panelH, color(ui.panel)).setStrokeStyle(2, color(ui.ink));
    const titleTxt = scene.add.text(cx, top + 3, title, textStyle(true)).setOrigin(0.5, 0);
    const barY = top + 18;
    const track = scene.add.rectangle(cx, barY + BAR_H / 2, BAR_W, BAR_H, color(ui.ink));
    this.zone = scene.add.rectangle(this.left, barY + BAR_H / 2, 10, BAR_H - 2, ZONE).setOrigin(0, 0.5);
    this.marker = scene.add.triangle(this.left, barY + BAR_H + 1, 0, 6, 8, 6, 4, 0, color(ui.heart)).setOrigin(0.5, 1);
    const meterY = barY + BAR_H + 6;
    const meterBack = scene.add.rectangle(cx, meterY + METER_H / 2, BAR_W, METER_H, color(ui.panelShade));
    this.meter = scene.add.rectangle(this.left, meterY + METER_H / 2, 0, METER_H, color(ui.heart)).setOrigin(0, 0.5);
    const hintTxt = scene.add.text(cx, meterY + METER_H + 3, hint, { ...textStyle(false), color: ui.help }).setOrigin(0.5, 0);
    this.root = scene.add.container(0, 0, [plate, titleTxt, track, this.zone, this.marker, meterBack, this.meter, hintTxt]).setScrollFactor(0).setDepth(58_000);
  }

  /** Redraws the bar for this frame. */
  draw(s: TensionState, t: TensionTuning): void {
    const zw = Math.round(t.zoneWidth * BAR_W);
    this.zone.setPosition(Math.round(this.left + (s.zone - t.zoneWidth / 2) * BAR_W), this.zone.y).setSize(zw, this.zone.height);
    this.zone.setFillStyle(inZone(s, t) ? ZONE_HIT : ZONE);
    this.marker.setX(Math.round(this.left + s.marker * BAR_W));
    this.meter.setSize(Math.round(s.progress * BAR_W), METER_H);
  }

  destroy(): void {
    this.root.destroy();
  }
}
