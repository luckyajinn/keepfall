// Pixel painting tools: the toolbox every sprite, tile, icon and panel in the game is drawn with.
//
// THE ART RULES (decided by the owner; every drawing in the game follows them)
//
// 1. True low resolution. The game renders on a 400 by 300 pixel grid that the page scales up
//    with nearest neighbor, so every art pixel is a crisp square. Screen code still lays things
//    out in 800 by 600 "logical" units: one art pixel is 2 logical units (PX). main.ts scales the
//    context by 0.5, so a logical position lands on the grid when it is a multiple of 2.
// 2. One fixed color set. Only the 32 colors in colors.ts (PAL, and the older names in C).
//    Each material has a shadow, a base and a highlight tone. The outline is C.outline, a very
//    dark brown, never pure black.
// 3. No smoothing of any kind. No anti-aliasing, no gradients, no blur, no soft glows, no curves
//    drawn with canvas paths, no fractional positions, no rotating or free scaling at draw time.
//    Text may be drawn at whole multiples of its size. Transparency of a whole thing is allowed
//    only in flat steps of 0, 25%, 50%, 75% and 100% (stepAlpha), for a dimmed screen or a fading
//    sprite. Inside a sprite every pixel is either fully on or fully off.
// 4. Characters have a 1 pixel dark outline (Painter.outline), three flat tones per material,
//    light from the upper left (highlight on the upper left edges, shadow on the lower right),
//    and a clear silhouette. Small sprites are 16 by 16 pixels, one map tile. Large battle
//    sprites are 64 by 64. The boss is 32 by 32 small and 96 by 96 large. Icons are 8 by 8 small
//    and 24 by 24 large.
// 5. The interface uses flat dark panels with a two line pixel border (a gold outer line and a
//    darker inner line), square or 1 pixel chamfered corners, a small pixel arrow as the menu
//    cursor, and bars with a 1 pixel border and a 1 pixel highlight line.
// 6. One pixel font (font.ts), drawn in code, capitals 7 pixels tall, proportional. 1 times for
//    normal text, 2 times for headings, 3 or 4 times for the title logo.
// 7. Original work. The general 16-bit era feel is the goal, not a likeness of any one game.
//
// HOW TO USE IT
//
// - Build a sprite once, when its module loads or on first use, never per frame:
//     const rat = makeSprite(16, 16, (p) => { p.grid(ROWS, KEY); p.outline(C.outline); });
// - Draw it each frame with drawSprite(ctx, rat, x, y, { center: true, flip, alpha, tint }).
//   Positions are logical units and are snapped to the pixel grid. Flipped and tinted copies
//   are made once and cached.
// - Painter coordinates are art pixels inside the sprite, with (0, 0) at the top left.
//   A color is any value from PAL or C. null means transparent.

import { C, PALETTE, parseColor } from './colors';

/** Logical units per art pixel. */
export const PX = 2;
/** The size of the pixel grid the game renders on. */
export const ART_W = 400;
export const ART_H = 300;

type Ctx = CanvasRenderingContext2D;

/** A logical coordinate moved to the nearest art pixel edge. snap(215) is 216. */
export function snap(v: number): number {
  return Math.round(v / PX) * PX;
}

/** A logical coordinate as a whole art pixel. toPx(215) is 108. */
export function toPx(v: number): number {
  return Math.round(v / PX);
}

/** An art pixel as a logical coordinate. fromPx(108) is 216. */
export function fromPx(p: number): number {
  return p * PX;
}

/** Rounds an alpha to the nearest allowed step: 0, 0.25, 0.5, 0.75 or 1. */
export function stepAlpha(a: number): number {
  if (!(a > 0)) return 0;
  return Math.min(1, Math.round(a * 4) / 4);
}

/** A small pre-drawn image at native pixel size. Made by makeSprite. Never change one after it is made. */
export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  /** Width and height in art pixels. */
  readonly w: number;
  readonly h: number;
  /** The color of each pixel, row by row, or null where it is transparent. */
  readonly pixels: readonly (string | null)[];
}

/** Which sides of a shape an edge() call works on: any of u (up), d (down), l (left), r (right). */
export type Sides = string;

