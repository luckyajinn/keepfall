// Battle art: the castle hall backdrops and the effect sprites of the battle screen.
//
// Everything here is built once, on first use (lazy), and drawn as whole sprites after that.
// Coordinates inside this file are art pixels (the 400 by 300 grid). The screen code in
// battleScreen.ts works in logical units, 2 per art pixel.
//
// The backdrop is one 400 by 200 sprite: a stone wall down to FLOOR_Y, then the flagstone floor.
// Depth comes from tone bands and dithering on whole stones, never from gradients: the wall is a
// step darker toward the top, the floor a step lighter toward the viewer, and the stones around
// each torch are a step or two lighter. The torch flames are separate 3 frame sprites drawn on top.
// The High Hall (the boss fight) is built from the same pieces: bigger blocks, a stone ledge, two
// banners and a throne at the back, bigger torches, and a checkered floor with a red carpet.

import { C, PAL } from '../render/colors';
import { hash2 } from '../render/draw';
import { Painter, Sprite, lazy, makeFrames, makeSprite, spriteFromPixels } from '../render/pixel';
import type { EnemyKind } from '../entities/enemies';
import type { EnemyArt } from '../render/sprites';
import { frameAt } from '../render/sprites/art';
import { art as knightArt } from '../render/sprites/knight';
import { art as ratArt } from '../render/sprites/rat';
import { art as guardArt } from '../render/sprites/guard';
import { art as wispArt } from '../render/sprites/wisp';
import { art as houndArt } from '../render/sprites/hound';
import { art as lurkerArt } from '../render/sprites/lurker';
import { art as bossArt } from '../render/sprites/boss';

/** The backdrop sprite's size in art pixels. */
export const BACK_W = 400;
export const BACK_H = 200;
/** The art pixel row where the floor starts (its back edge). */
export const FLOOR_Y = 148;

export type HallKind = 'hall' | 'high';

/** Where a torch's flame sits, in art pixels: the bottom center of the flame. */
export interface TorchSpot {
  x: number;
  y: number;
}

/** The two torches of each hall. The flame sprite is drawn with its bottom center here. */
export const TORCHES: Record<HallKind, TorchSpot[]> = {
  hall: [
    { x: 36, y: 82 },
    { x: 364, y: 82 },
  ],
  high: [
    { x: 36, y: 80 },
    { x: 364, y: 80 },
  ],
};

// ---------- Tones ----------

/** One tone step of a stone: its face, upper left highlight, lower right shadow and the mortar around it. */
interface Tone {
  face: string;
  hi: string;
  sh: string;
  mortar: string;
}

const STONE: Tone[] = [
  { face: PAL.night1, hi: PAL.night2, sh: PAL.night0, mortar: PAL.night0 },
  { face: PAL.night2, hi: PAL.night3, sh: PAL.night1, mortar: PAL.night0 },
  { face: PAL.night3, hi: PAL.night4, sh: PAL.night2, mortar: PAL.night1 },
  { face: PAL.night4, hi: PAL.wood0, sh: PAL.night3, mortar: PAL.night1 },
  { face: PAL.wood0, hi: PAL.wood1, sh: PAL.night4, mortar: PAL.night2 },
];

const tone = (level: number): Tone => STONE[Math.max(0, Math.min(STONE.length - 1, level))];

/**
 * A level as a whole step plus an optional half step: 1.5 means a stone dithered between
 * levels 1 and 2. Bands and torch pools give fractional levels; whole stones take them.
 */
function stoneLevel(raw: number): { lo: number; dith: boolean } {
  const lo = Math.floor(raw + 0.001);
  return { lo, dith: raw - lo > 0.25 && raw - lo < 0.75 };
}

/**
 * Paints one stone: mortar along its bottom row and right column, a highlight along the top and
 * left, a shadow along the bottom and right, and a flat (or dithered) face. `seed` picks small
 * wear marks so no two stones are quite alike. `calm` makes marks rarer.
 */
