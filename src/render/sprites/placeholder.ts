// A helper for the placeholder enemies only. Each placeholder describes its shape once on a 16 by 16
// plan and paints it at a whole scale: 1 for the 16 by 16 map sprite, 4 for the 64 by 64 battle
// sprite (2 and 6 for the boss). The outline is added after scaling, so it stays 1 pixel wide.
// Real redraws should author each size by hand instead and stop importing this file.

import { Painter } from '../pixel';

export interface Plan {
  rect(x: number, y: number, w: number, h: number, c: string): void;
  ellipse(x: number, y: number, w: number, h: number, c: string): void;
  /** One plan pixel, which is k by k sprite pixels. */
  dot(x: number, y: number, c: string): void;
  poly(pts: number[], c: string): void;
  /** A line one plan pixel thick. */
  line(x0: number, y0: number, x1: number, y1: number, c: string): void;
  /** Shades `base` with light from the upper left, with bands that grow with the scale. */
  shade(base: string, light: string, dark: string): void;
  readonly k: number;
}

/** Wraps a painter so plan coordinates are multiplied by k. */
export function plan(p: Painter, k: number): Plan {
  return {
    k,
    rect: (x, y, w, h, c) => void p.rect(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k), c),
    ellipse: (x, y, w, h, c) => void p.ellipse(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k), c),
    dot: (x, y, c) => void p.rect(Math.round(x * k), Math.round(y * k), k, k, c),
    poly: (pts, c) => void p.poly(pts.map((v) => v * k), c),
    line: (x0, y0, x1, y1, c) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * k;
      for (let i = 0; i <= n; i++) {
        const tt = n ? i / n : 0;
        p.rect(Math.round((x0 + (x1 - x0) * tt) * k), Math.round((y0 + (y1 - y0) * tt) * k), k, k, c);
      }
    },
    shade: (base, light, dark) => void p.shadeForm(base, light, dark, k >= 4 ? 2 : 1, k >= 4 ? 3 : 1),
  };
}

/** Paints one part on its own outlined layer, through a plan at scale k. */
export function planPart(p: Painter, k: number, paint: (z: Plan) => void): void {
  p.layer((q) => paint(plan(q, k)));
}