const warned = new Set<string>();

function checkColor(c: string): void {
  if (!import.meta.env.DEV || warned.has(c) || PALETTE.includes(c)) return;
  warned.add(c);
  console.warn(`pixel.ts: ${c} is not in the color set (colors.ts)`);
}

/**
 * Draws hard edged pixels into a sprite being built. Every call works in whole art pixels and
 * clips to the sprite. Get one from makeSprite.
 */
export class Painter {
  /** The color of each pixel, row by row. null is transparent. */
  readonly buf: (string | null)[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.buf = new Array<string | null>(w * h).fill(null);
  }

  /** The color at (x, y), or null when transparent or outside the sprite. */
  get(x: number, y: number): string | null {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.buf[y * this.w + x];
  }

  /** One pixel. A null color clears it. */
  px(x: number, y: number, c: string | null): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    if (c !== null) checkColor(c);
    this.buf[y * this.w + x] = c;
    return this;
  }

  /** A filled rectangle with its top left pixel at (x, y). */
  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }

  /** The 1 pixel border of a rectangle. */
  frame(x: number, y: number, w: number, h: number, c: string | null): this {
    this.hline(x, y, w, c).hline(x, y + h - 1, w, c);
    return this.vline(x, y, h, c).vline(x + w - 1, y, h, c);
  }

  /** A row of `len` pixels going right from (x, y). */
  hline(x: number, y: number, len: number, c: string | null): this {
    return this.rect(x, y, len, 1, c);
  }

  /** A column of `len` pixels going down from (x, y). */
  vline(x: number, y: number, len: number, c: string | null): this {
    return this.rect(x, y, 1, len, c);
  }

  /** A 1 pixel line between two pixels, both ends included (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: string | null): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** A filled ellipse that fits the box with its top left at (x, y), w by h pixels. Hard edged. */
  ellipse(x: number, y: number, w: number, h: number, c: string | null): this {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const nx = (x + i + 0.5 - cx) / rx;
        const ny = (y + j + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1.0001) this.px(x + i, y + j, c);
      }
    }
    return this;
  }

  /** A filled circle around the pixel (cx, cy), 2r + 1 pixels across. Small ones come out round, not square. */
  circle(cx: number, cy: number, r: number, c: string | null): this {
    const lim = r * r + r * 0.8;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= lim) this.px(cx + i, cy + j, c);
    return this;
  }

  /**
   * A filled polygon, hard edged. `pts` is a flat list of corners in pixel edge coordinates:
   * [x0, y0, x1, y1, ...]. A pixel is filled when its center is inside.
   * For a shape that covers whole pixels, put corners on pixel edges (a square from 2 to 6 covers pixels 2 to 5).
   */
  poly(pts: readonly number[], c: string | null): this {
    const n = pts.length / 2;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let k = 0; k < n; k++) {
      minY = Math.min(minY, pts[k * 2 + 1]);
      maxY = Math.max(maxY, pts[k * 2 + 1]);
    }
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let k = 0; k < n; k++) {
        const ax = pts[k * 2];
        const ay = pts[k * 2 + 1];
        const bx = pts[((k + 1) % n) * 2];
        const by = pts[((k + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 < xs[k + 1]; x++) this.px(x, y, c);
      }
    }
    return this;
  }

  /**
   * A checker of two colors over a rectangle, for a 50% blend between two tones.
   * The pixel at (x, y) with x + y even gets `a`, the others get `b`. A null `b` leaves those pixels as they are.
   */
  dither(x: number, y: number, w: number, h: number, a: string | null, b: string | null = null): this {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const even = (x + i + y + j) % 2 === 0;
        if (even) this.px(x + i, y + j, a);
        else if (b !== null) this.px(x + i, y + j, b);
      }
    }
    return this;
  }

  /** Inside a rectangle, turns every other pixel of color `from` into `to` (a checker), for a soft step between two tones. */
  ditherSwap(from: string, to: string, x = 0, y = 0, w = this.w, h = this.h): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if ((i + j) % 2 === 0 && this.get(i, j) === from) this.px(i, j, to);
    return this;
  }

  /**
   * Paints from rows of characters, the main way to author small sprites. Each character is looked
   * up in `key` and painted in that color. '.' and ' ' are transparent unless the key names them.
   * A character missing from the key throws in development, so typos show up at once.
   */
  grid(rows: readonly string[], key: Readonly<Record<string, string | null>>, ox = 0, oy = 0): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch in key) {
          const c = key[ch];
          if (c !== null) this.px(ox + i, oy + j, c);
        } else if (ch !== '.' && ch !== ' ' && import.meta.env.DEV) {
          throw new Error(`grid: no color for '${ch}' in row ${j}: "${row}"`);
        }
      }
    });
    return this;
  }

  /**
   * Adds a 1 pixel outline around everything drawn so far: every transparent pixel next to an
   * opaque one (up, down, left or right) gets `color`. With `corners`, diagonal neighbors count too,
   * which gives a thicker outline on slopes. Leave a free pixel at each edge of the sprite for it.
   */
  outline(color: string = C.outline, corners = false): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.buf[y * this.w + x] !== null) continue;
        let near = this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1);
        if (!near && corners) near = this.get(x - 1, y - 1) || this.get(x + 1, y - 1) || this.get(x - 1, y + 1) || this.get(x + 1, y + 1);
        if (near) add.push(y * this.w + x);
      }
    }
    checkColor(color);
    for (const i of add) this.buf[i] = color;
    return this;
  }

  /**
   * Shades the open edges of every pixel of color `from`: where a pixel on one of `sides` within
   * `depth` steps is transparent or the outline color, the pixel becomes `to`. Use 'dr' with the
   * shadow tone for the lower right edge of a shape, and 'ul' with the highlight tone for its
   * upper left edge. A depth of 2 or 3 gives a wider band on big shapes.
   * Run it before outline(), or after: the outline color counts as open.
   */
  edge(from: string, to: string, sides: Sides = 'dr', depth = 1): this {
    const open = (x: number, y: number): boolean => {
      const c = this.get(x, y);
      return c === null || c === C.outline;
    };
    const dirs: [number, number][] = [];
    if (sides.includes('u')) dirs.push([0, -1]);
    if (sides.includes('d')) dirs.push([0, 1]);
    if (sides.includes('l')) dirs.push([-1, 0]);
    if (sides.includes('r')) dirs.push([1, 0]);
    const hits: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.buf[y * this.w + x] !== from) continue;
        let hit = false;
        for (const [dx, dy] of dirs) {
          for (let k = 1; k <= depth && !hit; k++) if (open(x + dx * k, y + dy * k)) hit = true;
          if (hit) break;
        }
        if (hit) hits.push(y * this.w + x);
      }
    }
    for (const i of hits) this.buf[i] = to;
    return this;
  }

  /**
   * Gives a flat shape three tones with light from the upper left: pixels of `base` along the upper
   * left edge become `light`, and along the lower right edge become `dark`.
   * Example: p.ellipse(10, 10, 20, 16, PAL.steel1).shadeForm(PAL.steel1, PAL.steel2, PAL.steel0, 1, 2)
   */
  shadeForm(base: string, light: string, dark: string, lightDepth = 1, darkDepth = 1): this {
    this.edge(base, dark, 'dr', darkDepth);
    return this.edge(base, light, 'ul', lightDepth);
  }

  /**
   * Draws one part of a figure on its own layer, then lays it over the picture with its own
   * 1 pixel outline. The outline of a front part then separates it from the part behind it,
   * which is how a large sprite gets its inner lines. `paint` gets a blank painter of the same size.
   */
  layer(paint: (p: Painter) => void, outlineColor: string | null = C.outline): this {
    const q = new Painter(this.w, this.h);
    paint(q);
    if (outlineColor !== null) q.outline(outlineColor);
    return this.stamp(q, 0, 0);
  }

  /** Makes the picture symmetric: the left half is copied, mirrored, over the right half. Draw the left half, then call this. */
  mirrorX(): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < Math.floor(this.w / 2); x++) this.buf[y * this.w + (this.w - 1 - x)] = this.buf[y * this.w + x];
    }
    return this;
  }

  /** Flips the whole picture left to right. */
  flipX(): this {
    for (let y = 0; y < this.h; y++) {
      const row = this.buf.slice(y * this.w, (y + 1) * this.w).reverse();
      for (let x = 0; x < this.w; x++) this.buf[y * this.w + x] = row[x];
    }
    return this;
  }

  /** Turns every pixel of color `from` into `to`. A null `to` erases them. */
  swap(from: string, to: string | null): this {
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] === from) this.buf[i] = to;
    return this;
  }

  /** Flood fills the area of one color that holds (x, y), going up, down, left and right. */
  fill(x: number, y: number, c: string | null): this {
    const target = this.get(x, y);
    if (target === c || x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const stack = [Math.floor(y) * this.w + Math.floor(x)];
    while (stack.length) {
      const i = stack.pop()!;
      if (this.buf[i] !== target) continue;
      this.buf[i] = c;
      const px = i % this.w;
      if (px > 0) stack.push(i - 1);
      if (px < this.w - 1) stack.push(i + 1);
      if (i >= this.w) stack.push(i - this.w);
      if (i < this.buf.length - this.w) stack.push(i + this.w);
    }
    return this;
  }

  /**
   * Moves the pixels in a rectangle by (dx, dy). The space they leave becomes transparent.
   * Handy for animation frames: draw a pose, then move the head down a pixel.
   */
  move(x: number, y: number, w: number, h: number, dx: number, dy: number): this {
    const cut: [number, number, string][] = [];
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const c = this.get(i, j);
        if (c !== null) cut.push([i, j, c]);
        this.px(i, j, null);
      }
    }
    for (const [i, j, c] of cut) this.px(i + dx, j + dy, c);
    return this;
  }

  /** Copies another sprite (or painter) in with its top left at (x, y). Its transparent pixels leave this one as it is. */
  stamp(s: Sprite | Painter, x: number, y: number, flip = false): this {
    const src = s instanceof Painter ? s.buf : s.pixels;
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const c = src[j * s.w + (flip ? s.w - 1 - i : i)];
        if (c !== null) this.px(x + i, y + j, c);
      }
    }
    return this;
  }

  /** Erases everything. */
  clear(): this {
    this.buf.fill(null);
    return this;
  }
}