function stone(p: Painter, x: number, y: number, w: number, h: number, raw: number, seed: number, calm: boolean): void {
  const { lo, dith } = stoneLevel(raw);
  let level = lo;
  const r = hash2(seed, 17);
  const rare = calm ? 0.5 : 1;
  // A few worn, lighter stones and a few darker ones.
  if (r < 0.06 * rare) level++;
  else if (r > 1 - 0.04 * rare) level--;
  const a = tone(level);
  const b = tone(level + 1);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      let c: string;
      if (j === h - 1 || i === w - 1) c = a.mortar;
      else if (j === 0 || i === 0) c = a.hi;
      else if (j === h - 2 || i === w - 2) c = a.sh;
      else c = dith && (px + py) % 2 === 0 ? b.face : a.face;
      p.px(px, py, c);
    }
  }
  if (w < 6 || h < 5) return;
  // Wear: a chipped corner, or a few pits in the face.
  const m = hash2(seed, 91);
  if (m < 0.08 * rare) {
    p.px(x, y, a.mortar).px(x + 1, y, a.sh).px(x, y + 1, a.sh);
  } else if (m < 0.18 * rare) {
    for (let k = 0; k < 2; k++) {
      const qx = x + 2 + Math.floor(hash2(seed, 30 + k) * (w - 5));
      const qy = y + 2 + Math.floor(hash2(seed, 40 + k) * (h - 5));
      p.px(qx, qy, a.sh);
    }
  }
}

/**
 * The extra light a stone gets from the torches, in whole tone steps: 2 close to a flame, 1 in a
 * wider pool around it, which is wider than it is tall.
 */
function torchLight(cx: number, cy: number, torches: TorchSpot[], reach: number): number {
  let best = 0;
  for (const t of torches) {
    const d = Math.hypot((cx - t.x) * 0.75, cy - (t.y - 8));
    const v = d < reach * 0.45 ? 2 : d < reach ? 1 : 0;
    best = Math.max(best, v);
  }
  return best;
}

// ---------- Wall ----------

interface WallSpec {
  brickH: number;
  widths: number[];
  /** The rows above this y are a step darker (dithered over `bandFade` rows). */
  bandY: number;
  bandFade: number;
  torches: TorchSpot[];
  reach: number;
  /** The art pixel row where the bricks stop and the plinth begins. */
  plinthY: number;
}

/** Brick rows from the top of the picture down to the plinth, in a running bond with uneven lengths. */
function wall(p: Painter, s: WallSpec, salt: number): void {
  let row = 0;
  for (let y = s.plinthY - s.brickH; y > -s.brickH; y -= s.brickH, row++) {
    // Each row starts at its own offset, and brick lengths vary, so joints never line up in a grid.
    let x = -Math.floor(hash2(row, salt) * s.widths[0]) - (row % 2) * Math.floor(s.widths[0] / 2);
    let col = 0;
    while (x < BACK_W) {
      const w = s.widths[Math.floor(hash2(row * 131 + col, salt + 7) * s.widths.length)];
      const cx = x + w / 2;
      const cy = y + s.brickH / 2;
      let raw = 1;
      if (cy < s.bandY) raw = 0;
      else if (cy < s.bandY + s.bandFade) raw = 0.5;
      raw += torchLight(cx, cy, s.torches, s.reach);
      const calm = cx > 110 && cx < 290;
      stone(p, x, y, w, s.brickH, raw, row * 1000 + col + salt * 7919, calm);
      x += w;
      col++;
    }
  }
}

/** The plinth: a stone ledge, a row of long low blocks and a dark contact line where wall meets floor. */
function plinth(p: Painter, y: number, salt: number, torches: TorchSpot[]): void {
  p.hline(0, y, BACK_W, PAL.night0);
  p.hline(0, y + 1, BACK_W, PAL.night4);
  let x = -Math.floor(hash2(3, salt) * 20);
  let col = 0;
  while (x < BACK_W) {
    const w = 28 + Math.floor(hash2(col, salt + 2) * 4) * 4;
    const lit = torchLight(x + w / 2, y, torches, 60) > 0 ? 1 : 0;
    stone(p, x, y + 2, w, 7, 1.5 + lit, col * 31 + salt, true);
    x += w;
    col++;
  }
  p.hline(0, FLOOR_Y - 1, BACK_W, PAL.night0);
}

