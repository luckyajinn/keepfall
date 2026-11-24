// The floor map's tiles: stone floor, walls, pillars, the stairs, torches and ground shadows.
//
// Every tile is a 16 by 16 sprite built once (see the art rules in pixel.ts). The map does not
// draw them one by one each frame. buildFloorArt() lays the still tiles of a whole floor into one
// picture, once per floor, adds the edges where walls meet floor, and keeps it at five light
// levels. The map then copies each tile from the level its light calls for. Light is made by
// stepping colors down the brown ramp (darker() in colors.ts), with a checker of the two
// neighboring steps for the half levels, so the lit and dark map both stay inside the color set.
//
// Light comes from the upper left: stones and bricks get their highlight on the upper left edges,
// and walls throw a short shadow onto the floor below them and to their right.

import { C, PAL, darker, parseColor } from './colors';
import { Sprite, lazy, makeFrames, makeSprite } from './pixel';

/** Tile size in art pixels. */
export const TILE_PX = 16;

/**
 * Number of light levels. 0 is full light, 2 is one ramp step darker and 4 two steps. The odd
 * levels are a checker of the two levels around them, for the dithered edge of the light.
 */
export const LIGHT_LEVELS = 5;

/** How many ramp steps darker the pixel (x, y) is at a light level. */
function levelSteps(level: number, x: number, y: number): number {
  return (level >> 1) + (level & 1 && (x + y) % 2 === 0 ? 1 : 0);
}

const darkCache = new Map<string, string>();

/** A color stepped `n` steps down its ramp. */
function dim(c: string, n: number): string {
  if (n <= 0) return c;
  const key = `${c} ${n}`;
  let v = darkCache.get(key);
  if (!v) {
    v = c;
    for (let i = 0; i < n; i++) v = darker(v);
    darkCache.set(key, v);
  }
  return v;
}

// Stone floor: joints, base and two highlights.
const FLOOR_KEY = { a: PAL.night2, b: PAL.night3, c: PAL.night4, d: PAL.wood0 };

// Four flagstones, the joints staggered between the top and bottom pair.
const FLOOR_PLAIN = [
  'ccccbbbacccbbbba',
  'cbbbbbbacbbbbbba',
  'bbbbbbbabbbbbbba',
  'bbbbbbbabbbbbbba',
  'bbbbbbbabbbbbbba',
  'bbbbbbbabbbbbbba',
  'bbbbbbbabbbbbbba',
  'aaaaaaaaaaaaaaaa',
  'cccbbbbbbbbacccb',
  'cbbbbbbbbbbacbbb',
  'bbbbbbbbbbbabbbb',
  'bbbbbbbbbbbabbbb',
  'bbbbbbbbbbbabbbb',
  'bbbbbbbbbbbabbbb',
  'bbbbbbbbbbbabbbb',
  'aaaaaaaaaaaaaaaa',
];

// One wide slab over two small stones.
const FLOOR_SLAB = [
  'ccccccbbbbbbbbba',
  'cbbbbbbbbbbbbbba',
  'cbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'aaaaaaaaaaaaaaaa',
  'ccbbbaccccbbbbbb',
  'cbbbbacbbbbbbbbb',
  'bbbbbabbbbbbbbbb',
  'bbbbbabbbbbbbbbb',
  'bbbbbabbbbbbbbbb',
  'aaaaaaaaaaaaaaaa',
];

// The plain stones with a crack running across the lower left one.
const FLOOR_CRACK = [
  'ccccbbbacccbbbba',
  'cbbbbbbacbbbbbba',
  'bbbbbbbabbbbbbba',
  'bbbbbbbabbbabbba',
  'bbbbbbbabbbbabba',
  'bbbbbbbabbbbbbba',
  'bbbbbbbabbbbbbba',
  'aaaaaaaaaaaaaaaa',
  'cccbbbbbbbbacccb',
  'cbbabbbbbbbacbbb',
  'bbbbabbbbbbabbbb',
  'bbbbbaabbbbabbbb',
  'bbbbbbbabbbabbbb',
  'bbbbbbbbabbabbbb',
  'bbbbbbbbbbbabbbb',
  'aaaaaaaaaaaaaaaa',
];

