// The knight: the reference sprite that shows how every character is drawn.
//
// Small (16 by 16, the map): authored as character grids, one upper body per facing plus leg
// rows per frame, then given a 1 pixel outline with outline().
// Large (64 by 64, the battle and the title): built with painter calls. Each part (helmet,
// pauldron, shield, sword...) is drawn on its own layer with three flat tones and its own
// outline, back to front, so the front part's outline separates it from the part behind.
// Light comes from the upper left: highlights on the upper left edges, shadows on the lower right.
//
// Facings: down (toward the viewer), up (away), right. Left is right flipped.
// Frames: two idle (the second sinks a pixel, breathing) and two walk (stepping legs).

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { KnightArt, KnightPose } from './art';

// Steel: highlight, base, shadow. Then red cloth, gold trim, teal shield, ember plume, wood.
const W = PAL.steel2;
const s = PAL.steel1;
const d = PAL.steel0;
const R = PAL.red2;
const r = PAL.red1;
const rd = PAL.red0;
const Y = PAL.gold2;
const g = PAL.gold1;
const y = PAL.gold0;
const T = PAL.teal2;
const t = PAL.teal1;
const u = PAL.teal0;
const E = PAL.ember2;
const e = PAL.ember1;
const f = PAL.ember0;
const b = PAL.wood0;
const B = PAL.wood1;
const o = C.outline;

const KEY = { W, s, d, R, r, q: rd, Y, g, y, T, t, u, E, e, f, b, B, o };

// ---------- Small: 16 by 16 ----------
// Rows 0 to 12 are the upper body. Rows 13 and 14 are the legs, which change per frame.
// Row 15 and the outer columns stay free for the outline.

const SMALL_DOWN = [
  '................',
  '........Ee......',
  '.....WWWsss.....',
  '....WWsssssd.W..',
  '....Wssssssd.W..',
  '....Wooooood.W..',
  '....Wssoossd.W..',
  '....dddddddd.W..',
  '.TTTtWRrrqds.W..',
  '.TYgtsrrrqds.W..',
  '.Tgyusrrqqdsygy.',
  '..tu.dbbbbdssb..',
  '.....srrqqd..b..',
];

const SMALL_UP = [
  '................',
  '........Ee......',
  '.....WWWsss.....',
  '....WWsssssd.W..',
  '....Wssssssd.W..',
  '....Wssssssd.W..',
  '....Wsssssdd.W..',
  '....dddddddd.W..',
  '....sTTTttud.W..',
  '....sTtYgtud.W..',
  '....sttgyuudygy.',
  '....dbtuuubdsb..',
  '.....srrqqd..b..',
];

const SMALL_RIGHT = [
  '................',
  '......eEE.......',
  '.....fWWsss.....',
  '.....WWssssd....',
  '.....Wsssssd.W..',
  '.....Wssoooo.W..',
  '.....Wsssssd.W..',
  '.....dddddd..W..',
  '..TTtWRrqsds.W..',
  '..Tgtsrrqsdd.W..',
  '..ttusrqqsdsygy.',
  '...u.dbbbbd.sb..',
  '.....srrqqd..b..',
];

/** Leg rows (13 and 14) for each facing: idle, then the two walk frames. */
const SMALL_LEGS: Record<'down' | 'up' | 'right', string[][]> = {
  down: [
    ['.....sd..sd.....', '.....dd..dd.....'],
    ['.....sd..sd.....', '.........dd.....'],
    ['.....sd..sd.....', '.....dd.........'],
  ],
  up: [
    ['.....sd..sd.....', '.....dd..dd.....'],
    ['.....sd..sd.....', '.........dd.....'],
    ['.....sd..sd.....', '.....dd.........'],
  ],
  right: [
    ['......sd.sd.....', '......dd.ddd....'],
    ['.....sd...sd....', '....dd....ddd...'],
    ['......sdsd......', '.....ddddd......'],
  ],
};

function smallFrame(upper: string[], legs: string[], headDown: boolean): Sprite {
  return makeSprite(16, 16, (p) => {
    p.grid(upper, KEY);
    p.grid(legs, KEY, 0, 13);
    // Breathing: the helmet and plume (columns 4 to 11, rows 0 to 7) sink one pixel into the shoulders.
    if (headDown) p.move(4, 0, 8, 8, 0, 1);
    p.outline(o);
  });
}

function smallPose(dir: 'down' | 'up' | 'right', upper: string[]): KnightPose {
  const legs = SMALL_LEGS[dir];
  return {
    idle: [smallFrame(upper, legs[0], false), smallFrame(upper, legs[0], true)],
    walk: [smallFrame(upper, legs[1], false), smallFrame(upper, legs[2], false)],
  };
}

// ---------- Large: 64 by 64 ----------

/** Draws one part with three flat tones on its own outlined layer. */
function part(p: Painter, paint: (q: Painter) => void, base = s, light = W, dark = d, lightDepth = 1, darkDepth = 2): void {
  p.layer((q) => {
    paint(q);
    q.shadeForm(base, light, dark, lightDepth, darkDepth);
  });
}

