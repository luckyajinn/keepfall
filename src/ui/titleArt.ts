// Pixel art for the title, How to play, end and reward screens: the dusk backdrop behind the
// keep, the hand made logo, the little scenes behind the end screen pictures, and a few small
// interface pieces. Everything is built once, on first use, and drawn with drawSprite.
//
// The backdrop is one 400 by 300 picture (the whole pixel grid): a dusk sky in flat bands with
// dithered steps between them, a low sun with two dithered halo rings, a few stars, the keep,
// and three rows of hills. The keep's lit windows (2 frames) and its flag (3 frames) are small
// sprites drawn over it. A darker copy of all of it, recolored within the color set, sits behind
// the win screen.
import { C, PAL } from '../render/colors';
import { CAP_H, DESC, drawText, measureText, textLog } from '../render/font';
import { Painter, Sprite, fromPx, lazy, makeFrames, makeSprite, recolor } from '../render/pixel';

// ---------- Dithering ----------

/**
 * True where a pixel takes the second color in an ordered 2 by 2 dither at `level` quarters:
 * 1 is one pixel in four, 2 is a checker, 3 is three in four.
 */
function dot(x: number, y: number, level: number): boolean {
  const ex = (x & 1) === 0;
  const ey = (y & 1) === 0;
  if (level <= 0) return false;
  if (level === 1) return ex && ey;
  if (level === 2) return ex === ey;
  if (level === 3) return !(!ex && ey);
  return true;
}

// ---------- The sky ----------

/** The sky bands, top down: the row each one starts on and its color. */
const BANDS: readonly [number, string][] = [
  [0, PAL.night1],
  [50, PAL.night2],
  [100, PAL.plum0],
  [142, PAL.red0],
  [196, PAL.ember0],
  [216, PAL.ember1],
  [232, PAL.ember2],
];
/** Each band blends into the one above it over this many rows (three dither steps of 2 rows). */
const BLEND = 6;

function skyAt(x: number, y: number): string {
  let i = 0;
  while (i + 1 < BANDS.length && y >= BANDS[i + 1][0]) i++;
  const next = BANDS[i + 1];
  if (next && y >= next[0] - BLEND) {
    const level = Math.floor((y - (next[0] - BLEND)) / 2) + 1;
    return dot(x, y, level) ? next[1] : BANDS[i][1];
  }
  return BANDS[i][1];
}

// ---------- Layout of the backdrop, in art pixels ----------

/** The sun: a hard disc low in the valley between the knight's hill and the keep. */
const SUN = { x: 206, y: 232, r: 15 };

const bump = (x: number, c: number, w: number): number => Math.exp(-(((x - c) / w) ** 2));

/** The top row of the far ridge, the middle hill under the keep and the near hill, for each column. */
const farY = (x: number): number => Math.round(240 + 3 * Math.sin(x / 31) + 2 * Math.sin(x / 13 + 1) - 5 * bump(x, 40, 50) - 3 * bump(x, 330, 60));
const midY = (x: number): number => Math.round(277 - 13 * bump(x, 305, 105) - 4 * bump(x, 160, 26) - 6 * bump(x, 30, 34) + 2 * Math.sin(x / 11));
const nearY = (x: number): number => Math.round(292 - 12 * bump(x, 96, 82) + 2 * bump(x, 250, 50) - 7 * bump(x, 392, 46));

/** The ground the keep stands on. */
const KEEP_BASE = 270;

/** Lit windows: [x, y] of the top left of a 3 by 5 arched window. */
const WINDOWS: readonly [number, number][] = [
  [249, 142],
  [249, 178],
  [291, 106],
  [307, 106],
  [299, 146],
  [291, 190],
  [361, 156],
  [275, 222],
  [331, 222],
];
/** Dark arrow slits, 1 by 4. */
const SLITS: readonly [number, number][] = [
  [250, 210],
  [300, 176],
  [362, 190],
  [268, 202],
  [338, 202],
];

/** The top of the flag pole on the central tower. */
const POLE = { x: 300, top: 56, bottom: 82 };

// ---------- Keep ----------

/** A row of merlons along the top of a wall: `x` to `x + w`, standing on row `y`. */
function merlons(p: Painter, x: number, y: number, w: number, c: string): void {
  // Merlons 4 wide with gaps of 3, centered on the wall.
  const n = Math.floor((w + 3) / 7);
  const used = n * 7 - 3;
  const ox = x + Math.floor((w - used) / 2);
  for (let i = 0; i < n; i++) p.rect(ox + i * 7, y - 5, 4, 5, c);
}