// ---------- Floor ----------

/** The point the floor joints run toward, above the middle of the picture. */
const VP_X = 200;
const VP_Y = -70;

/** A floor pixel's position along the back edge, so joints fan out toward the viewer. */
function backU(x: number, y: number): number {
  return VP_X + ((x + 0.5 - VP_X) * (FLOOR_Y - VP_Y)) / (y + 0.5 - VP_Y);
}

interface FloorSpec {
  /** Row heights from the back edge down, including each row's top mortar line. */
  rows: number[];
  /** Slab lengths along the back edge, per row. */
  lengths: number[];
  /** The base tone level of each row, back to front. Halves dither. */
  levels: number[];
  /** Alternate slabs a step lighter and darker. */
  checker: boolean;
  torches: TorchSpot[];
  salt: number;
}

function floor(p: Painter, s: FloorSpec): void {
  // The back edge: a lit lip, so the line where the fighters' world begins reads clearly.
  p.hline(0, FLOOR_Y, BACK_W, PAL.wood0);
  let y = FLOOR_Y + 1;
  s.rows.forEach((h, r) => {
    // Joint positions along the back edge for this row.
    const joints: number[] = [];
    const len = s.lengths[r];
    let u = -40 - hash2(r, s.salt) * len;
    for (let k = 0; u < BACK_W + 80; k++) {
      joints.push(u);
      u += len * (0.75 + hash2(k, r + s.salt) * 0.5);
    }
    const slabAt = (uu: number): number => {
      let lo = 0;
      let hi = joints.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (joints[mid] <= uu) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    };
    const ks = new Array<number>(BACK_W + 2);
    for (let j = 0; j < h; j++) {
      const py = y + j;
      for (let x = -1; x <= BACK_W; x++) ks[x + 1] = slabAt(backU(x, py));
      for (let x = 0; x < BACK_W; x++) {
        const k = ks[x + 1];
        const kl = ks[x];
        const kr = ks[x + 2];
        const center = (joints[k] + (joints[k + 1] ?? joints[k] + len)) / 2;
        let raw = s.levels[r];
        if (s.checker) raw += (k + r) % 2 === 0 ? 0.5 : -0.5;
        if (r < 3) raw += torchLight(center, FLOOR_Y + 20, s.torches, 50) > 0 ? 1 : 0;
        const seed = r * 977 + k * 13 + s.salt;
        const wr = hash2(seed, 3);
        const calm = center > 120 && center < 280;
        if (wr < (calm ? 0.04 : 0.1)) raw += 0.5;
        else if (wr > (calm ? 0.97 : 0.92)) raw -= 0.5;
        const { lo, dith } = stoneLevel(raw);
        const a = tone(lo);
        const b = tone(lo + 1);
        let c: string;
        if (j === 0) c = a.mortar;
        else if (kl !== k && x > 0) c = a.mortar;
        else if (j === 1 || kl !== k) c = a.hi;
        else if (j === h - 1 || kr !== k) c = a.sh;
        else c = dith && (x + py) % 2 === 0 ? b.face : a.face;
        p.px(x, py, c);
      }
    }
    // A few cracked slabs, away from the middle.
    for (let k = 0; k < joints.length - 1; k++) {
      const seed = r * 977 + k * 13 + s.salt;
      if (hash2(seed, 77) > 0.18 || h < 7) continue;
      const cu = (joints[k] + joints[k + 1]) / 2;
      if (cu > 130 && cu < 270) continue;
      const cx = Math.round(VP_X + ((cu - VP_X) * (y + h / 2 - VP_Y)) / (FLOOR_Y - VP_Y));
      const cy = y + 2;
      const sh = tone(Math.floor(s.levels[r])).sh;
      for (let q = 0; q < h - 3; q++) p.px(cx + (q % 3 === 2 ? 1 : 0) + Math.floor(q / 3), cy + q, sh);
    }
    y += h;
  });
}