type Legs = 'idle' | 'stepA' | 'stepB';

/** Two legs. `lx` and `rx` are the left edges of the back (or left) and front (or right) leg. `lift` raises a foot. */
function legs(p: Painter, lx: number, rx: number, liftL: number, liftR: number, side: boolean): void {
  // The far leg is a step darker in the side view.
  const leg = (x: number, lift: number, far: boolean): void => {
    p.layer((q) => {
      const base = far ? d : s;
      q.rect(x, 47, 6, 11 - lift, base);
      q.rect(side ? x - 1 : x - 1, 57 - lift, side ? 11 : 8, 4, base);
      // A knee plate.
      q.rect(x, 50, 6, 2, far ? d : W);
      if (far) q.edge(d, s, 'ul');
      else q.shadeForm(s, W, d, 1, 2);
    });
  };
  leg(lx, liftL, side);
  leg(rx, liftR, false);
}

/** The kite shield: a gold rim, a teal face with three tones, and a gold boss. pts are its outer corners. */
function shield(p: Painter, pts: number[], inset: number[], bx: number, by: number): void {
  p.layer((q) => {
    q.poly(pts, g);
    q.edge(g, y, 'dr');
    q.edge(g, Y, 'ul');
    q.poly(inset, t);
    q.shadeForm(t, T, u, 2, 2);
    q.circle(bx, by, 2, g);
    q.px(bx - 1, by - 1, Y);
    q.px(bx + 1, by + 1, y);
  });
}

/** The sword, pointing up: blade, cross guard, grip and pommel. (bx, top) is the blade's left column and tip row. */
function sword(p: Painter, bx: number, top: number, guardY: number): void {
  p.layer((q) => {
    q.rect(bx, guardY + 2, 3, 9, b);
    q.edge(b, B, 'l');
    q.circle(bx + 1, guardY + 12, 1, g);
    q.px(bx, guardY + 11, Y);
  });
  p.layer((q) => {
    q.px(bx + 1, top, W);
    q.rect(bx, top + 1, 1, guardY - top - 1, W);
    q.rect(bx + 1, top + 1, 1, guardY - top - 1, s);
    q.rect(bx + 2, top + 1, 1, guardY - top - 1, d);
  });
  p.layer((q) => {
    q.rect(bx - 5, guardY, 13, 2, g);
    q.hline(bx - 5, guardY, 13, Y);
    q.hline(bx - 5, guardY + 1, 13, y);
  });
}

/** A gauntlet around the grip. */
function gauntlet(p: Painter, x: number, yy: number): void {
  part(p, (q) => {
    q.ellipse(x, yy, 9, 8, s);
  }, s, W, d, 1, 1);
  p.hline(x + 4, yy + 3, 4, d).hline(x + 4, yy + 5, 4, d);
}

/** The torso: a rounded breastplate with a plate seam, the red tabard with gold trim, and the belt. */
function torso(p: Painter, x: number, w: number, tx: number, tw: number, oy: number, front: boolean): void {
  part(p, (q) => {
    q.ellipse(x, 28 + oy, w, 22, s);
    q.rect(x + 1, 38 + oy, w - 2, 11, s);
  }, s, W, d, 2, 3);
  p.hline(x + 2, 42 + oy, w - 4, d);
  if (front) {
    p.layer((q) => {
      q.rect(tx, 32 + oy, tw, 22, r);
      q.shadeForm(r, R, rd, 1, 2);
      q.vline(tx, 32 + oy, 22, g).vline(tx + tw - 1, 32 + oy, 22, y);
      // A gold chevron on the chest.
      const cx = tx + Math.floor(tw / 2) - 1;
      q.px(cx, 36 + oy, g).px(cx + 1, 36 + oy, g);
      q.rect(cx - 1, 37 + oy, 4, 1, g);
      q.rect(cx - 2, 38 + oy, 2, 1, g).rect(cx + 2, 38 + oy, 2, 1, y);
    });
  }
  p.layer((q) => {
    q.rect(x, 45 + oy, w, 3, b);
    q.hline(x, 45 + oy, w, B);
    const mid = x + Math.floor(w / 2) - 2;
    q.rect(mid, 45 + oy, 4, 3, g);
    q.px(mid, 45 + oy, Y).px(mid + 3, 47 + oy, y);
  });
}

function plume(p: Painter, blobs: [number, number, number, number][]): void {
  p.layer((q) => {
    for (const [x, yy, w, h] of blobs) q.ellipse(x, yy, w, h, e);
    q.edge(e, f, 'd', 2);
    q.edge(e, f, 'r', 1);
    q.edge(e, E, 'u', 1);
  });
}

