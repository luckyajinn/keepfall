// Small drawing helpers shared by every screen, in the pixel style (see the art rules in pixel.ts).
// Positions and sizes are logical units (800 by 600). Every edge lands on the 400 by 300 pixel grid.
// Colors passed in are moved to the nearest color in the set, and see-through colors and the
// context's alpha are rounded to a 25% step, so a screen can not draw outside the art rules
// through these helpers.
import { C, darker, lighter, nearest, parseColor } from './colors';
import { CAP_H, TextAlign, TextBaseline, drawText, measureText } from './font';
import { PX, Sprite, drawSprite, lazy, makeSprite, onGrid, stepAlpha, withAlpha } from './pixel';

export const W = 800;
export const H = 600;

export type Ctx = CanvasRenderingContext2D;

/** A color from the set, and an alpha step, for any CSS color a screen passes in. */
function flat(color: string): { c: string; a: number } {
  const a = parseColor(color)[3];
  return { c: nearest(color), a: stepAlpha(a) };
}

/**
 * A filled rectangle on the pixel grid. With r above 0 the four corner pixels are left out
 * (a 1 pixel chamfer). r = 0 gives square corners. Larger r values do the same as 1.
 */
export function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void {
  const { c, a } = flat(color);
  withAlpha(ctx, a, () =>
    onGrid(ctx, (tx, ty) => {
      const x0 = tx(x);
      const y0 = ty(y);
      const pw = tx(x + w) - x0;
      const ph = ty(y + h) - y0;
      if (pw <= 0 || ph <= 0) return;
      ctx.fillStyle = c;
      if (r > 0 && pw > 2 && ph > 2) {
        ctx.fillRect(x0 + 1, y0, pw - 2, ph);
        ctx.fillRect(x0, y0 + 1, 1, ph - 2);
        ctx.fillRect(x0 + pw - 1, y0 + 1, 1, ph - 2);
      } else {
        ctx.fillRect(x0, y0, pw, ph);
      }
    }),
  );
}

// Old vector drawing. rr, ellipse, circle and poly come from the smooth vector look and are kept
// only so the old backdrops still run. The redraw will remove them. ellipse, circle and poly now
// fill hard edged pixels (no anti-aliasing), but their shapes were never designed for the grid.

/** Old vector drawing that the redraw will remove: builds a rounded rectangle path. */
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}

/** Fills spans row by row on the grid. `span(py)` gives the filled ranges [from, to) of canvas pixel row py, in canvas pixels. */
function fillSpans(ctx: Ctx, color: string, y0: number, y1: number, span: (cy: number) => number[]): void {
  const { c, a } = flat(color);
  withAlpha(ctx, a, () => {
    const m = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = c;
    const top = Math.round(m.d * y0 + m.f);
    const bottom = Math.round(m.d * y1 + m.f);
    for (let py = top; py < bottom; py++) {
      // Back to logical units at the middle of the pixel row.
      const ly = (py + 0.5 - m.f) / m.d;
      const xs = span(ly);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a0 = Math.round(m.a * xs[i] + m.e);
        const a1 = Math.round(m.a * xs[i + 1] + m.e);
        if (a1 > a0) ctx.fillRect(a0, py, a1 - a0, 1);
      }
    }
    ctx.setTransform(m);
  });
}

/** Old vector drawing that the redraw will remove: a filled ellipse, now hard edged. */
export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  if (rx <= 0 || ry <= 0) return;
  fillSpans(ctx, color, y - ry, y + ry, (ly) => {
    const t = 1 - ((ly - y) / ry) ** 2;
    if (t < 0) return [];
    const half = rx * Math.sqrt(t);
    return [x - half, x + half];
  });
}

/** Old vector drawing that the redraw will remove: a filled circle, now hard edged. */
export function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ellipse(ctx, x, y, r, r, color);
}