function toCanvas(w: number, h: number, pixels: readonly (string | null)[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < pixels.length; i++) {
    const c = pixels[i];
    if (c === null) continue;
    const [r, gr, b] = parseColor(c);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gr;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

/** A sprite made straight from a list of pixel colors (row by row, null for transparent). */
export function spriteFromPixels(w: number, h: number, pixels: readonly (string | null)[]): Sprite {
  return { canvas: toCanvas(w, h, pixels), w, h, pixels: pixels.slice() };
}

/**
 * Builds a sprite w by h pixels by calling `paint` with a Painter. Call it once, not per frame.
 * Example: makeSprite(16, 16, (p) => { p.grid(ROWS, KEY); p.edge(C.steelShade, C.steelDark, 'dr'); p.outline(); })
 */
export function makeSprite(w: number, h: number, paint: (p: Painter) => void): Sprite {
  const p = new Painter(w, h);
  paint(p);
  return spriteFromPixels(w, h, p.buf);
}

/** Several frames of the same size: paint(p, i) is called once for each frame index. */
export function makeFrames(count: number, w: number, h: number, paint: (p: Painter, i: number) => void): Sprite[] {
  const out: Sprite[] = [];
  for (let i = 0; i < count; i++) out.push(makeSprite(w, h, (p) => paint(p, i)));
  return out;
}

/** Makes a value the first time it is asked for, then keeps it. Use it so sprites are built on first draw. */
export function lazy<T>(make: () => T): () => T {
  let v: T | undefined;
  let made = false;
  return () => {
    if (!made) {
      v = make();
      made = true;
    }
    return v as T;
  };
}

// Copies of a sprite, made once and cached.

const variants = new WeakMap<Sprite, Map<string, Sprite>>();

function variant(s: Sprite, key: string, make: () => Sprite): Sprite {
  let m = variants.get(s);
  if (!m) {
    m = new Map();
    variants.set(s, m);
  }
  let v = m.get(key);
  if (!v) {
    v = make();
    m.set(key, v);
  }
  return v;
}

/** The sprite flipped left to right. Cached. */
export function flipped(s: Sprite): Sprite {
  return variant(s, 'flip', () => {
    const out: (string | null)[] = [];
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) out.push(s.pixels[y * s.w + (s.w - 1 - x)]);
    return spriteFromPixels(s.w, s.h, out);
  });
}

/** Every opaque pixel in one solid color, for a hit flash. Cached per color. */
export function tinted(s: Sprite, color: string): Sprite {
  return variant(s, `tint ${color}`, () => spriteFromPixels(s.w, s.h, s.pixels.map((c) => (c === null ? null : color))));
}

/**
 * The sprite with some colors swapped, for palette variants (a gold rat, a darker guard).
 * `map` is { fromColor: toColor }. Cached per map, so build the map once and reuse it.
 */
export function recolor(s: Sprite, map: Readonly<Record<string, string | null>>): Sprite {
  const key = `recolor ${JSON.stringify(map)}`;
  return variant(s, key, () => spriteFromPixels(s.w, s.h, s.pixels.map((c) => (c !== null && c in map ? map[c] : c))));
}

// Drawing on the game canvas.

/** Where a logical point lands on the canvas, in whole canvas pixels, under the context's current transform. */
export function devicePoint(ctx: Ctx, x: number, y: number): [number, number] {
  const m = ctx.getTransform();
  return [Math.round(m.a * x + m.c * y + m.e), Math.round(m.b * x + m.d * y + m.f)];
}

/**
 * Runs `fn` with the context reset to plain canvas pixels (1 unit is 1 art pixel), then puts the
 * transform back. `toX` and `toY` turn logical positions into whole canvas pixels under the old
 * transform. Only its scale and offset are used: rotation is not allowed in this art style.
 */
export function onGrid(ctx: Ctx, fn: (toX: (x: number) => number, toY: (y: number) => number) => void): void {
  const m = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    fn(
      (x) => Math.round(m.a * x + m.e),
      (y) => Math.round(m.d * y + m.f),
    );
  } finally {
    ctx.setTransform(m);
  }
}