/** The red carpet of the High Hall, running from the throne toward the viewer, with gold edges. */
function carpet(p: Painter): void {
  for (let y = FLOOR_Y + 1; y < BACK_H; y++) {
    for (let x = 150; x < 250; x++) {
      const d = Math.abs(backU(x, y) - VP_X);
      const u = backU(x, y) - VP_X;
      let c: string | null = null;
      if (d < 15) {
        // A diamond pattern woven in, darker toward the edges.
        const dy = (y - FLOOR_Y) % 8;
        const diamond = Math.abs(Math.round(u)) + Math.abs(dy - 4) <= 3;
        c = diamond ? PAL.red0 : PAL.red1;
        if (Math.abs(Math.round(u)) + Math.abs(dy - 4) === 0) c = PAL.gold0;
        if (d > 12) c = (x + y) % 2 === 0 ? PAL.red0 : PAL.red1;
      } else if (d < 17) c = u < 0 ? PAL.gold1 : PAL.gold0;
      else if (d < 18) c = C.outline;
      if (c) p.px(x, y, c);
    }
  }
  // A highlight along the carpet's far end.
  for (let x = 150; x < 250; x++) if (Math.abs(backU(x, FLOOR_Y + 1) - VP_X) < 15) p.px(x, FLOOR_Y + 1, PAL.red2);
}

// ---------- Torches ----------

/** The torch below the flame: a steel cup on a wooden handle, held by a ring on a wall plate. */
function torchBracket(big: boolean): Sprite {
  const w = big ? 16 : 12;
  const h = big ? 26 : 22;
  return makeSprite(w, h, (p) => {
    const m = Math.floor(w / 2);
    // The wall plate behind.
    p.layer((q) => {
      q.rect(m - 3, h - 12, 6, 9, PAL.night4);
      q.shadeForm(PAL.night4, PAL.wood0, PAL.night3);
      q.px(m - 2, h - 11, PAL.steel1).px(m + 1, h - 5, PAL.steel0);
    });
    // The handle, narrower at the bottom.
    p.layer((q) => {
      q.rect(m - 2, 5, 4, h - 10, PAL.wood1);
      q.rect(m - 1, h - 6, 2, 2, PAL.wood1);
      q.shadeForm(PAL.wood1, PAL.wood2, PAL.wood0);
    });
    // The ring around the handle.
    p.layer((q) => {
      q.rect(m - 3, h - 10, 6, 2, PAL.steel1);
      q.hline(m - 3, h - 10, 6, PAL.steel2);
    });
    // The cup that holds the fire.
    p.layer((q) => {
      const cw = big ? 12 : 8;
      q.rect(m - cw / 2, 1, cw, 4, PAL.steel1);
      q.rect(m - cw / 2 + 1, 5, cw - 2, 1, PAL.steel0);
      q.hline(m - cw / 2, 1, cw, PAL.steel2);
      q.vline(m - cw / 2, 1, 4, PAL.steel2);
      q.vline(m + cw / 2 - 1, 2, 3, PAL.steel0);
      if (big) {
        q.px(m - 3, 3, PAL.gold1).px(m + 2, 3, PAL.gold1);
      }
    });
  });
}

/**
 * Three flame frames, w by h, with the base at the bottom center. A teardrop of ember with an
 * ember2, gold and cream core, the tip swaying left, up and right, and a loose spark or two.
 */
function flames(w: number, h: number): Sprite[] {
  const sway = [-1.6, 0, 1.4];
  return makeFrames(3, w, h, (p, f) => {
    const cx = w / 2;
    const layers: [string, number, number][] = [
      [PAL.ember1, 1, 0],
      [PAL.ember2, 0.7, 0.3],
      [PAL.gold2, 0.45, 0.5],
      [PAL.parch2, 0.2, 0.7],
    ];
    const body = h - 3;
    for (const [c, k, start] of layers) {
      for (let j = 0; j < body; j++) {
        const t = j / (body - 1);
        if (t < start) continue;
        const tt = (t - start) / (1 - start);
        const shape = tt < 0.65 ? Math.sqrt(tt / 0.65) : 1 - ((tt - 0.65) / 0.35) ** 2 * 0.45;
        const hw = ((w - 2) / 2) * k * shape;
        const dx = sway[f] * (1 - t) ** 2 * 1.6;
        for (let x = 0; x < w; x++) if (Math.abs(x + 0.5 - (cx + dx)) < hw) p.px(x, j + 2, c);
      }
    }
    p.outline(PAL.ember0);
    // Loose sparks above the flame.
    const sparks = [
      [cx - 2, 1],
      [cx + 1, 0],
      [cx + 2, 2],
    ];
    const [sx, sy] = sparks[f];
    p.px(Math.round(sx), sy, PAL.gold2);
  });
}

