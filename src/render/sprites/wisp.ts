// Tallow Wisp: a living candle flame on a stub of wax, floating a little above the ground.
//
// Light in this art style is flat color only, so the flame sells its light by shape and tone:
// an ember outer flame, a gold inner flame, a pale gold core, a silhouette that changes every
// frame, a few spark pixels that come and go, and a dithered ring of light on the ground.
//
// Small (16 by 16): character grids, one flame shape per frame over a shared wax stub.
// Large (64 by 64): painter calls. The flame is three nested teardrops, the wax a shaded stub
// with drips. Both sizes play the same loop: three flame shapes, and the body bobs a pixel.

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';

const E = PAL.ember2;
const e = PAL.ember1;
const f = PAL.ember0;
const Y = PAL.gold2;
const g = PAL.gold1;
const y = PAL.gold0;
const P = PAL.parch2;
const p = PAL.parch1;
const q = PAL.parch0;
const o = C.outline;

const KEY = { E, e, f, Y, g, y, P, p, q, o };

/** The loop: which flame shape each frame shows, and whether the body bobs down a pixel. */
const SHAPES = [0, 1, 2, 1];
const BOB = [0, 0, 1, 1];

// ---------- Small: 16 by 16 ----------
// Rows 1 to 9 are the flame (one set per shape), rows 10 to 12 the wax. Row 15 holds the ground ring.

const SMALL_FLAME = [
  [
    '................',
    '........E.......',
    '.......Ee.......',
    '......EEef......',
    '.....EegYef.....',
    '....EegYYgef....',
    '....EeoYYoef....',
    '....EgYYYYgf....',
    '....eegYYgff....',
    '.....ffggff.....',
  ],
  [
    '................',
    '......E.........',
    '......Ee........',
    '......EEe.......',
    '.....EegYf......',
    '....EegYYgef....',
    '....EeoYYoeff...',
    '....EgYYYYgff...',
    '....eegYYgff....',
    '.....ffggff.....',
  ],
  [
    '................',
    '.........E......',
    '........EE......',
    '...E...EEef.....',
    '...Ee.EegYef....',
    '....EEegYYgef...',
    '....EeoYYoef....',
    '....EgYYYYgf....',
    '....eegYYgff....',
    '.....ffggff.....',
  ],
];

const SMALL_WAX = [
  '.....PPppPq.....',
  '.....Pppppq.....',
  '......ppppq.....',
];

/** Spark pixels per shape: [x, y]. They are light, so they have no outline. */
const SMALL_SPARKS: [number, number][][] = [[[11, 2]], [[3, 3], [10, 1]], [[12, 3], [2, 1]]];

/** The ring of light on the ground, row 15: a checker of the darker gold and ember tones. */
function groundRing(pt: Painter, x0: number, x1: number, row: number, wide: boolean): void {
  for (let x = x0; x <= x1; x++) {
    const inner = x >= x0 + 2 && x <= x1 - 2;
    if ((x + row) % 2 === 0) pt.px(x, row, inner ? y : f);
    else if (wide && inner) pt.px(x, row, f);
  }
}

function smallFrame(i: number): Sprite {
  return makeSprite(16, 16, (pt) => {
    const dy = BOB[i];
    pt.grid(SMALL_FLAME[SHAPES[i]], KEY, 0, dy);
    pt.grid(SMALL_WAX, KEY, 0, 10 + dy);
    pt.outline(o);
    for (const [sx, sy] of SMALL_SPARKS[SHAPES[i]]) pt.px(sx, sy + dy, Y);
    groundRing(pt, 4, 11, 15, false);
  });
}

// ---------- Large: 64 by 64 ----------

interface FlameShape {
  /** Column of the tip, and its row. */
  tip: number;
  top: number;
  /** Side tongues of flame: [x, y, height, leans right]. */
  tongues: [number, number, number, boolean][];
  /** Spark blocks: [x, y]. */
  sparks: [number, number][];
}

const LARGE_SHAPES: FlameShape[] = [
  { tip: 35, top: 3, tongues: [[17, 31, 14, false], [40, 22, 8, true]], sparks: [[50, 9], [10, 13]] },
  { tip: 27, top: 5, tongues: [[41, 29, 15, true], [19, 23, 7, false]], sparks: [[15, 7], [54, 26]] },
  { tip: 33, top: 1, tongues: [[16, 28, 11, false], [42, 31, 11, true]], sparks: [[23, 2], [54, 14]] },
];