/** A tower body with a corbelled top and merlons. */
function tower(p: Painter, x: number, w: number, top: number, c: string): void {
  p.rect(x, top, w, KEEP_BASE - top, c);
  // The corbel: the top 4 rows stand out a pixel on each side, on a row of small brackets.
  p.rect(x - 2, top - 1, w + 4, 4, c);
  for (let i = x - 1; i < x + w + 1; i += 3) p.px(i, top + 3, c);
  merlons(p, x - 2, top - 1, w + 4, c);
}

/** A pointed roof from (x, y) for `w` columns, rising `h` rows. */
function cone(p: Painter, x: number, y: number, w: number, h: number, c: string): void {
  const mid = x + (w - 1) / 2;
  for (let j = 0; j < h; j++) {
    const half = Math.round(((j + 1) / h) * (w / 2));
    p.rect(Math.round(mid - half + 0.5), y - h + j, half * 2, 1, c);
  }
}

function paintKeep(p: Painter): void {
  const body = PAL.night1;
  p.layer((q) => {
    // The curtain wall, then the towers in front of it.
    q.rect(260, 188, 90, KEEP_BASE - 188, body);
    merlons(q, 260, 188, 90, body);
    tower(q, 240, 22, 124, body);
    tower(q, 352, 24, 138, body);
    cone(q, 348, 133, 32, 30, body);
    q.rect(347, 133, 34, 2, body);
    tower(q, 282, 38, 86, body);
    // Light from the upper left: a lighter line down the left of each tower, shadow on the right.
    // The sun is low on the left, so the left edges catch a thin rim of its light.
    q.edge(body, PAL.night2, 'l', 2);
    q.edge(PAL.night2, PAL.night3, 'l', 1);
    q.edge(body, PAL.night2, 'u', 1);
    q.edge(body, PAL.night0, 'r', 1);
    // Courses of stone, a few short lines.
    for (let y = 132; y < KEEP_BASE; y += 9) {
      for (let x = 242 + ((y / 9) % 2) * 4; x < 376; x += 13) {
        if (q.get(x, y) === body && q.get(x + 3, y) === body && ((x * 7 + y) % 5) < 3) q.hline(x, y, 3, PAL.night2);
      }
    }
    // Tower bands where the walls step in.
    q.hline(241, 166, 20, PAL.night0).hline(283, 132, 36, PAL.night0).hline(353, 180, 22, PAL.night0);
  }, C.outline);
  // The roof gets its own tones: the left slope, toward the sun, lit with a sparse pattern of tiles.
  for (let j = 103; j < 133; j++) {
    for (let i = 346; i < 364; i++) {
      const c = p.get(i, j);
      if (c === PAL.night1 || c === PAL.night2) p.px(i, j, (i + j) % 3 === 0 ? PAL.night3 : PAL.night2);
    }
  }
  // The flag pole.
  p.vline(POLE.x, POLE.top, POLE.bottom - POLE.top, PAL.night0);
  p.px(POLE.x, POLE.top - 1, PAL.gold0);
  // The gate: an arch with warm light inside and a portcullis half raised.
  const gx = 292;
  const gw = 17;
  const gy = 244;
  p.rect(gx - 2, gy - 2, gw + 4, KEEP_BASE - gy + 2, PAL.night0);
  p.rect(gx, gy, gw, KEEP_BASE - gy, PAL.ember0);
  // The arch: cut the top corners in steps.
  for (const [dx, n] of [[0, 4], [1, 2], [2, 1], [3, 1]] as const) {
    for (let k = 0; k < n; k++) {
      p.px(gx + dx, gy + k, PAL.night0);
      p.px(gx + gw - 1 - dx, gy + k, PAL.night0);
    }
  }
  p.rect(gx + 3, gy + 6, gw - 6, KEEP_BASE - gy - 6, PAL.ember1);
  p.rect(gx + 5, gy + 12, gw - 10, KEEP_BASE - gy - 12, PAL.ember2);
  for (let x = gx + 2; x < gx + gw - 1; x += 3) p.vline(x, gy + 1, 10, PAL.night1);
  p.hline(gx + 1, gy + 4, gw - 2, PAL.night1).hline(gx + 1, gy + 8, gw - 2, PAL.night1);
  for (let x = gx + 2; x < gx + gw - 1; x += 3) p.px(x, gy + 11, PAL.night0);
  // Dark slits.
  for (const [x, y] of SLITS) p.vline(x, y, 4, PAL.night0);
  // Window frames: a dark arched hole, filled with light by the window sprites.
  for (const [x, y] of WINDOWS) {
    p.rect(x - 1, y, 6, 7, PAL.night0);
    p.hline(x, y - 1, 4, PAL.night0);
    // A stone sill under each window.
    p.hline(x - 1, y + 7, 6, PAL.night3);
  }
}

