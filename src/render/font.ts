// The game's one pixel font, drawn in code.
//
// Capital letters and digits are 7 pixels tall. Lowercase letters are 5 tall, with ascenders up
// to 7 and descenders 2 below the baseline. It is proportional: each glyph has its own width and
// one blank pixel follows it, so "i" takes 2 pixels and "m" takes 6. A space takes 3.
// It covers every printable ASCII character. Anything else draws a small box and never throws.
//
// Sizes are whole multiples only: scale 1 for normal text, 2 for headings, 3 or 4 for the logo.
// Strings are drawn once into a small canvas and cached, so redrawing the same text each frame
// is a single drawImage.
//
// Glyph rows are written with '#' for a lit pixel and '.' for a blank one, separated by spaces,
// starting at the top of the capitals (row 0). The baseline is under row 6. Rows 7 and 8 are
// the descender. Rows left out at the bottom are blank.

import { C } from './colors';
import { withAlpha } from './pixel';

/** Height of capitals and digits, in pixels at scale 1. */
export const CAP_H = 7;
/** Height of short lowercase letters such as a, e, o. */
export const X_H = 5;
/** How far descenders (g, j, p, q, y and the comma) reach below the baseline. */
export const DESC = 2;
/** A good distance from one baseline to the next at scale 1: capitals, descenders and 2 pixels of air. */
export const LINE_H = 11;
/** The blank space after each glyph. */
const GAP = 1;
/** How far a space moves the pen. */
const SPACE_ADV = 3;

const GLYPHS: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '#### #... #... ###. #... #... ####',
  F: '#### #... #... ###. #... #... #...',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '### .#. .#. .#. .#. .#. ###',
  J: '..## ...# ...# ...# ...# #..# .##.',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#... #... #... #... #... #... ####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# ##..# #.#.# #..## #..## #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.###. #...# #.... .###. ....# #...# .###.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# .#.#. .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',

  a: '.... .... .##. ...# .### #..# .###',
  b: '#... #... ###. #..# #..# #..# ###.',
  c: '... ... .## #.. #.. #.. .##',
  d: '...# ...# .### #..# #..# #..# .###',
  e: '.... .... .##. #..# #### #... .###',
  f: '.## #.. ### #.. #.. #.. #..',
  g: '.... .... .### #..# #..# #..# .### ...# .##.',
  h: '#... #... ###. #..# #..# #..# #..#',
  i: '# . # # # # #',
  j: '.# .. .# .# .# .# .# .# #.',
  k: '#... #... #..# #.#. ##.. #.#. #..#',
  l: '# # # # # # #',
  m: '..... ..... ####. #.#.# #.#.# #.#.# #.#.#',
  n: '.... .... ###. #..# #..# #..# #..#',
  o: '.... .... .##. #..# #..# #..# .##.',
  p: '.... .... ###. #..# #..# #..# ###. #... #...',
  q: '.... .... .### #..# #..# #..# .### ...# ...#',
  r: '... ... #.# ##. #.. #.. #..',
  s: '.... .... .### #... .##. ...# ###.',
  t: '... #.. ### #.. #.. #.. .##',
  u: '.... .... #..# #..# #..# #..# .###',
  v: '..... ..... #...# #...# .#.#. .#.#. ..#..',
  w: '..... ..... #...# #...# #.#.# #.#.# .#.#.',
  x: '..... ..... #...# .#.#. ..#.. .#.#. #...#',
  y: '.... .... #..# #..# #..# #..# .### ...# .##.',
  z: '.... .... #### ...# .##. #... ####',

  '0': '.##. #..# #..# #..# #..# #..# .##.',
  '1': '.#.. ##.. .#.. .#.. .#.. .#.. ###.',
  '2': '.##. #..# ...# ..#. .#.. #... ####',
  '3': '###. ...# ...# .##. ...# ...# ###.',
  '4': '...# ..## .#.# #..# #### ...# ...#',
  '5': '#### #... ###. ...# ...# #..# .##.',
  '6': '.##. #... #... ###. #..# #..# .##.',
  '7': '#### ...# ...# ..#. .#.. .#.. .#..',
  '8': '.##. #..# #..# .##. #..# #..# .##.',
  '9': '.##. #..# #..# .### ...# ...# .##.',

  '!': '# # # # # . #',
  '"': '#.# #.#',
  '#': '..... .#.#. ##### .#.#. ##### .#.#.',
  $: '..#.. .#### #.#.. .###. ..#.# ####. ..#..',
  '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  '&': '.##.. #..#. .##.. .#... #.#.# #..#. .##.#',
  "'": '# #',
  '(': '.# #. #. #. #. #. .#',
  ')': '#. .# .# .# .# .# #.',
  '*': '... #.# .#. #.#',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#..',
  ',': '. . . . . . # #',
  '-': '... ... ... ###',
  '.': '. . . . . . #',
  '/': '..# ..# .#. .#. .#. #.. #..',
  ':': '. . # . . . #',
  ';': '.. .. .# .. .. .. .# #.',
  '<': '... ..# .#. #.. .#. ..#',
  '=': '.... .... #### .... ####',
  '>': '... #.. .#. ..# .#. #..',
  '?': '.##. #..# ...# ..#. .#.. .... .#..',
  '@': '.###. #...# #.### #.#.# #.### #.... .###.',
  '[': '## #. #. #. #. #. ##',
  '\\': '#.. #.. .#. .#. .#. ..# ..#',
  ']': '## .# .# .# .# .# ##',
  '^': '.#. #.#',
  _: '.... .... .... .... .... .... .... ####',
  '`': '#. .#',
  '{': '.## .#. .#. #.. .#. .#. .##',
  '|': '# # # # # # # # #',
  '}': '##. .#. .#. ..# .#. .#. ##.',
  '~': '.... .... .#.# #.#.',
};