/** A teardrop: a round bottom of w by h pixels with its top left at (x, yy), drawn up to a tip at (tx, ty). */
function teardrop(pt: Painter, x: number, yy: number, w: number, h: number, tx: number, ty: number, c: string): void {
  pt.ellipse(x, yy, w, h, c);
  const mid = yy + Math.floor(h / 2);
  // The sides bow outward a little on the way up to the tip.
  const lx = x + Math.round(w * 0.12);
  const rx = x + w - Math.round(w * 0.12);
  const sy = Math.round(ty + (mid - ty) * 0.45);
  pt.poly([tx, ty, tx + 1, ty, rx, sy, x + w, mid, x, mid, lx, sy], c);
}

function largeBody(pt: Painter, s: FlameShape): void {
  // The wax stub: a melted lip at the top, a round stub below, and drips that stop partway down.
  pt.layer((z) => {
    z.rect(23, 44, 18, 14, p);
    z.rect(21, 45, 22, 3, p);
    z.rect(21, 48, 2, 3, p);
    z.rect(41, 48, 2, 2, p);
    z.vline(22, 51, 1, p);
    // Light from the upper left: a pale left side and lip, a shadowed right side.
    z.rect(23, 48, 2, 10, P);
    z.hline(21, 45, 12, P);
    z.rect(21, 46, 2, 4, P);
    z.rect(38, 48, 3, 10, q);
    z.rect(41, 46, 2, 4, q);
    z.hline(25, 48, 13, q);
    // A drip down the front, pale with a shadow on its right and under its drop.
    z.rect(30, 48, 2, 5, P);
    z.vline(32, 49, 4, q);
    z.rect(30, 53, 3, 1, q);
  });
  // The outer flame, with its tongues.
  pt.layer((z) => {
    teardrop(z, 17, 18, 30, 28, s.tip, s.top, e);
    for (const [tx, ty, th, right] of s.tongues) {
      // A tongue grows out of the flame's side and curls outward and up to a point.
      const out = right ? 1 : -1;
      const half = Math.round(th / 2);
      z.poly([tx, ty + 3, tx + 6, ty + 3, tx + 3 + out * 4, ty - half, tx + 3 + out * 5, ty - th, tx + 3 + out * 3, ty - th, tx + 3 + out * 1, ty - half], e);
    }
    z.edge(e, f, 'dr', 3);
    z.edge(e, E, 'ul', 2);
    // The gold inner flame and the pale core.
    teardrop(z, 22, 26, 20, 19, Math.round((s.tip + 32) / 2), s.top + 11, g);
    z.edge(g, y, 'dr', 1);
    teardrop(z, 26, 32, 12, 11, Math.round((s.tip + 3 * 32) / 4), s.top + 20, Y);
    // Streaks of the bright ember tone rising through the outer flame.
    z.line(21, 32, Math.round((s.tip + 21) / 2), s.top + 13, E);
    z.line(25, 21, Math.round((s.tip * 3 + 25) / 4), s.top + 6, E);
  });
  // Eyes: small and dark, set in the core, looking right, each with one glint.
  for (const ex of [27, 35]) {
    pt.rect(ex, 34, 3, 4, o);
    pt.px(ex + 1, 33, o);
    pt.px(ex + 1, 34, P);
  }
}

function largeFrame(i: number): Sprite {
  return makeSprite(64, 64, (pt) => {
    const s = LARGE_SHAPES[SHAPES[i]];
    const body = new Painter(64, 64);
    largeBody(body, s);
    // Sparks: two by two blocks of the palest gold with an ember pixel trailing below.
    for (const [sx, sy] of s.sparks) {
      body.layer((z) => {
        z.rect(sx, sy, 2, 2, Y);
        z.px(sx + 1, sy + 1, E);
      });
    }
    pt.stamp(body, 0, BOB[i]);
    // The ring of light on the floor: a wide checker of dark ember, with darker gold nearer the middle.
    const ring = new Painter(64, 64);
    ring.ellipse(13, 59, 38, 5, f);
    ring.ellipse(19, 60, 26, 3, y);
    for (let yy = 59; yy < 64; yy++) {
      for (let xx = 0; xx < 64; xx++) {
        const c = ring.get(xx, yy);
        if (c === null || (xx + yy) % 2 !== 0 || pt.get(xx, yy) !== null) continue;
        pt.px(xx, yy, c);
      }
    }
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: SHAPES.map((_, i) => smallFrame(i)),
  large: SHAPES.map((_, i) => largeFrame(i)),
  frameTime: 0.15,
}));