// ---------- Trees and hills ----------

/** A pine in silhouette: a trunk and tiers of branches, lit on the left. */
function pine(p: Painter, x: number, base: number, h: number, c: string, lit: string): void {
  p.vline(x, base - 2, 3, c);
  const tiers = Math.max(2, Math.round(h / 4));
  for (let j = 0; j < h; j++) {
    // Each tier flares out a little wider than the one above it.
    const tier = (j % Math.ceil(h / tiers)) + 1;
    const half = Math.min(Math.floor(j / 2.5) + 1, Math.round(tier * 0.9 + j / 4));
    const y = base - 2 - h + j;
    p.hline(x - half, y, half * 2 + 1, c);
    if (half > 0) p.px(x - half, y, lit);
  }
  p.px(x, base - 3 - h, c);
}

function paintHills(p: Painter): void {
  // The far ridge, lighter, lit along its top by the sun.
  for (let x = 0; x < 400; x++) {
    const top = farY(x);
    for (let y = top; y < 300; y++) {
      // A lit rim, then the ridge, fading into the haze below in three dither steps.
      let c: string = PAL.night3;
      if (y < top + 1) c = PAL.ember0;
      else if (y < top + 3 && dot(x, y, 2)) c = PAL.red0;
      else if (y >= top + 10) c = dot(x, y, Math.min(4, Math.floor((y - top - 10) / 3) + 1)) ? PAL.night2 : PAL.night3;
      p.px(x, y, c);
    }
  }
  // A few small pines along the far ridge.
  for (const x of [18, 25, 132, 141, 150, 384, 392]) pine(p, x, farY(x) + 2, 7 + (x % 3), PAL.night2, PAL.night3);
}

function paintNearHills(p: Painter): void {
  // The hill under the keep.
  for (let x = 0; x < 400; x++) {
    const top = midY(x);
    for (let y = top; y < 300; y++) {
      // A lit crest, then night2 darkening to night1 over four dither steps.
      let c: string = PAL.night2;
      if (y === top) c = PAL.night3;
      else if (y > top + 6 || (y > top + 2 && dot(x, y, y - top - 2))) c = PAL.night1;
      p.px(x, y, c);
    }
  }
  for (const x of [196, 204, 212, 226, 384]) pine(p, x, midY(x) + 2, 11 + (x % 4), PAL.night1, PAL.night2);
  // The near hill, where the knight stands, darkest of all.
  for (let x = 0; x < 400; x++) {
    const top = nearY(x);
    for (let y = top; y < 300; y++) {
      let c: string = PAL.night1;
      if (y === top) c = PAL.night2;
      else if (y > top + 3) c = dot(x, y, Math.min(4, Math.floor((y - top - 3) / 2))) ? PAL.night0 : PAL.night1;
      p.px(x, y, c);
    }
  }
  // Grass tufts along the near crest.
  for (const x of [22, 41, 58, 74, 131, 146, 171, 208, 236, 281, 318, 347, 371]) {
    const top = nearY(x);
    p.px(x, top - 1, PAL.night2).px(x + 2, top - 1, PAL.night2).px(x + 1, top - 2, PAL.night2);
  }
}

// ---------- Sun, stars and clouds ----------

function paintSun(p: Painter): void {
  const { x: sx, y: sy, r } = SUN;
  for (let y = sy - r - 16; y <= sy + r + 16; y++) {
    for (let x = sx - r - 16; x <= sx + r + 16; x++) {
      const d = Math.hypot(x + 0.5 - sx - 0.5, y + 0.5 - sy - 0.5);
      if (d <= r + 0.4) p.px(x, y, y > sy + 4 ? PAL.gold1 : PAL.gold2);
      else if (d <= r + 5) p.px(x, y, dot(x, y, 2) ? PAL.gold1 : p.get(x, y));
      else if (d <= r + 12) p.px(x, y, dot(x, y, 1) ? PAL.ember2 : p.get(x, y));
    }
  }
  // A thin band of cloud across the lower half of the disc.
  p.hline(sx - r - 3, sy + 4, 2 * r + 7, PAL.ember1);
  p.hline(sx - r + 3, sy + 9, 2 * r - 3, PAL.ember1);
}