/** Drawn for any character the font does not have: a box with a checker inside, so it can not pass for a zero or an O. */
const MISSING = '##### ##.## #.#.# ##.## #.#.# ##.## #####';

interface Glyph {
  /** Width in pixels, before the gap. */
  w: number;
  /** How far the pen moves after it. */
  adv: number;
  /** Lit pixels as [x, y] pairs, flat. */
  bits: number[];
}

function parseGlyph(src: string): Glyph {
  const rows = src.split(' ');
  const w = Math.max(...rows.map((r) => r.length));
  const bits: number[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') bits.push(x, y);
  });
  return { w, adv: w + GAP, bits };
}

const glyphs = new Map<string, Glyph>();
for (const [ch, src] of Object.entries(GLYPHS)) glyphs.set(ch, parseGlyph(src));
glyphs.set(' ', { w: SPACE_ADV, adv: SPACE_ADV, bits: [] });
const missing = parseGlyph(MISSING);

function glyphOf(ch: string): Glyph {
  return glyphs.get(ch) ?? missing;
}

/** True if the font has its own glyph for this character (and does not draw the box). */
export function hasGlyph(ch: string): boolean {
  return glyphs.has(ch);
}

/** Every character the font has. */
export function glyphList(): string {
  return [...glyphs.keys()].join('');
}

/**
 * The width of a string in art pixels at a whole scale. Bold adds 1 pixel to each glyph.
 * Multiply by PX (2) for logical units.
 */
export function measureText(str: string, scale = 1, bold = false): number {
  const b = bold ? 1 : 0;
  let w = 0;
  let last = 0;
  for (const ch of str) {
    const g = glyphOf(ch);
    w += g.adv * scale + b;
    last = g.adv - g.w;
  }
  // The last glyph needs no gap after it.
  return str.length ? w - last * scale : 0;
}