/** Runs `fn` with the context's alpha (times `alpha`) rounded to an allowed step. Skips it when that is 0. */
export function withAlpha(ctx: Ctx, alpha: number, fn: () => void): void {
  const before = ctx.globalAlpha;
  const a = stepAlpha(before * alpha);
  if (a <= 0) return;
  ctx.globalAlpha = a;
  try {
    fn();
  } finally {
    ctx.globalAlpha = before;
  }
}

/**
 * A solid rectangle in logical units, with every edge snapped to the pixel grid.
 * The color is used as given, so pass a color from the set.
 */
export function fillPx(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  onGrid(ctx, (tx, ty) => {
    const x0 = tx(x);
    const y0 = ty(y);
    const x1 = tx(x + w);
    const y1 = ty(y + h);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  });
}

export interface DrawOpts {
  /** Mirror left to right. Enemy art faces right, so flip makes it face left. */
  flip?: boolean;
  /** 0 to 1, rounded to a step of 25%. Multiplies the context's own alpha. */
  alpha?: number;
  /** Draw every opaque pixel in this one color, for a hit flash. */
  tint?: string;
  /** True: (x, y) is the center of the sprite. False (the default): (x, y) is its top left. */
  center?: boolean;
}

/**
 * Draws a sprite at a logical position, snapped to the pixel grid, at its native size
 * (one sprite pixel is one art pixel). Flipped and tinted copies come from a cache.
 */
export function drawSprite(ctx: Ctx, s: Sprite, x: number, y: number, o: DrawOpts = {}): void {
  let img = s;
  if (o.flip) img = flipped(img);
  if (o.tint) img = tinted(img, o.tint);
  withAlpha(ctx, o.alpha ?? 1, () => {
    const m = ctx.getTransform();
    let dx = m.a * x + m.e;
    let dy = m.d * y + m.f;
    if (o.center) {
      dx -= s.w / 2;
      dy -= s.h / 2;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img.canvas, Math.round(dx), Math.round(dy));
    ctx.setTransform(m);
  });
}
