// Mogrum the Ork, the boss: a big, fat, strong Ork with a dented iron crown and a studded club.
//
// A huge round moss green body with a lighter belly, a small head sunk into the shoulders under a
// heavy brow, gold eyes, a wide jaw with two tusks pointing up, pointed ears, thick arms, a
// leather belt with a gold buckle, and a wooden club studded with iron resting on his shoulder.
// The eyes sit high under the brow in dark sockets and the tusks stand at the corners of the jaw,
// well apart from them, so the two never read as one another.
//
// Small (32 by 32, the map): character grids. Large (96 by 96, the battle): painter calls, each
// part on its own outlined layer, back to front, with three tones and light from the upper left.
// Idle: slow heavy breathing (the upper body and belly rise a pixel) while the club shifts.

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';

// Moss skin, its lighter belly (the highlight tone), parch tusks, gold, steel, wood, red.
const G = PAL.moss2;
const M = PAL.moss1;
const D = PAL.moss0;
const P = PAL.parch2;
const p = PAL.parch1;
const q = PAL.parch0;
const Y = PAL.gold2;
const g = PAL.gold1;
const y = PAL.gold0;
const S = PAL.steel2;
const s = PAL.steel1;
const t = PAL.steel0;
const K = PAL.wood2;
const k = PAL.wood1;
const b = PAL.wood0;
const R = PAL.red2;
const r = PAL.red1;
const x = PAL.red0;
const o = C.outline;

const KEY = { G, M, D, P, p, q, Y, g, y, S, s, t, K, k, b, R, r, x, o };

/** The loop: how far the upper body rises (breathing) and how far the club head leans out. */
const BREATH = [0, 1, 1, 0];
const CLUB = [0, 0, 1, 1];

// ---------- Large: 96 by 96 ----------

/** Draws one part with three flat tones on its own outlined layer. */
function part(pt: Painter, paint: (z: Painter) => void, base = M, light = G, dark = D, lightDepth = 1, darkDepth = 2): void {
  pt.layer((z) => {
    paint(z);
    z.shadeForm(base, light, dark, lightDepth, darkDepth);
  });
}

/** An iron stud: a small steel knob with a highlight, sticking out of the club. */
function stud(z: Painter, cx: number, cy: number): void {
  z.rect(cx - 1, cy - 1, 3, 3, s);
  z.px(cx - 1, cy - 1, S).px(cx, cy - 1, S).px(cx - 1, cy, S);
  z.px(cx + 1, cy + 1, t).px(cx + 1, cy, t).px(cx, cy + 1, t);
}

/** The club's head, leaning on the right shoulder: a heavy rounded log studded with iron. `lean` moves it out. */
function clubHead(pt: Painter, lean: number, oy: number): void {
  const hx = 81 + lean;
  pt.layer((z) => {
    z.ellipse(hx - 10, 3 + oy, 21, 29, k);
    z.poly([hx - 7, 26 + oy, hx + 6, 26 + oy, hx + 3, 34 + oy, hx - 4, 34 + oy], k);
    z.shadeForm(k, K, b, 2, 3);
    // Wood grain: a few short dark lines down the head, and a knot.
    z.vline(hx - 4, 9 + oy, 6, b).vline(hx + 3, 13 + oy, 7, b).vline(hx - 1, 19 + oy, 5, b);
    z.px(hx + 1, 7 + oy, b).px(hx + 2, 7 + oy, b).px(hx + 1, 8 + oy, K);
    // An iron band where the head meets the handle.
    z.rect(hx - 6, 29 + oy, 11, 3, s);
    z.hline(hx - 6, 29 + oy, 11, S);
    z.hline(hx - 6, 31 + oy, 11, t);
  });
  pt.layer((z) => {
    for (const [sx, sy] of [[-10, 12], [10, 10], [-9, 23], [10, 21], [0, 3], [-6, 6], [6, 5]]) stud(z, hx + sx, sy + oy);
  });
}

/** The club's handle, from below the fist up to the head. */
function clubHandle(pt: Painter, lean: number, oy: number): void {
  const hx = 81 + lean;
  pt.layer((z) => {
    z.poly([69, 66 + oy, 74, 66 + oy, hx + 2, 32 + oy, hx - 3, 32 + oy], k);
    z.edge(k, K, 'l');
    z.edge(k, b, 'r');
  });
}