const STARS: readonly [number, number, number][] = [
  // x, y, kind: 0 dim, 1 bright, 2 a small cross.
  [196, 14, 2],
  [233, 34, 0],
  [262, 9, 1],
  [301, 27, 0],
  [328, 12, 2],
  [356, 40, 1],
  [383, 18, 0],
  [214, 58, 0],
  [372, 66, 1],
  [182, 40, 1],
  [12, 96, 0],
  [90, 8, 0],
  [150, 22, 0],
  [246, 78, 0],
  [394, 88, 0],
];

function paintStars(p: Painter): void {
  for (const [x, y, k] of STARS) {
    if (k === 2) {
      p.px(x, y, PAL.parch2);
      p.px(x - 1, y, PAL.parch0).px(x + 1, y, PAL.parch0).px(x, y - 1, PAL.parch0).px(x, y + 1, PAL.parch0);
    } else {
      p.px(x, y, k === 1 ? PAL.parch1 : PAL.parch0);
    }
  }
}

/** Long thin clouds, dark on top and lit from below by the sun. */
function cloud(p: Painter, x: number, y: number, w: number, body: string, lit: string): void {
  // A long lens: rows grow wider toward the bottom, which is lit, with a small puff on top.
  p.hline(x + Math.round(w * 0.3), y - 3, Math.round(w * 0.22), body);
  p.hline(x + Math.round(w * 0.18), y - 2, Math.round(w * 0.5), body);
  p.hline(x + Math.round(w * 0.08), y - 1, Math.round(w * 0.78), body);
  p.hline(x, y, w, body);
  p.hline(x + 4, y + 1, w - 10, lit);
}

function paintClouds(p: Painter): void {
  // Dark against the band they float in, with the underside lit in the band's warmer neighbor.
  cloud(p, 226, 124, 84, PAL.night2, PAL.red0);
  cloud(p, 318, 168, 82, PAL.plum0, PAL.ember0);
  cloud(p, 178, 204, 60, PAL.red0, PAL.ember1);
  cloud(p, -10, 114, 56, PAL.night2, PAL.red0);
}

// ---------- The backdrop ----------

/** The whole title backdrop, 400 by 300, without the animated windows and flag. */
export const backdrop: () => Sprite = lazy(() =>
  makeSprite(400, 300, (p) => {
    for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) p.px(x, y, skyAt(x, y));
    paintStars(p);
    paintClouds(p);
    paintSun(p);
    paintHills(p);
    paintKeep(p);
    paintNearHills(p);
  }),
);

/** Where the window and flag sprites go, in art pixels. */
export const WINDOW_AT = { x: 247, y: 104 };
export const FLAG_AT = { x: POLE.x, y: POLE.top - 1 };

/** The lit windows, 2 frames that differ in a few windows only, so the light seems to flicker. */
export const windowFrames: () => Sprite[] = lazy(() =>
  makeFrames(2, 120, 130, (p, f) => {
    WINDOWS.forEach(([x, y], i) => {
      const wx = x - WINDOW_AT.x;
      const wy = y - WINDOW_AT.y;
      const dim = (i + f) % 3 === 0;
      // An arched window, 4 by 6, split by a mullion, warmer at the bottom.
      p.rect(wx, wy + 1, 4, 5, dim ? PAL.ember1 : PAL.gold1);
      p.hline(wx + 1, wy, 2, dim ? PAL.ember1 : PAL.gold1);
      p.hline(wx, wy + 5, 4, dim ? PAL.ember0 : PAL.ember1);
      if (!dim) p.px(wx + 1, wy + 1, PAL.gold2).px(wx + 1, wy + 2, PAL.gold2);
      p.vline(wx + 2, wy + 1, 5, PAL.night0);
    });
  }),
);