/** Old vector drawing that the redraw will remove: a filled polygon from [x0, y0, x1, y1, ...], now hard edged. */
export function poly(ctx: Ctx, pts: number[], color: string): void {
  const n = pts.length / 2;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < n; k++) {
    minY = Math.min(minY, pts[k * 2 + 1]);
    maxY = Math.max(maxY, pts[k * 2 + 1]);
  }
  fillSpans(ctx, color, minY, maxY, (ly) => {
    const xs: number[] = [];
    for (let k = 0; k < n; k++) {
      const ax = pts[k * 2];
      const ay = pts[k * 2 + 1];
      const bx = pts[((k + 1) % n) * 2];
      const by = pts[((k + 1) % n) * 2 + 1];
      if ((ay <= ly && by > ly) || (by <= ly && ay > ly)) xs.push(ax + ((ly - ay) / (by - ay)) * (bx - ax));
    }
    return xs.sort((a, b) => a - b);
  });
}

// Text.

export interface TextOpts {
  /**
   * The old logical font size. It picks a whole font scale (see fontScale): under 26 is 1 times,
   * 26 to 47 is 2 times, 48 to 71 is 3 times, 72 and up is 4 times.
   */
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  /** At 2 times and up, strokes 1 pixel thicker. At 1 times, a dark drop shadow (the letters stay the same width). */
  bold?: boolean;
  /** Accepted and ignored: the pixel font has no italic. */
  italic?: boolean;
  /** 'alphabetic' (the default) puts y on the baseline. 'middle' puts y halfway down the capitals. 'top' and 'bottom' also work. */
  baseline?: CanvasTextBaseline;
  /** A 1 font pixel drop shadow, down and right, in the outline color. */
  shadow?: boolean;
}

/**
 * The whole font scale for an old logical font size.
 * The old fonts drew capitals about 0.7 of their size tall. Our capitals are 7 pixels, 14 logical
 * units, at 1 times, which is the old size 20. Normal text (sizes 12 to 24) stays at 1 times so it
 * fits, headings (26 to 47, mostly 30 to 40) get 2 times, the big shouts such as "Ambush!" (48 to 71)
 * get 3 times, and the title logo (84) gets 4 times, close to its old height.
 */
export function fontScale(size = 16): number {
  if (size < 26) return 1;
  if (size < 48) return 2;
  if (size < 72) return 3;
  return 4;
}

function align(a: CanvasTextAlign | undefined): TextAlign {
  if (a === 'center') return 'center';
  if (a === 'right' || a === 'end') return 'right';
  return 'left';
}

function baseline(b: CanvasTextBaseline | undefined): TextBaseline {
  if (b === 'middle') return 'middle';
  if (b === 'top' || b === 'hanging') return 'top';
  if (b === 'bottom' || b === 'ideographic') return 'bottom';
  return 'alphabetic';
}

/** The width of a string in logical units, as text() would draw it. */
export function textWidth(str: string, o: TextOpts = {}): number {
  const scale = fontScale(o.size);
  return measureText(str, scale, !!o.bold && scale > 1) * PX;
}

/** The height of capitals in logical units for a text size. Handy for placing text in a box. */
export function capHeight(size = 16): number {
  return CAP_H * fontScale(size) * PX;
}

export function text(ctx: Ctx, str: string, x: number, y: number, o: TextOpts = {}): void {
  const scale = fontScale(o.size);
  drawText(ctx, str, x, y, {
    scale,
    color: nearest(o.color ?? C.ink),
    shadow: o.shadow || (o.bold && scale === 1) ? C.outline : null,
    bold: o.bold,
    align: align(o.align),
    baseline: baseline(o.baseline),
  });
}

/** Draws text and wraps it at maxWidth, using the pixel font's real widths. Returns the y of the line after the last one. */
export function wrapText(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  o: TextOpts = {},
): number {
  const words = str.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (textWidth(test, o) > maxWidth && line) {
      text(ctx, line, x, cy, o);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    text(ctx, line, x, cy, o);
    cy += lineHeight;
  }
  return cy;
}

// Panels, bars and menus.

/**
 * A flat dark panel with a two line border: a gold outer line with 1 pixel chamfered corners,
 * then a darker gold inner line. The inside starts 2 pixels (4 logical units) in from each edge.
 */