/** The club swung back over his head for a heavy blow: the head behind his far shoulder, the handle behind his head. */
function raisedClub(pt: Painter, oy: number): void {
  pt.layer((z) => {
    z.poly([28, 11 + oy, 30, 16 + oy, 78, 26 + oy, 78, 20 + oy], k);
    z.edge(k, K, 'u');
    z.edge(k, b, 'd');
  });
  pt.layer((z) => {
    z.ellipse(3, 3 + oy, 30, 19, k);
    z.poly([26, 6 + oy, 34, 10 + oy, 33, 17 + oy, 26, 19 + oy], k);
    z.shadeForm(k, K, b, 2, 3);
    z.hline(9, 8 + oy, 6, b).hline(14, 13 + oy, 7, b).hline(20, 7 + oy, 5, b);
    z.rect(29, 8 + oy, 3, 10, s);
    z.vline(29, 8 + oy, 10, S);
    z.vline(31, 8 + oy, 10, t);
  });
  pt.layer((z) => {
    for (const [sx, sy] of [[3, 12], [10, 4], [20, 3], [6, 20], [17, 21], [27, 5]]) stud(z, sx, sy + oy);
  });
}

function largeFrame(i: number, raised = false): Sprite {
  return makeSprite(96, 96, (pt) => {
    const up = -BREATH[i];
    const lean = CLUB[i];

    // Back to front: the club's head, the far arm, the legs, the body, the near arm, the head,
    // then the club's handle and the fist round it.
    if (raised) raisedClub(pt, up);
    else clubHead(pt, lean, up);

    // The far arm, hanging at his left side, with a big fist.
    part(pt, (z) => {
      z.ellipse(4, 34 + up, 20, 34, M);
    }, M, G, D, 2, 3);
    part(pt, (z) => {
      z.ellipse(3, 60 + up, 18, 16, M);
    }, M, G, D, 1, 2);
    pt.hline(8, 67 + up, 6, D).hline(8, 71 + up, 6, D);

    // Short thick legs and wide feet with pale toenails.
    for (const lx of [22, 52]) {
      part(pt, (z) => {
        z.rect(lx + 2, 78, 16, 10, M);
        z.ellipse(lx, 83, 22, 11, M);
      }, M, G, D, 1, 2);
      // Toes at the front of the foot, each with a pale nail.
      pt.vline(lx + 15, 87, 4, D).vline(lx + 18, 87, 4, D);
      pt.rect(lx + 16, 88, 2, 2, p).px(lx + 16, 88, P);
      pt.rect(lx + 19, 89, 2, 2, p).px(lx + 19, 89, P);
    }

    // The body: a huge round belly with heavy shoulders that rise around the head.
    const body = new Painter(96, 96);
    body.ellipse(12, 28 + up, 70, 58 - up, M);
    body.ellipse(14, 24 + up, 30, 26, M);
    body.ellipse(48, 22 + up, 32, 26, M);
    pt.layer((z) => {
      z.stamp(body, 0, 0);
      z.shadeForm(M, G, D, 2, 3);
      z.ditherSwap(M, D, 60, 50, 24, 36);
      // The lighter belly, with a checker step into the skin around it.
      z.ellipse(26, 44 + up, 42, 38 - up, G);
      z.ditherSwap(G, M, 26, 44 + up, 42, 4);
      z.ditherSwap(G, M, 58, 44, 12, 40);
      // Warts on the shoulders.
      for (const [wx, wy] of [[22, 34], [26, 39], [70, 31], [18, 52]]) z.px(wx, wy + up, G).px(wx + 1, wy + up, D).px(wx, wy + 1 + up, D);
      // A navel, and a fold under the chest.
      z.px(44, 58 + up, D).px(45, 58 + up, D).px(45, 59 + up, M);
      z.hline(32, 46 + up, 10, M).hline(50, 46 + up, 10, M);
      // The leather belt across the belly, only where the belly is.
      for (let yy = 66; yy < 73; yy++) {
        for (let xx = 0; xx < 96; xx++) {
          if (body.get(xx, yy) === null) continue;
          z.px(xx, yy, yy === 66 ? k : yy === 72 ? o : b);
        }
      }
      // Stitches along the belt.
      for (let xx = 16; xx < 80; xx += 4) z.px(xx, 69, k);
    });
    // The gold buckle.
    pt.layer((z) => {
      z.rect(40, 64, 13, 11, g);
      z.shadeForm(g, Y, y, 1, 1);
      z.rect(43, 67, 7, 5, b);
      z.rect(44, 68, 5, 3, null);
      z.rect(46, 67, 1, 5, s);
    });

    // The near arm: a thick shoulder and upper arm down his right side.
    part(pt, (z) => {
      if (raised) {
        // Raised: the upper arm goes up and out to the fist above the shoulder.
        z.ellipse(60, 26 + up, 24, 28, M);
        z.poly([66, 30 + up, 82, 22 + up, 84, 30 + up, 76, 44 + up], M);
      } else {
        z.ellipse(60, 28 + up, 24, 34, M);
      }
    }, M, G, D, 2, 3);

    // Pointed ears, sticking out from the sides of the head.
    part(pt, (z) => {
      z.poly([36, 22 + up, 22, 14 + up, 26, 19 + up, 36, 29 + up], M);
      z.poly([60, 21 + up, 74, 11 + up, 71, 17 + up, 61, 28 + up], M);
    }, M, G, D, 1, 1);

    // The head: small for his size, sunk into the shoulders.
    part(pt, (z) => {
      z.ellipse(33, 12 + up, 30, 27, M);
    }, M, G, D, 2, 2);
    // Eyes: small, gold and mean, in dark sockets, looking right.
    for (const ex of [40, 52]) {
      pt.rect(ex - 1, 24 + up, 8, 5, D);
      pt.rect(ex, 25 + up, 6, 3, g);
      pt.hline(ex, 25 + up, 3, Y);
      pt.rect(ex + 3, 25 + up, 2, 3, o);
      // The inner top corner is hidden under the scowl, which slants the eye.
      pt.px(ex === 40 ? ex + 5 : ex, 25 + up, D);
    }
    // The heavy brow: a dark ridge that juts out over the eyes and dips to a scowl in the middle,
    // so it cuts into the inner corner of each eye.
    for (let xx = 36; xx < 62; xx++) {
      const dist = Math.abs(xx - 48.5);
      const dip = dist < 5 ? 2 : dist < 9 ? 1 : 0;
      const top = 19 + dip + up;
      pt.px(xx, top, xx < 49 ? G : M);
      pt.px(xx, top + 1, D).px(xx, top + 2, D);
      if (dist < 9) pt.px(xx, top + 3, o);
    }
    // The wide jaw, jutting under the face, with a dark mouth line.
    part(pt, (z) => {
      z.ellipse(35, 31 + up, 28, 11, M);
    }, M, G, D, 1, 2);
    pt.hline(39, 34 + up, 20, o);
    if (raised) {
      // Roaring: the mouth hangs open between the tusks.
      pt.rect(41, 35 + up, 16, 4, x);
      pt.hline(41, 39 + up, 16, o);
      pt.px(43, 35 + up, P).px(54, 35 + up, P);
    }
    // A flat nose over the top of the jaw, with two nostrils.
    pt.rect(46, 28 + up, 6, 4, M);
    pt.hline(46, 28 + up, 5, G).vline(46, 28 + up, 3, G);
    pt.vline(51, 29 + up, 3, D);
    pt.px(47, 31 + up, o).px(50, 31 + up, o);
    pt.hline(41, 35 + up, 16, x);
    // Two tusks at the corners of the jaw, pointing up past the lip.
    pt.layer((z) => {
      for (const tx of [38, 57]) {
        z.rect(tx, 31 + up, 4, 5, p);
        z.rect(tx + 1, 28 + up, 2, 3, p);
        z.px(tx + 1, 27 + up, P);
        z.vline(tx, 31 + up, 5, P);
        z.vline(tx + 1, 28 + up, 3, P);
        z.vline(tx + 3, 31 + up, 5, q);
      }
    });

    if (raised) {
      // The fist up beside his head, closed round the end of the handle.
      part(pt, (z) => {
        z.ellipse(70, 12 + up, 16, 16, M);
      }, M, G, D, 1, 2);
      for (const fx of [74, 77, 80]) pt.vline(fx, 15 + up, 6, D);
      pt.hline(73, 21 + up, 9, D);
      pt.layer((z) => {
        z.rect(85, 20 + up, 5, 5, k);
        z.hline(85, 20 + up, 5, K);
        z.hline(85, 24 + up, 5, b);
      });
    } else {
      // The club's handle, held in front of the shoulder, and the fist closed round it.
      clubHandle(pt, lean, up);
      // The fist, seen from the side: the back of the hand, then the curled fingers stacked down the front.
      part(pt, (z) => {
        z.ellipse(64, 45 + up, 15, 15, M);
        z.rect(70, 47 + up, 9, 11, M);
      }, M, G, D, 1, 2);
      for (const fy of [50, 53, 56]) pt.hline(72, fy + up, 6, D);
      pt.vline(71, 49 + up, 8, D);
      // The handle shows again below the fist.
      pt.layer((z) => {
        z.rect(70, 60 + up, 4, 6, k);
        z.vline(70, 60 + up, 6, K);
        z.vline(73, 60 + up, 6, b);
      });
    }

    // The dented iron crown, with one red jewel.
    pt.layer((z) => {
      z.rect(37, 9 + up, 22, 6, s);
      // Points: the middle one tall, the left bent over where it took a blow.
      z.poly([37, 9 + up, 37, 4 + up, 41, 9 + up], s);
      z.poly([45, 9 + up, 48, 2 + up, 51, 9 + up], s);
      z.poly([55, 9 + up, 59, 3 + up, 59, 9 + up], s);
      z.poly([41, 9 + up, 40, 6 + up, 44, 5 + up, 44, 9 + up], s);
      z.shadeForm(s, S, t, 1, 1);
      z.hline(37, 13 + up, 22, t);
      // A dent in the band.
      z.px(54, 11 + up, t).px(55, 12 + up, t).px(53, 10 + up, S);
      // Rivets along the band.
      z.px(39, 12 + up, S).px(56, 12 + up, S);
      // The jewel.
      z.rect(46, 9 + up, 4, 5, r);
      z.rect(45, 10 + up, 6, 3, r);
      z.px(46, 10 + up, R).px(47, 10 + up, R).px(46, 11 + up, R);
      z.px(49, 13 + up, x).px(50, 12 + up, x);
    });
  });
}