// The slab with a small pebble and a worn, darker patch.
const FLOOR_PEBBLE = [
  'ccccccbbbbbbbbba',
  'cbbbbbbbbbbbbbba',
  'cbbbbbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'bbbbbbbbbbdcbbba',
  'bbbabbbbbbcabbba',
  'bbababbbbbbbbbba',
  'bbbabbbbbbbbbbba',
  'bbbbbbbbbbbbbbba',
  'aaaaaaaaaaaaaaaa',
  'ccbbbaccccbbbbbb',
  'cbbbbacbbbbbbbbb',
  'bbbbbabbbbbbbbbb',
  'bbbbbabbbbbbbbbb',
  'bbbbbabbbbbbbbbb',
  'aaaaaaaaaaaaaaaa',
];

// Wall face: the front of a wall seen from above. A light top course, then bricks in two
// staggered courses with mortar lines, then the dark foot of the wall where it meets the floor.
const WALL_KEY = { k: PAL.night1, m: PAL.night2, n: PAL.night3, B: PAL.night4, w: PAL.wood0, W: PAL.wood1 };

const WALL_FACE = [
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  'nnnnnnnnnnnnnnnn',
  'mmmmmmmmmmmmmmmm',
  'wwwwwwwmwwwwwwwm',
  'wBBBBBnmwBBBBBnm',
  'BBBBBBnmBBBBBBnm',
  'nnnnnnnmnnnnnnnm',
  'mmmmmmmmmmmmmmmm',
  'wwwmwwwwwwwmwwww',
  'BBnmwBBBBBnmwBBB',
  'BBnmBBBBBBnmBBBB',
  'nnnmnnnnnnnmnnnn',
  'mmmmmmmmmmmmmmmm',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
];

// The same face with one brick a shade darker and one chipped, for variety along a long wall.
const WALL_FACE_WORN = [
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  'nnnnnnnnnnnnnnnn',
  'mmmmmmmmmmmmmmmm',
  'wwwwwwwmnnnnnnnm',
  'wBBBBBnmnnnnnnmm',
  'BBBBBBnmnnnnnnmm',
  'nnnnnnnmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'wwwmwwwwwwwmwwww',
  'BBnmwBBmmBBnmwBB',
  'BBnmBBBBmBnmBBBB',
  'nnnmnnnnnnnmnnnn',
  'mmmmmmmmmmmmmmmm',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
];

// A free standing pillar, 16 by 22: a stone cap, a round shaft of stacked drums lit from the
// left, and a foot. Its foot stands on the bottom of its tile and its cap reaches 6 pixels up
// into the tile above, so it is drawn with the characters, back to front, not with the floor.
const PILLAR = [
  '................',
  '.WWWWWWWWWWWWWw.',
  '.WwwwwwwwwwwwwB.',
  '.wBBBBBBBBBBBBn.',
  '.nnnnnnnnnnnnnm.',
  '...mmmmmmmmmmm..',
  '...WwwBBBBBnnm..',
  '...wwBBBBBnnnm..',
  '...wwBBBBBnnnm..',
  '...mmmmmmmmmmm..',
  '...WwwBBBBBnnm..',
  '...wwBBBBBnnnm..',
  '...wwBBBBBnnnm..',
  '...mmmmmmmmmmm..',
  '...WwwBBBBBnnm..',
  '...wwBBBBBnnnm..',
  '...wwBBBBBnnnm..',
  '...mmmmmmmmmmm..',
  '..WWwwwwwwwwnnm.',
  '..wBBBBBBBBBnnm.',
  '..nnnnnnnnnnnnm.',
  '................',
];

/** How far the pillar sprite reaches above its tile, in pixels. */
export const PILLAR_RISE = 6;

// The stairs up: a dark opening at the top, four steps that widen and brighten toward the
// viewer between two wooden rails, and gold caps and a gold threshold that catch the eye.
const STAIRS_KEY = {
  o: C.outline,
  k: PAL.night1,
  m: PAL.night2,
  n: PAL.night3,
  B: PAL.night4,
  w: PAL.wood0,
  W: PAL.wood1,
  V: PAL.wood2,
  g: PAL.gold0,
  G: PAL.gold1,
  Y: PAL.gold2,
};