export const torchArt = lazy(() => ({
  hall: { bracket: torchBracket(false), flames: flames(10, 16) },
  high: { bracket: torchBracket(true), flames: flames(14, 22) },
}));

// ---------- High Hall pieces ----------

/** A hanging banner: a rod with gold ends, red cloth with gold trim and a crown, and a swallowtail. */
function banner(p: Painter, ox: number, oy: number): void {
  const w = 20;
  const clothH = 56;
  p.layer((q) => {
    q.rect(ox + 3, oy + 3, w, clothH, PAL.red1);
    // The swallowtail: the cloth goes on at the sides and a V is cut from the middle.
    for (let j = 0; j < 9; j++) {
      for (let i = 0; i < w; i++) {
        if (Math.abs(i + 0.5 - w / 2) >= j + 1) q.px(ox + 3 + i, oy + 3 + clothH + j, PAL.red1);
      }
    }
    q.shadeForm(PAL.red1, PAL.red2, PAL.red0, 1, 2);
    // Folds.
    for (const fx of [7, 14]) {
      for (let j = 4; j < clothH + 6; j++) {
        if (q.get(ox + 3 + fx, oy + 3 + j) === PAL.red1) q.px(ox + 3 + fx, oy + 3 + j, PAL.red0);
        if (q.get(ox + 2 + fx, oy + 3 + j) === PAL.red1 && j % 2 === 0) q.px(ox + 2 + fx, oy + 3 + j, PAL.red2);
      }
    }
    // Gold trim along the top and the sides.
    q.hline(ox + 4, oy + 5, w - 2, PAL.gold1);
    q.hline(ox + 4, oy + 6, w - 2, PAL.gold0);
    for (let j = 7; j < clothH; j++) {
      q.px(ox + 5, oy + 3 + j, PAL.gold0);
      q.px(ox + w, oy + 3 + j, PAL.gold0);
    }
    // A crown in the middle.
    const cx = ox + 3 + w / 2;
    const cy = oy + 22;
    q.grid(
      [
        '.Y..Y..Y.',
        '.g..g..g.',
        'Yg.Ygg.gg',
        'Yggggggyg',
        'gggggggyy',
        'gyyyyyyyy',
        '.oooooo..',
      ],
      { Y: PAL.gold2, g: PAL.gold1, y: PAL.gold0, o: PAL.red0 },
      cx - 5,
      cy,
    );
  });
  // The rod over the cloth, with gold knobs.
  p.layer((q) => {
    q.rect(ox + 1, oy + 1, w + 4, 2, PAL.wood1);
    q.hline(ox + 1, oy + 1, w + 4, PAL.wood2);
    q.rect(ox, oy, 2, 4, PAL.gold1);
    q.rect(ox + w + 4, oy, 2, 4, PAL.gold1);
    q.px(ox, oy, PAL.gold2).px(ox + w + 4, oy, PAL.gold2);
  });
}

