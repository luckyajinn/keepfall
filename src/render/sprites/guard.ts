// Rust Guard: a hollow suit of rusted armor that walks by itself, holding a halberd upright.
//
// Small (16 by 16, the map): one character grid, shaded by hand with light from the upper left.
// The second frame is made from it by sinking everything above the legs a pixel.
// Large (64 by 64, the battle): built with painter calls, back to front, each part on its own
// outlined layer with three flat tones.
// Idle: a slow, stiff sway (the suit sinks a pixel), and the eyes flicker.

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';

// Rusted iron: highlight, base, shadow. Then the glowing eyes, the hollow inside, the halberd.
const H = PAL.ember1;
const m = PAL.ember0;
const d = PAL.red0;
const E = PAL.ember2;
const Y = PAL.gold2;
const k = PAL.night1;
const S = PAL.steel2;
const s = PAL.steel1;
const t = PAL.steel0;
const w = PAL.wood1;
const b = PAL.wood0;
const o = C.outline;

const KEY = { H, m, d, E, Y, k, S, s, t, w, b, o };

// ---------- Small: 16 by 16 ----------

const SMALL_A = [
  '............S...',
  '............wS..',
  '..HHHHHHHHd.wSs.',
  '...Hmmmmmmd.wst.',
  '...HooEoEod.wt..',
  '...Hmmmmmmd.w...',
  '...dddddddd.w...',
  '.HHmHHHHdHmdw...',
  '.HmdHmmmdmddw...',
  '.Hd.Hdmdd.Hmw...',
  '.Hd.Hmmmd.HHmd..',
  '.md.ddddd...w...',
  '....dkkkd...w...',
  '....Hd.Hd...w...',
  '...Hmd.Hmd..w...',
  '................',
];

/** The second frame sinks everything above the legs by a pixel, a slow stiff sway. */
function small(rows: string[], second: boolean): Sprite {
  return makeSprite(16, 16, (q) => {
    q.grid(rows, KEY);
    // The eyes flare pale gold in the first frame and settle to ember in the second.
    if (second) q.move(0, 0, 16, 12, 0, 1);
    else q.swap(E, Y);
    q.outline(o);
  });
}

// ---------- Large: 64 by 64 ----------

/** Draws one rust part with three flat tones on its own outlined layer. */
function part(q: Painter, paint: (z: Painter) => void, lightDepth = 1, darkDepth = 2): void {
  q.layer((z) => {
    paint(z);
    z.shadeForm(m, H, d, lightDepth, darkDepth);
  });
}

/** A rivet: a light dot with a dark dot under it to the right. */
function rivet(q: Painter, x: number, y: number): void {
  q.px(x, y, H).px(x + 1, y + 1, d);
}