function largeRight(legsPose: Legs, oy: number): Sprite {
  return makeSprite(64, 64, (p) => {
    const rise = legsPose === 'stepB' ? -1 : 0;
    const k = oy + rise;
    plume(p, [
      [21, 1 + k, 12, 8],
      [12, 4 + k, 13, 9],
      [6, 9 + k, 10, 11],
    ]);
    shield(p, [5, 29 + k, 21, 29 + k, 21, 44 + k, 13, 53 + k, 5, 44 + k], [7, 31 + k, 19, 31 + k, 19, 43 + k, 13, 50 + k, 7, 43 + k], 13, 38 + k);
    if (legsPose === 'stepA') legs(p, 18, 34, 0, 0, true);
    else if (legsPose === 'stepB') legs(p, 24, 28, 0, 0, true);
    else legs(p, 22, 30, 0, 0, true);
    torso(p, 17, 24, 25, 11, k, true);
    part(p, (q) => {
      q.ellipse(16, 7 + k, 24, 24, s);
      q.rect(28, 12 + k, 12, 17, s);
    }, s, W, d, 2, 3);
    // Visor slit and breathing holes, at the front of the helm.
    p.rect(30, 17 + k, 10, 2, o);
    for (const [hx, hy] of [[34, 22], [36, 22], [38, 22], [35, 24], [37, 24]]) p.px(hx, hy + k, o);
    p.hline(20, 28 + k, 16, d);
    // The pauldron and the arm reaching forward to the sword.
    part(p, (q) => q.rect(31, 33 + k, 6, 6, s), s, W, d, 1, 1);
    part(p, (q) => q.ellipse(22, 25 + k, 15, 10, s), s, W, d, 1, 2);
    sword(p, 42, 5 + k, 34 + k);
    gauntlet(p, 37, 36 + k);
  });
}

function largeFront(legsPose: Legs, oy: number, back: boolean): Sprite {
  return makeSprite(64, 64, (p) => {
    const k = oy;
    if (back) {
      // From behind the blade shows above the right shoulder.
      p.layer((q) => {
        q.px(46, 6 + k, W);
        q.rect(45, 7 + k, 1, 24, W).rect(46, 7 + k, 1, 24, s).rect(47, 7 + k, 1, 24, d);
      });
    } else {
      plume(p, [[26, 1 + k, 12, 9]]);
    }
    const liftL = legsPose === 'stepA' ? 2 : 0;
    const liftR = legsPose === 'stepB' ? 2 : 0;
    legs(p, 24, 34, liftL, liftR, false);
    torso(p, 19, 26, 26, 12, k, !back);
    part(p, (q) => q.ellipse(12, 26 + k, 13, 10, s), s, W, d, 1, 2);
    part(p, (q) => q.ellipse(39, 26 + k, 13, 10, s), s, W, d, 1, 2);
    part(p, (q) => {
      q.ellipse(20, 7 + k, 24, 24, s);
    }, s, W, d, 2, 3);
    if (back) {
      // A raised ridge down the back of the helm, and the plume hanging over it.
      p.vline(31, 9 + k, 18, W).vline(32, 9 + k, 18, d);
      plume(p, [
        [27, 1 + k, 10, 8],
        [28, 6 + k, 8, 15],
      ]);
      gauntlet(p, 9, 36 + k);
      gauntlet(p, 46, 36 + k);
      shield(p, [21, 30 + k, 43, 30 + k, 43, 44 + k, 32, 55 + k, 21, 44 + k], [23, 32 + k, 41, 32 + k, 41, 43 + k, 32, 52 + k, 23, 43 + k], 32, 39 + k);
    } else {
      p.rect(23, 17 + k, 18, 2, o);
      p.rect(31, 19 + k, 2, 6, o);
      for (const [hx, hy] of [[26, 22], [28, 22], [35, 22], [37, 22]]) p.px(hx, hy + k, o);
      p.vline(31, 9 + k, 7, W);
      p.hline(23, 28 + k, 18, d);
      part(p, (q) => q.rect(44, 33 + k, 5, 6, s), s, W, d, 1, 1);
      sword(p, 45, 5 + k, 35 + k);
      gauntlet(p, 42, 37 + k);
      shield(p, [6, 31 + k, 24, 31 + k, 24, 46 + k, 15, 56 + k, 6, 46 + k], [8, 33 + k, 22, 33 + k, 22, 45 + k, 15, 53 + k, 8, 45 + k], 15, 41 + k);
    }
  });
}

function largePose(make: (legs: Legs, oy: number) => Sprite): KnightPose {
  return {
    idle: [make('idle', 0), make('idle', 1)],
    walk: [make('stepA', 0), make('stepB', 0)],
  };
}

/** The knight's sprites, built on first use. */
export const art: () => KnightArt = lazy(() => ({
  small: {
    down: smallPose('down', SMALL_DOWN),
    up: smallPose('up', SMALL_UP),
    right: smallPose('right', SMALL_RIGHT),
  },
  large: {
    down: largePose((l, oy) => largeFront(l, oy, false)),
    up: largePose((l, oy) => largeFront(l, oy, true)),
    right: largePose(largeRight),
  },
  idleTime: 0.5,
  walkTime: 0.13,
}));