export function panel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  withAlpha(ctx, 1, () =>
    onGrid(ctx, (tx, ty) => {
      const x0 = tx(x);
      const y0 = ty(y);
      const pw = tx(x + w) - x0;
      const ph = ty(y + h) - y0;
      if (pw < 5 || ph < 5) return;
      ctx.fillStyle = C.gold;
      ctx.fillRect(x0 + 1, y0, pw - 2, 1);
      ctx.fillRect(x0 + 1, y0 + ph - 1, pw - 2, 1);
      ctx.fillRect(x0, y0 + 1, 1, ph - 2);
      ctx.fillRect(x0 + pw - 1, y0 + 1, 1, ph - 2);
      ctx.fillStyle = C.goldDark;
      ctx.fillRect(x0 + 1, y0 + 1, pw - 2, ph - 2);
      ctx.fillStyle = C.panel;
      ctx.fillRect(x0 + 2, y0 + 2, pw - 4, ph - 4);
    }),
  );
}

/**
 * A bar such as a health bar. A 1 pixel border in the outline color, the empty part in `back`,
 * the full part in `color` with a 1 pixel highlight line along its top, and a 1 pixel shadow
 * line along its bottom when the bar is tall enough.
 */
export function bar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
  back: string = C.bgDeep,
): void {
  const fill = nearest(color);
  const empty = flat(back);
  withAlpha(ctx, 1, () =>
    onGrid(ctx, (tx, ty) => {
      const x0 = tx(x);
      const y0 = ty(y);
      const pw = tx(x + w) - x0;
      const ph = ty(y + h) - y0;
      if (pw < 3 || ph < 3) return;
      const iw = pw - 2;
      const ih = ph - 2;
      ctx.fillStyle = C.outline;
      ctx.fillRect(x0 + 1, y0, pw - 2, ph);
      ctx.fillRect(x0, y0 + 1, pw, ph - 2);
      if (empty.c !== C.outline) {
        ctx.fillStyle = empty.c;
        ctx.fillRect(x0 + 1, y0 + 1, iw, ih);
      }
      const f = Math.max(0, Math.min(1, frac));
      if (f <= 0) return;
      const fw = Math.max(1, Math.round(iw * f));
      ctx.fillStyle = fill;
      ctx.fillRect(x0 + 1, y0 + 1, fw, ih);
      ctx.fillStyle = lighter(fill);
      ctx.fillRect(x0 + 1, y0 + 1, fw, 1);
      if (ih >= 4) {
        ctx.fillStyle = darker(fill);
        ctx.fillRect(x0 + 1, y0 + ih, fw, 1);
      }
    }),
  );
}

/** A stable pseudo random value from 0 to 1 for a pair of whole numbers. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The menu cursor: a small gold arrow pointing right, 6 by 9 pixels with its outline. */
export const cursorSprite: () => Sprite = lazy(() =>
  makeSprite(6, 9, (p) => {
    p.grid(['g', 'Gg', 'Ggg', 'Gggy', 'ggy', 'gy', 'y'], { G: C.goldBright, g: C.gold, y: C.goldDark }, 1, 1);
    p.outline(C.outline);
  }),
);

/** A list of menu rows with one row highlighted by a lighter bar and the arrow cursor. */
export function drawMenu(
  ctx: Ctx,
  rows: { label: string; right?: string; dim?: boolean }[],
  index: number,
  x: number,
  y: number,
  w: number,
  rowH: number,
  size = 18,
): void {
  rows.forEach((row, i) => {
    const ry = y + i * rowH;
    const mid = ry + rowH / 2 - 2;
    const selected = i === index;
    if (selected) {
      fillRR(ctx, x, ry, w, rowH - 4, 1, C.panelLight);
      drawSprite(ctx, cursorSprite(), x + 10, mid, { center: true });
    }
    const color = row.dim ? C.inkFaint : selected ? C.gold : C.ink;
    text(ctx, row.label, x + 28, mid, { size, color, baseline: 'middle', bold: selected });
    if (row.right) {
      text(ctx, row.right, x + w - 12, mid, { size, color, baseline: 'middle', align: 'right' });
    }
  });
}