/** The throne at the back of the High Hall: dark wood posts with gold knobs, a plum back and a pointed crest. */
function throne(p: Painter, ox: number, oy: number): void {
  const w = 64;
  const h = 102;
  // The back panel and the crest.
  p.layer((q) => {
    q.poly([ox + 8, oy + 22, ox + 32, oy + 4, ox + 56, oy + 22, ox + 56, oy + 84, ox + 8, oy + 84], PAL.wood0);
    q.shadeForm(PAL.wood0, PAL.wood1, PAL.night4, 1, 2);
  });
  p.layer((q) => {
    q.poly([ox + 13, oy + 25, ox + 32, oy + 11, ox + 51, oy + 25, ox + 51, oy + 80, ox + 13, oy + 80], PAL.plum1);
    q.shadeForm(PAL.plum1, PAL.plum2, PAL.plum0, 1, 2);
    // Buttoned cushion: a grid of dark studs.
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) q.px(ox + 22 + i * 10 - (j % 2) * 5 + 5, oy + 34 + j * 11, PAL.plum0);
    // A gold sun at the top of the crest.
    q.circle(ox + 32, oy + 24, 3, PAL.gold1);
    q.px(ox + 31, oy + 23, PAL.gold2).px(ox + 33, oy + 26, PAL.gold0).px(ox + 32, oy + 26, PAL.gold0);
  });
  // The posts.
  for (const px of [ox, ox + w - 8]) {
    p.layer((q) => {
      q.rect(px + 1, oy + 16, 6, h - 16, PAL.wood1);
      q.shadeForm(PAL.wood1, PAL.wood2, PAL.wood0, 1, 2);
      q.hline(px + 1, oy + 30, 6, PAL.gold0);
      q.hline(px + 1, oy + 31, 6, PAL.gold1);
    });
    p.layer((q) => {
      q.circle(px + 4, oy + 12, 3, PAL.gold1);
      q.px(px + 3, oy + 10, PAL.gold2).px(px + 2, oy + 11, PAL.gold2).px(px + 5, oy + 14, PAL.gold0).px(px + 6, oy + 13, PAL.gold0);
    });
  }
  // The seat, across the front.
  p.layer((q) => {
    q.rect(ox + 6, oy + 80, w - 12, 8, PAL.wood1);
    q.shadeForm(PAL.wood1, PAL.wood2, PAL.wood0, 1, 2);
    q.hline(ox + 8, oy + 84, w - 16, PAL.gold0);
  });
  p.layer((q) => {
    q.rect(ox + 8, oy + 88, w - 16, h - 88, PAL.night3);
    q.shadeForm(PAL.night3, PAL.night4, PAL.night2);
  });
}

// ---------- Backdrops ----------

function buildHall(): Sprite {
  return makeSprite(BACK_W, BACK_H, (p) => {
    const torches = TORCHES.hall;
    wall(p, { brickH: 8, widths: [12, 16, 16, 16, 20, 24], bandY: 26, bandFade: 18, torches, reach: 54, plinthY: FLOOR_Y - 10 }, 11);
    plinth(p, FLOOR_Y - 10, 5, torches);
    floor(p, {
      rows: [5, 6, 8, 9, 10, 13],
      lengths: [30, 34, 38, 40, 44, 48],
      levels: [1, 2, 2, 2.5, 3, 3],
      checker: false,
      torches,
      salt: 21,
    });
    for (const t of torches) p.stamp(torchArt().hall.bracket, t.x - 6, t.y - 1);
  });
}

function buildHigh(): Sprite {
  return makeSprite(BACK_W, BACK_H, (p) => {
    const torches = TORCHES.high;
    wall(p, { brickH: 12, widths: [20, 24, 24, 28, 32], bandY: 40, bandFade: 24, torches, reach: 58, plinthY: FLOOR_Y - 10 }, 37);
    // A carved stone ledge across the upper wall.
    p.hline(0, 44, BACK_W, PAL.night0);
    p.hline(0, 45, BACK_W, PAL.night4);
    p.hline(0, 46, BACK_W, PAL.night3);
    p.hline(0, 47, BACK_W, PAL.night3);
    for (let x = 0; x < BACK_W; x += 8) p.rect(x + 2, 48, 4, 2, PAL.night2);
    p.hline(0, 50, BACK_W, PAL.night1);
    plinth(p, FLOOR_Y - 10, 9, torches);
    floor(p, {
      rows: [5, 6, 8, 9, 10, 13],
      lengths: [26, 28, 30, 32, 34, 36],
      levels: [1, 2, 2, 2, 2.5, 2.5],
      checker: true,
      torches,
      salt: 43,
    });
    carpet(p);
    // The throne and banners are painted on their own small sprites (their layers stay small), then stamped in.
    p.stamp(makeSprite(64, 102, (q) => throne(q, 0, 0)), 168, FLOOR_Y - 92);
    const flag = makeSprite(26, 70, (q) => banner(q, 0, 0));
    p.stamp(flag, 140, 38);
    p.stamp(flag, 236, 38);
    for (const t of torches) p.stamp(torchArt().high.bracket, t.x - 8, t.y - 1);
  });
}