function large(sway: number, flicker: boolean): Sprite {
  return makeSprite(64, 64, (q) => {
    const j = sway;
    // The legs, which stay planted: greaves with knee plates and broad sabatons.
    for (const x of [21, 35]) {
      part(q, (z) => z.rect(x, 45, 8, 12, m), 1, 2);
      part(q, (z) => z.rect(x - 1, 49, 10, 3, m), 1, 1);
      part(q, (z) => {
        z.rect(x - 1, 56, 11, 5, m);
        z.rect(x, 55, 8, 1, m);
      }, 1, 1);
    }
    // The dark hollow inside the suit, seen between the plates at the hips.
    q.rect(22, 41 + j, 20, 8, k);
    // The hollow neck, dark between the helm and the breastplate.
    q.rect(23, 20 + j, 18, 7, k);
    // The breastplate, with a raised ridge down the middle and rows of rivets.
    part(q, (z) => {
      z.ellipse(17, 25 + j, 30, 20, m);
      z.rect(19, 31 + j, 26, 11, m);
    }, 2, 3);
    q.vline(31, 26 + j, 13, H).vline(32, 26 + j, 13, d);
    for (const x of [22, 26, 37, 41]) rivet(q, x, 28 + j);
    for (const x of [23, 40]) rivet(q, x, 35 + j);
    q.hline(21, 38 + j, 22, d);
    // Rust pitting and flaking.
    for (const [x, y] of [[20, 32], [27, 33], [36, 31], [43, 33], [25, 36], [35, 36]]) q.px(x, y + j, d);
    for (const [x, y] of [[28, 30], [21, 34], [38, 34]]) q.px(x, y + j, H);
    // The faulds: two bands of plate over the hollow hips.
    part(q, (z) => z.rect(19, 39 + j, 26, 4, m), 1, 1);
    part(q, (z) => {
      z.rect(20, 43 + j, 10, 4, m);
      z.rect(34, 43 + j, 10, 4, m);
    }, 1, 1);
    // The left arm, hanging stiff, and its gauntlet.
    part(q, (z) => z.rect(9, 30 + j, 8, 13, m), 1, 2);
    part(q, (z) => z.ellipse(8, 41 + j, 10, 9, m), 1, 2);
    q.hline(10, 45 + j, 6, d);
    // The right upper arm, reaching forward to the halberd.
    part(q, (z) => z.rect(43, 30 + j, 8, 9, m), 1, 2);
    // The halberd: a wooden shaft, an axe blade, a spike on top and a hook behind.
    q.layer((z) => {
      z.rect(51, 6 + j, 3, 55 - j, w);
      z.vline(53, 6 + j, 55 - j, b);
      z.vline(51, 6 + j, 55 - j, PAL.wood2);
      // Iron bands where the head meets the shaft.
      z.rect(50, 21 + j, 5, 2, t);
    });
    q.layer((z) => {
      z.poly([51, 1 + j, 54, 1 + j, 54, 7 + j, 51, 7 + j], s);
      z.poly([52, -2 + j, 53, -2 + j, 54, 2 + j, 51, 2 + j], s);
      z.edge(s, t, 'r');
      z.edge(s, S, 'l');
    });
    q.layer((z) => {
      // The axe blade on the far side, curved like a crescent.
      z.poly([54, 10 + j, 58, 7 + j, 61, 3 + j, 63, 6 + j, 63, 21 + j, 61, 24 + j, 58, 20 + j, 54, 17 + j], s);
      z.edge(s, t, 'dr', 2);
      z.edge(s, S, 'ul');
      z.vline(61, 7 + j, 3, S);
      // The hook on the near side.
      z.poly([51, 11 + j, 46, 9 + j, 47, 12 + j, 51, 15 + j], s);
      z.edge(s, t, 'd');
    });
    // The right gauntlet, closed around the shaft.
    part(q, (z) => z.ellipse(47, 35 + j, 11, 9, m), 1, 1);
    q.hline(50, 38 + j, 5, d).hline(50, 40 + j, 5, d);
    // Round shoulder plates, each with a rivet.
    part(q, (z) => z.ellipse(7, 21 + j, 17, 13, m), 2, 2);
    part(q, (z) => z.ellipse(40, 21 + j, 17, 13, m), 2, 2);
    rivet(q, 12, 25 + j);
    rivet(q, 45, 25 + j);
    for (const [x, y] of [[16, 27], [10, 29], [49, 28], [43, 30]]) q.px(x, y + j, d);
    // The bucket helm: straight sides, a flat top with a rim, and a dark eye slit.
    part(q, (z) => z.rect(20, 5 + j, 24, 17, m), 2, 3);
    part(q, (z) => z.rect(18, 3 + j, 28, 4, m), 1, 1);
    q.rect(23, 12 + j, 18, 4, o);
    q.rect(31, 16 + j, 2, 5, o);
    for (const [x, y] of [[25, 19], [27, 19], [36, 19], [38, 19]]) q.px(x, y + j, o);
    // Rust pitting on the helm.
    for (const [x, y] of [[24, 8], [37, 9], [41, 18], [22, 20]]) q.px(x, y + j, d);
    // Two glowing eyes inside the slit. They flicker between frames.
    for (const x of [25, 35]) {
      q.rect(x, 13 + j, 4, 2, E);
      q.px(x + 3, 14 + j, H);
      if (!flicker) q.px(x + 1, 13 + j, Y).px(x + 2, 13 + j, Y);
      else q.hline(x, 13 + j, 4, H);
    }
  });
}

/** The guard's sprites, built on first use. */
export const art: () => EnemyArt = lazy(() => ({
  small: [small(SMALL_A, false), small(SMALL_A, true)],
  large: [large(0, false), large(1, true)],
  frameTime: 0.5,
}));