const STAIRS = [
  'oooooooooooooooo',
  'oGGokkkkkkkkoGGo',
  'oGgokkkkkkkkoGgo',
  'oWwomnnnnnnmowBo',
  'oWwokkkkkkkkowBo',
  'oWwoBwwwwwwBowBo',
  'oWwonBBBBBBnowBo',
  'oWwowWWWWWWwowBo',
  'oWwoBwwwwwwBowBo',
  'oWwWVVVVVVVVWwBo',
  'oWwWWWWWWWWWWwBo',
  'oWwgGGGGGGGGgwBo',
  'oWwgggggggggwwBo',
  'oGGYYYYYYYYYYGGo',
  'oGgGGGGGGGGGGGgo',
  'oooooooooooooooo',
];

/**
 * The glint that climbs the stairs, one tread per frame: the rows it lights, and the color.
 * Frame 0 lights the threshold, frame 1 the gold step, frame 2 the top wooden step.
 */
const STAIRS_GLINT: [number, string][] = [
  [13, PAL.parch2],
  [11, PAL.gold2],
  [9, PAL.parch2],
];

// Torch flame frames, 5 pixels wide, keyed f ember0, e ember1, E ember2, Y gold2.
const FLAME_KEY = { f: PAL.ember0, e: PAL.ember1, E: PAL.ember2, Y: PAL.gold2 };
const FLAMES = [
  ['..f..', '.fe..', '.eEf.', 'feYEf', 'fEYEf', '.eEe.'],
  ['...f.', '..ef.', '.fEe.', 'feYEf', 'fEYEf', '.eEe.'],
  ['.....', '.f...', '.eE..', 'fEYef', 'fEYEf', '.eEe.'],
];

// The iron bracket and wooden cup under the flame, 7 pixels wide.
const BRACKET_KEY = { w: PAL.wood0, W: PAL.wood1, s: PAL.steel1, d: PAL.steel0, S: PAL.steel2 };
const BRACKET = ['.WWWww.', '..Wwd..', '...s...', '..Ssd..', '..sdd..'];

export interface TileArt {
  /** Floor variants: plain, slab, cracked, pebble. */
  floor: Sprite[];
  /** Wall faces: plain and worn. */
  face: Sprite[];
  /** The wall top, the dark mass between rooms: plain and speckled. */
  top: Sprite[];
  /** The pillar at each light level (see LIGHT_LEVELS). */
  pillar: Sprite[];
  /** Three frames of the glinting stairs. */
  stairs: Sprite[];
  /** Three frames of a torch on a wall face, drawn over the face tile. */
  torch: Sprite[];
  /** A small hard edged ground shadow (14 by 3) and the boss's (20 by 4). Drawn at 75%. */
  shadow: Sprite;
  shadowBig: Sprite;
}

export const tileArt: () => TileArt = lazy(() => ({
  floor: [FLOOR_PLAIN, FLOOR_SLAB, FLOOR_CRACK, FLOOR_PEBBLE].map((rows) => makeSprite(16, 16, (p) => p.grid(rows, FLOOR_KEY))),
  face: [WALL_FACE, WALL_FACE_WORN].map((rows) => makeSprite(16, 16, (p) => p.grid(rows, WALL_KEY))),
  top: [
    makeSprite(16, 16, (p) => p.rect(0, 0, 16, 16, PAL.night1)),
    makeSprite(16, 16, (p) => {
      p.rect(0, 0, 16, 16, PAL.night1);
      p.px(3, 4, PAL.night2).px(4, 4, PAL.night2).px(11, 10, PAL.night2).px(9, 13, PAL.night2);
    }),
  ],
  pillar: Array.from({ length: LIGHT_LEVELS }, (_, level) =>
    makeSprite(16, PILLAR.length, (p) => {
      p.grid(PILLAR, WALL_KEY);
      p.outline(C.outline);
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) {
          const c = p.get(x, y);
          if (c) p.px(x, y, dim(c, levelSteps(level, x, y)));
        }
      }
    }),
  ),
  stairs: makeFrames(3, 16, 16, (p, i) => {
    p.grid(STAIRS, STAIRS_KEY);
    const [row, color] = STAIRS_GLINT[i];
    // A short bright streak, two pixels, moving along the tread a little each frame.
    const x = 5 + i * 3;
    p.px(x, row, color).px(x + 1, row, color);
    // The rail caps sparkle on the middle frame.
    if (i === 1) p.px(1, 1, PAL.gold2).px(13, 1, PAL.gold2);
  }),
  torch: makeFrames(3, 16, 16, (p, i) => {
    p.grid(FLAMES[i], FLAME_KEY, 5, 1);
    p.grid(BRACKET, BRACKET_KEY, 4, 7);
    p.outline(C.outline);
  }),
  shadow: makeSprite(14, 3, (p) => {
    p.rect(2, 0, 10, 3, C.shadow);
    p.rect(0, 1, 14, 1, C.shadow);
  }),
  shadowBig: makeSprite(20, 4, (p) => {
    p.rect(4, 0, 12, 4, C.shadow);
    p.rect(1, 1, 18, 2, C.shadow);
  }),
}));