/** The flag on the central tower, waving in 3 frames: a wave of one pixel runs out along the cloth. */
export const flagFrames: () => Sprite[] = lazy(() =>
  makeFrames(3, 15, 10, (p, f) => {
    const len = 12;
    const h = 6;
    // How far each column hangs down: the two columns at the pole stay put.
    const drop = (i: number): number => (i < 2 ? 0 : (i + 9 - f * 3) % 8 < 4 ? 0 : 1);
    for (let i = 0; i < len; i++) {
      const top = 1 + drop(i);
      const prev = i > 0 ? drop(i - 1) : drop(i);
      // A column that steps down is turned away from the light; one that steps up catches it.
      const body = drop(i) > prev ? PAL.red0 : drop(i) < prev ? PAL.red2 : PAL.red1;
      for (let j = 0; j < h; j++) {
        let c: string = body;
        if (j === 0 && body !== PAL.red0) c = PAL.red2;
        if (j === h - 1) c = body === PAL.red2 ? PAL.red1 : PAL.red0;
        // A notch in the end of the flag.
        if (i === len - 1 && (j === 2 || j === 3)) continue;
        p.px(1 + i, top + j, c);
      }
    }
    // A gold square near the pole.
    p.rect(3, 3 + drop(3), 2, 2, PAL.gold1).px(3, 3 + drop(3), PAL.gold2).px(4, 4 + drop(4), PAL.gold0);
    p.outline(C.outline);
    // The pole stands in for the outline on the left.
    for (let j = 0; j < 10; j++) p.px(0, j, null);
  }),
);

/** How the win screen darkens the backdrop: each color one step deeper into the night, within the set. */
const DUSK: Readonly<Record<string, string>> = {
  [PAL.night1]: PAL.night0,
  [PAL.night2]: PAL.night1,
  [PAL.night3]: PAL.night2,
  [PAL.plum0]: PAL.night1,
  [PAL.red0]: PAL.plum0,
  [PAL.ember0]: PAL.red0,
  [PAL.ember1]: PAL.ember0,
  [PAL.ember2]: PAL.ember1,
  [PAL.gold2]: PAL.ember2,
  [PAL.gold1]: PAL.ember1,
  [PAL.gold0]: PAL.ember0,
  [PAL.parch2]: PAL.parch0,
  [PAL.parch1]: PAL.parch0,
  [PAL.parch0]: PAL.night4,
  [PAL.red2]: PAL.red1,
  [PAL.red1]: PAL.red0,
};

/** The backdrop pieces, normal or darkened for the win screen. */
export function backdropParts(dark: boolean): { sky: Sprite; windows: Sprite[]; flag: Sprite[] } {
  const sky = backdrop();
  const windows = windowFrames();
  const flag = flagFrames();
  if (!dark) return { sky, windows, flag };
  return { sky: recolor(sky, DUSK), windows: windows.map((w) => recolor(w, DUSK)), flag: flag.map((s) => recolor(s, DUSK)) };
}

// ---------- The logo ----------

export const LOGO_TEXT = 'KeepFall';
const LOGO_SCALE = 4;

/**
 * The KeepFall logo: the game font's own letters at 4 times, each stroke bevelled in three golds
 * (lit on the upper left), standing on a 2 pixel ember block below and right, all in one outline.
 */
export const logo: () => Sprite = lazy(() => {
  const w = measureText(LOGO_TEXT, LOGO_SCALE);
  const h = (CAP_H + DESC) * LOGO_SCALE;
  // The letter shapes, read back from the font.
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  drawText(g, LOGO_TEXT, 0, 0, { scale: LOGO_SCALE, color: PAL.gold1, baseline: 'top' });
  if (import.meta.env.DEV) textLog.pop();
  const data = g.getImageData(0, 0, w, h).data;
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 128;
  return makeSprite(w + 5, h + 5, (p) => {
    const ox = 1;
    const oy = 1;
    // The block under the letters.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!on(x, y)) continue;
        p.px(ox + x + 1, oy + y + 1, PAL.ember0);
        p.px(ox + x + 2, oy + y + 2, PAL.red0);
        p.px(ox + x + 1, oy + y + 2, PAL.red0);
      }
    }
    // The face.
    const face = new Painter(p.w, p.h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) face.px(ox + x, oy + y, PAL.gold1);
    face.edge(PAL.gold1, PAL.gold0, 'dr', 1);
    face.edge(PAL.gold1, PAL.gold2, 'ul', 1);
    // The lower part of the capitals a step darker, a band across the whole word.
    for (let y = oy + 18; y < oy + 28; y++) for (let x = 0; x < p.w; x++) if (face.get(x, y) === PAL.gold2 && y > oy + 19) face.px(x, y, PAL.gold1);
    p.stamp(face, 0, 0);
    p.outline(C.outline);
  });
});

