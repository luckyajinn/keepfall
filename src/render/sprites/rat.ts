// Cellar Rat: a big, scrappy brown rat seen from the side, facing right.
//
// Small (16 by 16, the map): two character grids, drawn pixel by pixel, shaded and outlined.
// Large (64 by 64, the battle): built with painter calls, back to front, each part on its own
// outlined layer with three flat tones, light from the upper left.
// Idle: on the map the tail tip and nose twitch; in battle the rat also breathes (its back and
// head sink a pixel) and its whiskers twitch.

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';

// Fur: highlight, base, shadow. Pink skin (ears, nose, tail, feet): highlight and shadow.
const H = PAL.wood2;
const m = PAL.wood1;
const d = PAL.wood0;
const P = PAL.red2;
const p = PAL.red1;
const E = PAL.ember2;
const W = PAL.parch2;
const o = C.outline;

const KEY = { H, m, d, P, p, E, W, o };

// ---------- Small: 16 by 16 ----------

// The fur is drawn in one tone ('m') and shaded by small() with light from the upper left.
const SMALL_A = [
  '................',
  '................',
  '................',
  '................',
  '.........mm.....',
  '........mPPm....',
  '..P..mmmmPpm....',
  '.P..mmmmmmmmm...',
  '.P.mmmmmmmmEmm..',
  '.P.mmmmmmmmmmmP.',
  '.p.mmmmmmmmmmW..',
  '..Pmmmmmmmmmm...',
  '....mmmmmmmm....',
  '....dd....dd....',
  '...PP....PP.....',
  '................',
];

// The second frame: the tail tip flicks up and the nose twitches.
const SMALL_B = [
  '................',
  '................',
  '................',
  '................',
  '.........mm.....',
  '..P.....mPPm....',
  '.P...mmmmPpm....',
  '.P..mmmmmmmmm...',
  '.P.mmmmmmmmEmm..',
  '.P.mmmmmmmmmmmm.',
  '.p.mmmmmmmmmmW..',
  '..Pmmmmmmmmmm...',
  '....mmmmmmmm....',
  '....dd....dd....',
  '...PP....PP.....',
  '................',
];

function small(rows: string[]): Sprite {
  return makeSprite(16, 16, (q) => {
    q.grid(rows, KEY);
    q.edge(m, d, 'dr');
    q.edge(m, H, 'ul');
    q.outline(o);
  });
}

// ---------- Large: 64 by 64 ----------

/** A thick line through a list of points, `w` pixels wide, for the tail. */
function thick(q: Painter, pts: [number, number][], w: number, c: string): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) q.line(x0 + a, y0 + b, x1 + a, y1 + b, c);
  }
}

function large(breath: number, twitch: number): Sprite {
  return makeSprite(64, 64, (q) => {
    const k = breath;
    // The tail, behind everything: out of the rump, back along the ground, then curling up.
    q.layer((z) => {
      thick(z, [[16, 55], [9, 56], [4, 53], [2, 47], [3, 41]], 3, P);
      thick(z, [[3, 41], [5, 36], [8, 34 - twitch]], 2, P);
      z.px(10, 34 - twitch, P).px(11, 35 - twitch, P);
      z.edge(P, p, 'dr');
      // Ring creases along the tail.
      for (const [x, y] of [[10, 56], [5, 52], [3, 46]]) z.px(x, y, p);
    });
    // The far feet, a step darker.
    q.layer((z) => {
      z.rect(24, 57, 6, 4, p);
      z.rect(48, 57, 6, 4, p);
      z.hline(24, 57, 6, P).hline(48, 57, 6, P);
    });
    // The body: a low round lump with a ragged back.
    q.layer((z) => {
      z.ellipse(9, 34 + k, 42, 26 - k, m);
      z.ellipse(20, 30 + k, 24, 18, m);
      // Tufts of fur sticking up along the back.
      z.poly([17, 37 + k, 19, 31 + k, 22, 35 + k], m);
      z.poly([25, 32 + k, 28, 27 + k, 30, 31 + k], m);
      z.poly([33, 31 + k, 36, 27 + k, 38, 31 + k], m);
      z.shadeForm(m, H, d, 2, 3);
      // Fur strokes in the shadow tone.
      for (const [x, y] of [[20, 41], [26, 37], [32, 36], [24, 46], [30, 43], [36, 41]]) {
        z.px(x, y + k, d).px(x + 1, y + 1 + k, d);
      }
      for (const [x, y] of [[22, 35], [29, 32]]) z.px(x, y + k, H);
    });
    // The near hind leg: a haunch and a foot.
    q.layer((z) => {
      z.ellipse(13, 43 + k, 17, 15 - k, m);
      z.shadeForm(m, H, d, 1, 2);
    });
    q.layer((z) => {
      z.rect(14, 56, 10, 4, P);
      z.hline(14, 59, 10, p);
      z.px(17, 56, p).px(20, 56, p);
    });
    // The ear, behind the head: a round flap with a pink inside.
    q.layer((z) => {
      z.ellipse(37, 19 + k, 13, 13, m);
      z.shadeForm(m, H, d, 1, 2);
      z.ellipse(40, 22 + k, 7, 8, P);
      z.edge(P, p, 'dr', 2);
    });
    // The head and the pointed snout.
    q.layer((z) => {
      z.ellipse(37, 28 + k, 19, 19, m);
      z.poly([46, 30 + k, 60, 39 + k, 59, 44 + k, 47, 47 + k], m);
      z.ellipse(51, 36 + k, 9, 10, m);
      z.shadeForm(m, H, d, 2, 3);
    });
    // The nose, the eye, a mouth line and a buck tooth, drawn over the head.
    const ny = 38 + k - twitch;
    q.rect(59, ny, 3, 3, P);
    q.px(61, ny + 2, p).px(59, ny, W);
    q.rect(46, 32 + k, 5, 5, o).px(46, 32 + k, m).px(50, 36 + k, m);
    q.rect(47, 33 + k, 3, 3, E);
    q.px(49, 35 + k, PAL.ember1).px(47, 33 + k, W);
    q.line(52, 45 + k, 58, 42 + k, d);
    q.rect(55, 46 + k, 2, 3, W);
    q.px(56, 48 + k, PAL.parch1);
    q.outline(o);
    // Whiskers, out past the outline, in pale parchment.
    q.line(55, 39 + k, 62, 36 + k - twitch, PAL.parch1);
    q.line(55, 41 + k, 62, 42 + k, PAL.parch1);
    // The near front leg and paw, on top, standing on the ground line.
    q.layer((z) => {
      z.ellipse(39, 47 + k, 8, 12 - k, m);
      z.shadeForm(m, H, d, 1, 2);
    });
    q.layer((z) => {
      z.rect(39, 57, 9, 4, P);
      z.hline(39, 60, 9, p);
      z.px(42, 57, p).px(45, 57, p);
    });
  });
}

/** The rat's sprites, built on first use. */
export const art: () => EnemyArt = lazy(() => ({
  small: [small(SMALL_A), small(SMALL_B)],
  large: [large(0, 0), large(1, 1)],
  frameTime: 0.35,
}));