/** Seconds per stairs frame and per torch frame. */
export const STAIRS_FRAME = 0.22;
export const TORCH_FRAME = 0.12;

// The whole floor, laid out once.

/** What a tile is for drawing: walkable floor (including the stairs), or a kind of wall. A pillar's tile holds floor; the pillar is drawn with the characters. */
export const Cell = { Floor: 0, Top: 1, Face: 2, Pillar: 3 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];


export interface FloorArt {
  /** The still tiles of the whole floor, one canvas per light level, each 400 by 272. */
  levels: HTMLCanvasElement[];
  /** What each tile is, row by row. */
  cells: Cell[];
}


let canvases: HTMLCanvasElement[] | null = null;
let builtFor: unknown = null;

/** Who the five level canvases were last built for (the `owner` given to buildFloorArt). */
export function floorArtOwner(): unknown {
  return builtFor;
}

/**
 * Lays out the still tiles of a floor: floor stones, wall tops, faces, pillars, and the edges
 * where they meet. `isWall(x, y)` must return true outside the map. `pick(x, y)` gives a stable
 * value from 0 to 1 per tile that chooses the variants. Call it once per floor, not per frame:
 * it reuses the same five canvases each time, so only one floor's art exists at a time.
 * floorArtOwner() then returns `owner`, so a caller can tell when another floor took them over.
 */