const hallBackdrop = lazy(buildHall);
const highBackdrop = lazy(buildHigh);

/** The backdrop of a hall, built the first time it is shown. */
export function backdrop(kind: HallKind): Sprite {
  return kind === 'high' ? highBackdrop() : hallBackdrop();
}

// ---------- Fighters ----------

const ENEMY_ART: Record<EnemyKind, () => EnemyArt> = {
  rat: ratArt,
  guard: guardArt,
  wisp: wispArt,
  hound: houndArt,
  lurker: lurkerArt,
  boss: bossArt,
};

/** The battle frame an enemy shows at time t, the same one drawEnemy picks. */
export function enemyFrame(kind: EnemyKind, t: number): Sprite {
  const a = ENEMY_ART[kind]();
  return frameAt(a.large, t, a.frameTime);
}

const footCache = new Map<string, number>();

/**
 * Where a fighter's feet are across its box, in art pixels from the box center: the middle of the
 * opaque pixels in the lowest rows of its first battle frame. The ground shadow is centered there,
 * so it sits under the feet even when the figure is not centered in its box. Measured once per kind.
 */
export function footOffset(kind: EnemyKind | 'knight'): number {
  let v = footCache.get(kind);
  if (v !== undefined) return v;
  const s = kind === 'knight' ? knightArt().large.right.idle[0] : ENEMY_ART[kind]().large[0];
  let bottom = -1;
  for (let y = s.h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < s.w; x++) if (s.pixels[y * s.w + x]) bottom = y;
  let lo = s.w;
  let hi = -1;
  for (let y = Math.max(0, bottom - 5); y <= bottom; y++) {
    for (let x = 0; x < s.w; x++) {
      if (!s.pixels[y * s.w + x]) continue;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  v = hi < 0 ? 0 : Math.round((lo + hi + 1) / 2 - s.w / 2);
  footCache.set(kind, v);
  return v;
}

function ring(w: number, h: number, iw: number, ih: number): Sprite {
  return makeSprite(w, h, (p) => {
    p.ellipse(0, 0, w, h, C.outline);
    p.ellipse((w - iw) / 2, (h - ih) / 2, iw, ih, null);
  });
}

/**
 * Ground shadows: a hard edged core drawn at 50% and a rim around it drawn at 25%, in the outline
 * color. The two never overlap, so each pixel is one flat step over the floor.
 */
export const shadowArt = lazy(() => ({
  normal: { core: makeSprite(32, 6, (p) => p.ellipse(0, 0, 32, 6, C.outline)), rim: ring(44, 8, 32, 6) },
  boss: { core: makeSprite(50, 8, (p) => p.ellipse(0, 0, 50, 8, C.outline)), rim: ring(66, 10, 50, 8) },
}));

// ---------- Effects ----------

/** 4 by 4 ordered dither thresholds, for the dissolve. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const dissolveCache = new WeakMap<Sprite, Sprite[]>();

/**
 * A sprite breaking up in 2 by 2 pixel blocks, for a beaten enemy. Step 0 is whole, steps 1 to 3
 * keep fewer and fewer blocks, and the blocks that go next glow in cream for a frame first.
 * Built once per frame of art, the first time it is needed.
 */
export function dissolved(s: Sprite, step: number): Sprite {
  if (step <= 0) return s;
  let list = dissolveCache.get(s);
  if (!list) {
    list = [s];
    for (let k = 1; k <= 3; k++) {
      const out = s.pixels.map((c, i) => {
        if (c === null) return null;
        const x = i % s.w;
        const y = Math.floor(i / s.w);
        const th = BAYER[((y >> 1) % 4) * 4 + ((x >> 1) % 4)];
        if (th < k * 4) return null;
        if (th === k * 4) return PAL.parch2;
        return c;
      });
      list.push(spriteFromPixels(s.w, s.h, out));
    }
    dissolveCache.set(s, list);
  }
  return list[Math.min(3, step)];
}

/**
 * The Guard effect in front of the knight: a curved teal barrier with a glint that runs down it.
 * Frame 0 is the flash as it appears, frames 1 and 2 the held barrier with the glint moving.
 */
export const barrierArt = lazy(() =>
  makeFrames(3, 15, 38, (p, f) => {
    // A ring segment: the pixels between two circles whose middle is off the left edge,
    // cut off above and below so the ends stay inside the sprite with room for the outline.
    const cx = -8;
    const cy = 19;
    for (let y = 2; y < 36; y++) {
      if (Math.abs(y + 0.5 - cy) > 16) continue;
      for (let x = 1; x < 14; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < 20.5 && d >= 18.5) p.px(x, y, PAL.teal2);
        else if (d < 18.5 && d >= 17) p.px(x, y, PAL.teal1);
        else if (d < 17 && d >= 16 && (x + y) % 2 === 0) p.px(x, y, PAL.teal0);
      }
    }
    if (f === 0) p.swap(PAL.teal1, PAL.teal2).swap(PAL.teal0, PAL.teal2);
    // The glint: a short bright run on the outer edge.
    const gy = f === 2 ? 22 : 10;
    for (let y = gy; y < gy + 4; y++) {
      for (let x = 0; x < 15; x++) if (p.get(x, y) === PAL.teal2) p.px(x, y, PAL.parch2);
    }
    p.outline(C.outline);
  }),
);

/** A small twinkle in a material's three tones: a dot, a cross, then a star. */
function twinkles(hi: string, base: string): Sprite[] {
  const key = { W: PAL.parch2, Y: hi, y: base };
  return [
    makeSprite(3, 3, (p) => p.grid(['...', '.W.', '...'], key)),
    makeSprite(5, 5, (p) => p.grid(['..y..', '..Y..', 'yYWYy', '..Y..', '..y..'], key)),
    makeSprite(7, 7, (p) => p.grid(['...y...', '.y.Y.y.', '..YWY..', 'yYWWWYy', '..YWY..', '.y.Y.y.', '...y...'], key)),
  ];
}

export const sparkArt = lazy(() => ({
  heal: twinkles(PAL.moss2, PAL.moss1),
  gold: twinkles(PAL.gold2, PAL.gold1),
  teal: twinkles(PAL.teal2, PAL.teal1),
}));

/** The plus sign that rises off the knight when a potion heals. */
export const plusArt = lazy(() =>
  makeSprite(9, 9, (p) => {
    for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) if (Math.abs(x - 4) <= 1 || Math.abs(y - 4) <= 1) p.px(x, y, PAL.moss1);
    p.shadeForm(PAL.moss1, PAL.moss2, PAL.moss0);
    p.outline(C.outline);
  }),
);

