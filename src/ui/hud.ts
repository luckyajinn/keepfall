// The bar across the top of the map: floor, health, XP, gold, potions, gear and trinkets.
//
// A 16-bit status bar 28 pixels tall (56 logical units), in four groups split by engraved
// grooves, on two rows of text that line up across the whole bar:
//   floor and level | health and XP bars, each tall enough to hold its numbers |
//   gold and potions | the three gear levels over the trinkets.
// A two line gold border and a dark line run along the bottom edge, like the pixel panels.
// The layout below is in art pixels (the 400 by 300 grid) and turned into logical units with fromPx.
import { C, PAL } from '../render/colors';
import { Ctx, W, bar, fillRR, text, textWidth } from '../render/draw';
import { fillPx, fromPx } from '../render/pixel';
import { drawIcon } from '../render/sprites';
import { Knight, maxHp, xpToNext } from '../entities/knight';
import { TRINKETS } from '../items/trinkets';
import { FINAL_FLOOR } from '../map/tiles';

export const HUD_H = 56;

/** The tops of the two rows of text, in art pixels. Icons and bars are centered on the same rows. */
const ROW_A = 3;
const ROW_B = 15;
/** The left edge of each group, in art pixels. */
const FLOOR_X = 6;
const BARS_X = 66;
const BARS_W = 204;
const PURSE_X = 282;
const GEAR_X = 322;
/** Grooves between the groups. */
const GROOVES = [60, 276, 316];
/** Room per gear level (icon, gap, two digits) and per trinket. */
const GEAR_STEP = 24;
const TRINKET_STEP = 9;

/** A 1 pixel engraved line down the bar: a dark line with a light one to its right. */
function groove(ctx: Ctx, px: number): void {
  fillPx(ctx, fromPx(px), fromPx(2), fromPx(1), fromPx(21), PAL.night1);
  fillPx(ctx, fromPx(px + 1), fromPx(2), fromPx(1), fromPx(21), PAL.night3);
}

/** Text with its top at an art pixel row. */
function rowText(ctx: Ctx, str: string, px: number, row: number, color: string, shadow = false): void {
  text(ctx, str, fromPx(px), fromPx(row), { size: 16, color, baseline: 'top', shadow });
}

/** A small icon whose 8 pixel box starts one pixel above a row of text, so their bottoms line up. */
function rowIcon(ctx: Ctx, name: Parameters<typeof drawIcon>[1], px: number, row: number, color?: string): void {
  drawIcon(ctx, name, fromPx(px + 4), fromPx(row + 3), 'small', color);
}

/** A bar 11 pixels tall around a row of text, with its numbers centered inside it. */
function numberBar(ctx: Ctx, label: string, row: number, frac: number, fill: string, empty: string): void {
  bar(ctx, fromPx(BARS_X), fromPx(row - 2), fromPx(BARS_W), fromPx(11), frac, fill, empty);
  text(ctx, label, fromPx(BARS_X + BARS_W / 2), fromPx(row), { size: 16, color: C.ink, baseline: 'top', align: 'center', shadow: true });
}

// Two small helpers the menu screens share (vendor, shop, sound). They could move to draw.ts.

/** A sunken box inside a panel, in logical units: a 1 pixel dark rim with chamfered corners around a darker floor. */
export function inset(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  fillRR(ctx, x, y, w, h, 1, C.outline);
  fillPx(ctx, x + fromPx(1), y + fromPx(1), w - fromPx(2), h - fromPx(2), PAL.night1);
  // A light line along the bottom inside edge, so the box reads as cut into the panel.
  fillPx(ctx, x + fromPx(1), y + h - fromPx(2), w - fromPx(2), fromPx(1), PAL.night2);
}

/** Splits text into lines no wider than maxWidth (logical units) at a text size, using the pixel font's widths. */
export function splitLines(str: string, maxWidth: number, size = 16): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && textWidth(test, { size }) > maxWidth) {
      out.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

/** The gold a screen shows in its top right corner: a sunken box with a coin and the amount. `right` and `top` are logical units. */
export function purse(ctx: Ctx, right: number, top: number, gold: number): void {
  const label = `${gold}`;
  const w = Math.max(fromPx(36), textWidth(label) + fromPx(20));
  const h = fromPx(14);
  inset(ctx, right - w, top, w, h);
  drawIcon(ctx, 'coin', right - w + fromPx(7), top + fromPx(7), 'small');
  text(ctx, label, right - fromPx(5), top + fromPx(4), { size: 16, color: C.gold, baseline: 'top', align: 'right', shadow: true });
}

export function drawHud(ctx: Ctx, k: Knight, floorNum: number): void {
  // The bar itself and its bottom border: a darker gold line, a gold line, then the outline color.
  fillPx(ctx, 0, 0, W, fromPx(25), C.panel);
  fillPx(ctx, 0, fromPx(25), W, fromPx(1), C.goldDark);
  fillPx(ctx, 0, fromPx(26), W, fromPx(1), C.gold);
  fillPx(ctx, 0, fromPx(27), W, fromPx(1), C.outline);
  for (const x of GROOVES) groove(ctx, x);

  // Floor and level.
  rowText(ctx, `Floor ${floorNum} of ${FINAL_FLOOR}`, FLOOR_X, ROW_A, C.gold, true);
  rowText(ctx, `Level ${k.level}`, FLOOR_X, ROW_B, C.inkDim);

  // Health and XP. The empty part of each bar is the dark tone of its own color.
  const max = maxHp(k);
  const low = k.hp / max <= 0.3;
  numberBar(ctx, `Health ${k.hp} / ${max}`, ROW_A, k.hp / max, low ? C.ember : C.red, PAL.red0);
  const need = xpToNext(k.level);
  numberBar(ctx, `XP ${k.xp} / ${need}`, ROW_B, k.xp / need, PAL.teal1, PAL.teal0);

  // Gold and potions.
  rowIcon(ctx, 'coin', PURSE_X, ROW_A);
  rowText(ctx, `${k.gold}`, PURSE_X + 10, ROW_A, C.gold, true);
  rowIcon(ctx, 'potion', PURSE_X, ROW_B);
  rowText(ctx, `x ${k.potions}`, PURSE_X + 10, ROW_B, C.ink, true);

  // Gear levels on the top row, trinkets under them.
  const gear: ['sword' | 'shield' | 'armor', number][] = [
    ['sword', k.gear.sword],
    ['shield', k.gear.shield],
    ['armor', k.gear.armor],
  ];
  gear.forEach(([name, level], i) => {
    const x = GEAR_X + i * GEAR_STEP;
    rowIcon(ctx, name, x, ROW_A);
    rowText(ctx, `${level}`, x + 10, ROW_A, C.ink, true);
  });
  if (k.trinkets.length) {
    k.trinkets.forEach((id, i) => rowIcon(ctx, 'trinket', GEAR_X + i * TRINKET_STEP, ROW_B, TRINKETS[id].color));
  } else {
    rowText(ctx, 'No trinkets yet', GEAR_X, ROW_B, C.inkFaint);
  }
}