export type TextAlign = 'left' | 'center' | 'right';
/**
 * Where y sits on the text. 'alphabetic': on the baseline (under the capitals).
 * 'middle': halfway down the capitals. 'top': at the top of the capitals. 'bottom': under the descenders.
 */
export type TextBaseline = 'alphabetic' | 'middle' | 'top' | 'bottom';

export interface FontOpts {
  /** 1, 2, 3 or 4. Other values are rounded to a whole number from 1 to 8. */
  scale?: number;
  color?: string;
  /** A color for a drop shadow 1 font pixel down and right, or null for none. */
  shadow?: string | null;
  /** At scale 2 and up, each stroke is 1 pixel thicker. At scale 1 the letters do not change, since a 1 pixel font has no room to grow. */
  bold?: boolean;
  align?: TextAlign;
  baseline?: TextBaseline;
}

/** One string drawn this frame, for tests. The box is in canvas pixels. */
export interface DrawnText {
  s: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Every string drawn in the current frame, in development only. main.ts empties it at the start
 * of each frame and shows it as window.keepfallText. Tests read text from it, since the font
 * draws pixels and never calls fillText.
 */
export const textLog: DrawnText[] = [];

// Drawn strings, cached. A Map keeps insertion order, so the first key is the oldest.
const cache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 800;

function render(str: string, scale: number, bold: boolean, color: string, shadow: string | null): HTMLCanvasElement {
  const key = `${scale}|${bold ? 1 : 0}|${color}|${shadow ?? ''}|${str}`;
  let canvas = cache.get(key);
  if (canvas) {
    // Move it to the back so it is the last to go.
    cache.delete(key);
    cache.set(key, canvas);
    return canvas;
  }
  const b = bold ? 1 : 0;
  const off = shadow ? scale : 0;
  canvas = document.createElement('canvas');
  canvas.width = Math.max(1, measureText(str, scale, bold) + off);
  canvas.height = (CAP_H + DESC) * scale + off;
  const g = canvas.getContext('2d')!;
  const paint = (fill: string, ox: number, oy: number): void => {
    g.fillStyle = fill;
    let pen = 0;
    for (const ch of str) {
      const gl = glyphOf(ch);
      for (let i = 0; i < gl.bits.length; i += 2) g.fillRect(ox + pen + gl.bits[i] * scale, oy + gl.bits[i + 1] * scale, scale + b, scale);
      pen += gl.adv * scale + b;
    }
  };
  if (shadow) paint(shadow, off, off);
  paint(color, 0, 0);
  cache.set(key, canvas);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return canvas;
}

/**
 * Draws a string at a logical position (x, y), snapped to the pixel grid.
 * The context's alpha is rounded to a 25% step. Returns the width drawn, in logical units.
 */
export function drawText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: FontOpts = {}): number {
  const scale = Math.max(1, Math.min(8, Math.round(o.scale ?? 1)));
  const bold = !!o.bold && scale > 1;
  const color = o.color ?? C.ink;
  const w = measureText(str, scale, bold);
  if (!str) return 0;
  withAlpha(ctx, 1, () => {
    const m = ctx.getTransform();
    let dx = m.a * x + m.e;
    const dy = m.d * y + m.f;
    if (o.align === 'center') dx -= w / 2;
    else if (o.align === 'right') dx -= w;
    let top: number;
    switch (o.baseline ?? 'alphabetic') {
      case 'top':
        top = dy;
        break;
      case 'middle':
        top = dy - (CAP_H * scale) / 2;
        break;
      case 'bottom':
        top = dy - (CAP_H + DESC) * scale;
        break;
      default:
        top = dy - CAP_H * scale;
    }
    const px = Math.round(dx);
    const py = Math.round(top);
    const img = render(str, scale, bold, color, o.shadow ?? null);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px, py);
    ctx.setTransform(m);
    if (import.meta.env.DEV) textLog.push({ s: str, color, x: px, y: py, w, h: CAP_H * scale });
  });
  return w / (ctx.getTransform().a || 0.5);
}