/**
 * The warning over an enemy that is winding up a heavy blow: an exclamation mark on a small ember
 * sign. Frame 0 is the resting sign, frame 1 is one pixel bigger all round and brighter, so
 * flipping between them pulses.
 */
export const alertArt = lazy(() => {
  const mark = (w: number, h: number, fill: string, light: string, dark: string, ink: string): Sprite =>
    makeSprite(w + 2, h + 5, (p) => {
      // A sign with chamfered corners and a small point under it that aims at the enemy.
      p.rect(1, 2, w, h - 2, fill);
      p.rect(2, 1, w - 2, h, fill);
      const cx = Math.floor((w + 2) / 2);
      p.rect(cx - 1, h + 1, 3, 1, fill).px(cx, h + 2, fill);
      p.shadeForm(fill, light, dark, 1, 1);
      // The exclamation mark: a bar 3 pixels wide, narrowing at its foot, then the dot.
      const top = 3;
      const barH = h - 9;
      p.rect(cx - 1, top, 3, barH, ink);
      p.rect(cx, top + barH, 1, 1, ink);
      p.rect(cx - 1, top + barH + 2, 3, 2, ink);
      p.outline(C.outline);
    });
  return [mark(11, 15, PAL.ember1, PAL.ember2, PAL.ember0, PAL.parch2), mark(13, 17, PAL.gold1, PAL.gold2, PAL.gold0, PAL.red0)];
});
