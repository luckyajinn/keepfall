// Small canvas drawing helpers shared by every screen.
import { C, FONT } from './colors';

export const W = 800;
export const H = 600;

export type Ctx = CanvasRenderingContext2D;

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

export function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ellipse(ctx, x, y, r, r, color);
}

export function poly(ctx: Ctx, pts: number[], color: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  bold?: boolean;
  italic?: boolean;
  baseline?: CanvasTextBaseline;
  shadow?: boolean;
}

export function text(ctx: Ctx, str: string, x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 16;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.shadow) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(str, x + 1, y + 2);
  }
  ctx.fillStyle = o.color ?? C.ink;
  ctx.fillText(str, x, y);
}

/** Draws text and wraps it at maxWidth. Returns the y of the line after the last one. */
export function wrapText(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  o: TextOpts = {},
): number {
  const size = o.size ?? 16;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${size}px ${FONT}`;
  const words = str.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
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

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  fillRR(ctx, x, y, w, h, 8, C.panel);
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, x + 4.5, y + 4.5, w - 9, h - 9, 5);
  ctx.strokeStyle = 'rgba(138, 106, 60, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function bar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
  back: string = '#150e0b',
): void {
  fillRR(ctx, x, y, w, h, h / 2, back);
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    const fw = Math.max(h, w * f);
    fillRR(ctx, x, y, fw, h, h / 2, color);
    ctx.globalAlpha = 0.25;
    fillRR(ctx, x + 2, y + 1, fw - 4, h / 3, h / 4, '#ffffff');
    ctx.globalAlpha = 1;
  }
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A stable pseudo random value from 0 to 1 for a pair of whole numbers. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A list of menu rows with one row highlighted. */
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
    const selected = i === index;
    if (selected) {
      fillRR(ctx, x, ry, w, rowH - 4, 6, 'rgba(242, 184, 75, 0.16)');
      poly(ctx, [x + 8, ry + rowH / 2 - 8, x + 18, ry + rowH / 2 - 2, x + 8, ry + rowH / 2 + 4], C.gold);
    }
    const color = row.dim ? C.inkFaint : selected ? C.gold : C.ink;
    text(ctx, row.label, x + 28, ry + rowH / 2 - 1, { size, color, baseline: 'middle', bold: selected });
    if (row.right) {
      text(ctx, row.right, x + w - 12, ry + rowH / 2 - 1, { size, color, baseline: 'middle', align: 'right' });
    }
  });
}