/** A small four pointed sparkle that glints on the logo now and then: 3 frames, growing. */
export const sparkleFrames: () => Sprite[] = lazy(() =>
  makeFrames(3, 7, 7, (p, f) => {
    p.px(3, 3, PAL.parch2);
    if (f >= 1) p.px(2, 3, PAL.gold2).px(4, 3, PAL.gold2).px(3, 2, PAL.gold2).px(3, 4, PAL.gold2);
    if (f >= 2) p.px(1, 3, PAL.gold1).px(5, 3, PAL.gold1).px(3, 1, PAL.gold1).px(3, 5, PAL.gold1);
  }),
);

/** The logo's size in logical units. */
export function logoSize(): { w: number; h: number } {
  const s = logo();
  return { w: fromPx(s.w), h: fromPx(s.h) };
}

// ---------- Small interface pieces ----------

/** A bullet mark for lists: a small gold diamond, 5 by 5 with its outline. */
export const bullet: () => Sprite = lazy(() =>
  makeSprite(5, 5, (p) => {
    p.grid(['.Y.', 'Ygy', '.y.'], { Y: PAL.gold2, g: PAL.gold1, y: PAL.gold0 }, 1, 1);
    p.outline(C.outline);
  }),
);

/** A short gold divider with a diamond in the middle, `w` pixels wide and 7 tall. */
export const divider = (w: number): Sprite =>
  makeSprite(w, 7, (p) => {
    const m = Math.floor(w / 2);
    p.hline(1, 3, w - 2, PAL.gold0);
    p.hline(4, 3, w - 8, PAL.gold1);
    p.layer((q) => q.grid(['..Y..', '.YGg.', 'YGggy', '.gyy.', '..y..'], { Y: PAL.gold2, G: PAL.gold2, g: PAL.gold1, y: PAL.gold0 }, m - 2, 1));
    p.px(0, 3, PAL.gold0).px(w - 1, 3, PAL.gold0);
  });

// ---------- End screen scenes ----------

export type StageKind = 'win' | 'lose' | 'gaveUp';

/** The size of the scene behind the end screen picture, in art pixels, with its frame. */
export const STAGE_W = 132;
export const STAGE_H = 108;
/** How far the floor line sits above the bottom of the scene. Characters stand on it. */
export const STAGE_FLOOR = 14;

function paintWall(p: Painter, x0: number, y0: number, w: number, h: number, stone: string, mortar: string, lit: string): void {
  p.rect(x0, y0, w, h, stone);
  for (let y = y0; y < y0 + h; y += 7) {
    p.hline(x0, y, w, mortar);
    const off = ((y - y0) / 7) % 2 === 0 ? 0 : 6;
    for (let x = x0 + off; x < x0 + w; x += 12) {
      p.vline(x, y, 7, mortar);
      // A lit top edge on every stone.
      p.hline(x + 1, y + 1, 10, lit);
    }
  }
}

/** The scene behind the end screen picture: a hall of the keep. Built once per kind. */
const stages = new Map<StageKind, Sprite>();