// ---------- Small: 32 by 32 ----------

const SMALL = [
  '................................',
  '............o..oso..o.....so....',
  '...........osoosssooso...oKbo...',
  '...........oSSsRrsssso..oKkkbo..',
  '...........ottttttttto.oKkkkkbo.',
  '........G...oooooooooooGokkkkbo.',
  '.......oGMM.oGMMMMMDoMMoKkkkkbo.',
  '........oMDoGMMMMMMMDoooKkkkkbs.',
  '.......ooooGDDDDDDDDDDooookkkbo.',
  '......oGGGoGDgoDDgoDMDoGGDokbo..',
  '.....oGMMDoGMMMGMMMMMDoGMssst...',
  '...ooGMMMDoDPMMMMMMMPDoGMKbo....',
  '..oGoGMMMMDopooooooopoDDDKbDo...',
  '.oGDoGMMMMMDoDMMMMMDooooobMDo...',
  '.oGDoGMMMMMMDoDDDDDooGGGDoDDo...',
  'oGMDoGMMMMMMMGooooooGMMMMDoDo...',
  'oGMDoGMMMMMGGGGGGGGoGMMMMDoDo...',
  'oGDoGMMMMGGGGGGGGGGoGMMMMDoDo...',
  'oGDoGMMMMGGGGGGGGGGoDMMMMDooo...',
  'oGDoGMMMGGGGGGGGGGGGoDDDDoDoo...',
  'oGDoGMMMGGGGGGGGGGGGGooKbDoDo...',
  'oGDoGMMMGGGGGGYgggGGGGooooGDo...',
  'oGDokkkkkkkkkkgbbgkkkkkkkkkko...',
  'oGDoobbbbbbbbbgbbgbbbbbbbbbo....',
  'oGMDoDMMMGGGGGgggyGGGGMMMMDo....',
  'oDMMDoDMMMMGGGGGGGGGMMMMMDo.....',
  '.oDDDDoDMMMMMGGGGGMMMMMMDo......',
  '..oooo.oDMMMMMMMMMMMMMMDDo......',
  '.......oDMMMMDoooDMMMMMDo.......',
  '......oGMMMMMpDo.oGMMMMMpDo.....',
  '......oDDDDDDDDo.oDDDDDDDDo.....',
  '.......oooooooo...oooooooo......',
];

function smallFrame(i: number): Sprite {
  return makeSprite(32, 32, (pt) => {
    pt.grid(SMALL, KEY);
    if (i === 1) {
      // Breathing out: the head sinks a pixel into the shoulders and the club settles with it.
      pt.move(11, 0, 12, 15, 0, 1);
      pt.move(23, 0, 9, 10, 0, 1);
    }
    pt.outline(o);
  });
}

/** The boss's art: the usual enemy frames, plus an optional pose for winding up a heavy blow. */
export interface BossArt extends EnemyArt {
  /**
   * Optional, 96 by 96, facing right, same box and ground line as `large`: the club swung back
   * over his head and the mouth open in a roar. Loop it like `large`. Nothing depends on it.
   */
  windup: Sprite[];
}

export const art: () => EnemyArt = lazy((): BossArt => ({
  small: [0, 1].map(smallFrame),
  large: BREATH.map((_, i) => largeFrame(i)),
  frameTime: 0.4,
  windup: [0, 1].map((i) => largeFrame(i, true)),
}));