export function buildFloorArt(
  cols: number,
  rows: number,
  isWall: (x: number, y: number) => boolean,
  pick: (x: number, y: number) => number,
  owner: unknown,
): FloorArt {
  builtFor = owner;
  const art = tileArt();
  const W = cols * TILE_PX;
  const H = rows * TILE_PX;
  const buf: string[] = new Array<string>(W * H).fill(PAL.night1);
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c;
  };
  const get = (x: number, y: number) => buf[y * W + x];
  const stamp = (s: Sprite, ox: number, oy: number) => {
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const c = s.pixels[j * s.w + i];
        if (c !== null) put(ox + i, oy + j, c);
      }
    }
  };
  /** Darkens one pixel by a ramp step. `checker` only touches every other pixel. */
  const shade = (x: number, y: number, checker = false) => {
    if (checker && (x + y) % 2 === 1) return;
    put(x, y, darker(get(x, y)));
  };

  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let cell: Cell = Cell.Floor;
      if (isWall(x, y)) {
        if (isWall(x, y + 1)) cell = Cell.Top;
        else if (!isWall(x - 1, y) && !isWall(x + 1, y) && !isWall(x, y - 1)) cell = Cell.Pillar;
        else cell = Cell.Face;
      }
      cells.push(cell);
    }
  }
  const floorAt = (x: number, y: number) => !isWall(x, y);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const sx = x * TILE_PX;
      const sy = y * TILE_PX;
      const cell = cells[y * cols + x];
      const h = pick(x, y);
      if (cell === Cell.Floor || cell === Cell.Pillar) {
        // Mostly plain stones, with a slab, a crack or a pebble here and there.
        const v = h < 0.55 ? 0 : h < 0.8 ? 1 : h < 0.9 ? 2 : 3;
        stamp(art.floor[v], sx, sy);
      }
      if (cell === Cell.Top) {
        stamp(art.top[h > 0.7 ? 1 : 0], sx, sy);
        // A lit rim where the top of a wall meets the floor beside or above it.
        const left = floorAt(x - 1, y);
        const right = floorAt(x + 1, y);
        const up = floorAt(x, y - 1);
        if (left) for (let j = 0; j < 16; j++) put(sx, sy + j, PAL.night3), put(sx + 1, sy + j, PAL.night2);
        if (right) for (let j = 0; j < 16; j++) put(sx + 15, sy + j, PAL.night3), put(sx + 14, sy + j, PAL.night2);
        if (up) for (let i = 0; i < 16; i++) put(sx + i, sy, PAL.night3), put(sx + i, sy + 1, PAL.night2);
        // Corners: where the floor only touches diagonally, the rim turns the corner.
        const corner = (dx: number, dy: number, px: number, py: number) => {
          if (floorAt(x + dx, y + dy) && !floorAt(x + dx, y) && !floorAt(x, y + dy)) {
            put(sx + px, sy + py, PAL.night3);
            put(sx + px + (px === 0 ? 1 : -1), sy + py, PAL.night2);
            put(sx + px, sy + py + (py === 0 ? 1 : -1), PAL.night2);
          }
        };
        corner(-1, -1, 0, 0);
        corner(1, -1, 15, 0);
        corner(-1, 1, 0, 15);
        corner(1, 1, 15, 15);
      }
      if (cell === Cell.Face) {
        stamp(art.face[h > 0.8 ? 1 : 0], sx, sy);
        // The ends of a wall: lit on the left end, in shade on the right end.
        if (floorAt(x - 1, y)) for (let j = 0; j < 14; j++) put(sx, sy + j, j < 2 ? PAL.wood1 : PAL.wood0);
        if (floorAt(x + 1, y)) for (let j = 0; j < 14; j++) put(sx + 15, sy + j, PAL.night2);
        // A wall face with floor right above it is a thin wall: give its top course an edge.
        if (floorAt(x, y - 1)) for (let i = 0; i < 16; i++) put(sx + i, sy, PAL.night2);
      }
    }
  }

  // Shadows on the floor: walls throw a short hard shadow down and to the right. Two rows (or
  // columns) a full step darker, then one row dithered, so the edge reads without a gradient.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (cells[y * cols + x] !== Cell.Floor) continue;
      const sx = x * TILE_PX;
      const sy = y * TILE_PX;
      const above = cells[(y - 1) * cols + x];
      const wallAbove = y > 0 && above !== Cell.Floor;
      const wallLeft = x > 0 && cells[y * cols + x - 1] !== Cell.Floor;
      if (wallAbove) {
        // Under a pillar the shadow is narrower, the width of its foot.
        const pillar = above === Cell.Pillar;
        const x0 = pillar ? 3 : 0;
        const x1 = pillar ? 15 : 16;
        for (let i = x0; i < x1; i++) {
          shade(sx + i, sy);
          shade(sx + i, sy + 1);
          shade(sx + i, sy + 2, true);
        }
      }
      if (wallLeft) {
        const y0 = wallAbove ? 3 : 0;
        for (let j = y0; j < 16; j++) {
          shade(sx, sy + j);
          shade(sx + 1, sy + j, true);
        }
      }
    }
  }

  // The five light levels (see LIGHT_LEVELS).
  if (!canvases) {
    canvases = [];
    for (let i = 0; i < LIGHT_LEVELS; i++) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      canvases.push(c);
    }
  }
  // Colors as small numbers, and each one's red, green and blue at 0, 1 and 2 steps darker.
  const ids = new Map<string, number>();
  const rgb: number[][][] = [];
  const idBuf = new Uint8Array(W * H);
  for (let i = 0; i < buf.length; i++) {
    let id = ids.get(buf[i]);
    if (id === undefined) {
      id = rgb.length;
      ids.set(buf[i], id);
      rgb.push([0, 1, 2].map((n) => parseColor(dim(buf[i], n)).slice(0, 3)));
    }
    idBuf[i] = id;
  }
  for (let level = 0; level < LIGHT_LEVELS; level++) {
    const canvas = canvases[level];
    const g = canvas.getContext('2d')!;
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = rgb[idBuf[i]][levelSteps(level, x, y)];
        d[i * 4] = c[0];
        d[i * 4 + 1] = c[1];
        d[i * 4 + 2] = c[2];
        d[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  return { levels: canvases, cells };
}