export function stage(kind: StageKind): Sprite {
  let s = stages.get(kind);
  if (s) return s;
  s = makeSprite(STAGE_W, STAGE_H, (p) => {
    const iw = STAGE_W - 4;
    const ih = STAGE_H - 4;
    const floorY = 2 + ih - STAGE_FLOOR;
    // The back wall.
    if (kind === 'lose') paintWall(p, 2, 2, iw, floorY - 2, PAL.night1, PAL.night0, PAL.night2);
    else paintWall(p, 2, 2, iw, floorY - 2, PAL.night2, PAL.night1, PAL.night3);
    // The floor: flagstones in rows that get wider toward the front.
    const floorTop = kind === 'lose' ? PAL.night2 : PAL.night3;
    const floorBase = kind === 'lose' ? PAL.night1 : PAL.night2;
    p.rect(2, floorY, iw, STAGE_H - 2 - floorY, floorBase);
    p.hline(2, floorY, iw, floorTop);
    p.hline(2, floorY + 5, iw, PAL.night0);
    for (let x = 6; x < iw; x += 14) p.vline(x, floorY + 1, 4, PAL.night0);
    for (let x = 0; x < iw; x += 20) p.vline(x + 2, floorY + 6, ih + 2 - floorY - 6, PAL.night0);
    p.hline(2, floorY - 1, iw, PAL.night0);
    if (kind === 'win') {
      // Two red banners with gold trim and torches between them.
      for (const bx of [16, STAGE_W - 30]) {
        p.layer((q) => {
          q.rect(bx, 8, 14, 50, PAL.red1);
          q.edge(PAL.red1, PAL.red0, 'r', 2);
          q.edge(PAL.red1, PAL.red2, 'l', 1);
          // A swallow tail: a V cut into the bottom.
          q.hline(bx + 4, 57, 6, null).hline(bx + 5, 56, 4, null).hline(bx + 6, 55, 2, null);
          q.hline(bx, 8, 14, PAL.gold1);
          q.hline(bx, 11, 14, PAL.gold0);
          // A gold chevron, like the knight's.
          q.rect(bx + 6, 24, 2, 1, PAL.gold2).rect(bx + 5, 25, 4, 1, PAL.gold1).rect(bx + 4, 26, 2, 1, PAL.gold1).rect(bx + 8, 26, 2, 1, PAL.gold0);
        });
        p.hline(bx - 2, 7, 18, PAL.wood0).px(bx - 3, 7, PAL.wood1).px(bx + 16, 7, PAL.wood1);
      }
      // A torch on each side of the knight.
      for (const tx of [42, STAGE_W - 44]) {
        p.layer((q) => {
          q.rect(tx, 40, 3, 8, PAL.wood1).vline(tx + 2, 40, 8, PAL.wood0);
          q.rect(tx - 1, 39, 5, 2, PAL.steel0);
          q.rect(tx, 33, 3, 6, PAL.ember1).px(tx + 1, 31, PAL.ember1).px(tx + 1, 32, PAL.ember2);
          q.vline(tx + 1, 34, 4, PAL.gold2).px(tx, 37, PAL.ember2);
        });
      }
    } else if (kind === 'gaveUp') {
      // An open door in the back wall, with daylight beyond.
      const dx = STAGE_W / 2 - 14;
      p.rect(dx - 3, 14, 34, floorY - 14, PAL.night0);
      p.rect(dx, 18, 28, floorY - 18, PAL.ember1);
      for (const [cx, n] of [[0, 4], [1, 2], [2, 1], [3, 1]] as const) {
        for (let k = 0; k < n; k++) {
          p.px(dx + cx, 18 + k, PAL.night0);
          p.px(dx + 27 - cx, 18 + k, PAL.night0);
        }
      }
      p.rect(dx + 4, 26, 20, floorY - 26, PAL.ember2);
      p.rect(dx + 8, 36, 12, floorY - 36, PAL.gold2);
      // The light falls through the door onto the floor, as a dithered patch.
      for (let y = floorY; y < floorY + 10; y++) {
        const spread = Math.floor((y - floorY) / 2);
        for (let x = dx - spread; x < dx + 28 + spread; x++) if (dot(x, y, y < floorY + 4 ? 2 : 1)) p.px(x, y, PAL.night4);
      }
    } else {
      // Chains with shackles hang on the wall of a cold cell.
      for (const cx of [22, STAGE_W - 24]) {
        for (let y = 2; y < 34; y += 4) {
          p.vline(cx, y, 2, PAL.steel1).px(cx + 1, y, PAL.steel0);
          p.px(cx - 1, y + 2, PAL.steel0).px(cx + 1, y + 2, PAL.steel0).px(cx, y + 3, PAL.night0);
        }
        p.frame(cx - 2, 34, 5, 4, PAL.steel1);
        p.px(cx + 2, 37, PAL.steel0).hline(cx - 1, 37, 3, PAL.steel0);
      }
    }
    // The frame: an outline, then a gold line inside it.
    p.frame(0, 0, STAGE_W, STAGE_H, C.outline);
    p.frame(1, 1, STAGE_W - 2, STAGE_H - 2, PAL.gold0);
    p.px(1, 1, C.outline).px(STAGE_W - 2, 1, C.outline).px(1, STAGE_H - 2, C.outline).px(STAGE_W - 2, STAGE_H - 2, C.outline);
  });
  stages.set(kind, s);
  return s;
}
