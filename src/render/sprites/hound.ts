// Gate Hound: a lean, dark guard dog seen from the side, facing right, with a spiked rust collar.
//
// The coat uses the plum ramp, which keeps the hound dark but still clear of the brown floor and
// the dark battle wall, since its hue differs from both.
// Small (16 by 16, the map): two character grids. The coat is drawn in one tone ('m') and shaded
// with light from the upper left; the eye, fang, collar and the far legs are placed by hand.
// Large (64 by 64, the battle): built with painter calls, back to front, each part on its own
// outlined layer with three flat tones.
// Idle: panting (the jaw opens and the chest rises), and the ear and tail flick.

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';

// Coat: highlight, base, shadow. Collar: rust tones. Then the eye, the fang, the tongue.
const H = PAL.plum2;
const m = PAL.plum1;
const d = PAL.plum0;
const c = PAL.ember0;
const r = PAL.red0;
const L = PAL.ember1;
const E = PAL.ember2;
const W = PAL.parch2;
const T = PAL.red2;
const o = C.outline;

const KEY = { H, m, d, c, r, L, E, W, T, o };

// ---------- Small: 16 by 16 ----------

const SMALL_A = [
  '................',
  '..........H.....',
  '.........Hmd....',
  '.........HHmm...',
  '.H.....LcmmEmm..',
  '..H..HHcmmmmmmo.',
  '..HHHmmcmmmmmd..',
  '..mmmmmmcddW....',
  '..mmmmmmmmd.....',
  '..mm...mmd......',
  '..md...dmd......',
  '...md..d.md.....',
  '...md..d.md.....',
  '..md...d.md.....',
  '..mmd..dd.mmd...',
  '................',
];

// The second frame: the ear flicks back, the tail drops, and the jaw opens to pant.
const SMALL_B = [
  '................',
  '...........H....',
  '.........Hmmd...',
  '.........HHmm...',
  '..H....LcmmEmm..',
  '..H..HHcmmmmmmo.',
  '..HHHmmcmmmmmd..',
  '..mmmmmmcdTW....',
  '..mmmmmmmmdT....',
  '..mm...mmd......',
  '..md...dmd......',
  '...md..d.md.....',
  '...md..d.md.....',
  '..md...d.md.....',
  '..mmd..dd.mmd...',
  '................',
];

function small(rows: string[]): Sprite {
  return makeSprite(16, 16, (q) => {
    q.grid(rows, KEY);
    q.outline(o);
  });
}

// ---------- Large: 64 by 64 ----------

/** Draws one part of the coat with three flat tones on its own outlined layer. `far` paints it a step darker. */
function part(q: Painter, paint: (z: Painter) => void, far = false, lightDepth = 1, darkDepth = 2): void {
  q.layer((z) => {
    paint(z);
    if (far) z.swap(m, d).edge(d, m, 'u');
    else z.shadeForm(m, H, d, lightDepth, darkDepth);
  });
}

/** A leg: a straight shank from (x, top) down to a paw on the ground line. */
function foreleg(q: Painter, x: number, top: number, far: boolean): void {
  part(q, (z) => {
    z.rect(x, top, 4, 56 - top, m);
    z.poly([x - 1, top, x + 5, top, x + 4, top + 9, x, top + 9], m);
    z.ellipse(x - 1, 55, 9, 6, m);
  }, far, 1, 1);
}

/** A hind leg, bent at the hock like a dog's: thigh, shank sloping back, then a paw. */
function hindleg(q: Painter, x: number, far: boolean): void {
  part(q, (z) => {
    z.poly([x + 3, 32, x + 12, 35, x + 13, 41, x + 7, 50, x + 2, 49], m);
    z.rect(x + 2, 48, 4, 9, m);
    z.ellipse(x, 55, 9, 6, m);
  }, far, 1, 1);
}

function large(pant: number): Sprite {
  return makeSprite(64, 64, (q) => {
    const k = pant;
    // The far legs, a step darker.
    hindleg(q, 14, true);
    foreleg(q, 33, 38, true);
    // The near foreleg goes in before the body, so the deep chest covers its top.
    foreleg(q, 40, 36, false);
    // A short tail held up behind.
    part(q, (z) => {
      z.poly([11, 30, 3, 18 - k, 5, 16 - k, 14, 27], m);
    }, false, 1, 1);
    // The lean body: a deep chest, a tucked belly and a narrow rump.
    part(q, (z) => {
      z.poly([8, 27, 20, 24, 34, 21 - k, 44, 22 - k, 47, 30, 46, 40, 40, 46, 32, 46, 24, 37, 16, 39, 9, 38, 6, 32], m);
      z.ellipse(4, 23, 18, 18, m);
      z.ellipse(28, 19 - k, 20, 29 + k, m);
    }, false, 1, 3);
    // Ribs showing along the flank: it is lean and hungry.
    for (const y of [31, 34, 37]) q.line(26, y - k, 30, y + 1 - k, d);
    // The near hind leg, over the body, so the line of the thigh shows.
    hindleg(q, 5, false);
    // The far ear, behind the head.
    part(q, (z) => z.poly([41, 16, 42, 3, 46, 13], m), true);
    // The head: a narrow skull and a long muzzle.
    part(q, (z) => {
      z.ellipse(39, 11, 17, 18, m);
      z.poly([48, 15, 59, 19, 62, 22, 62, 26, 56, 28, 46, 28], m);
      // The lower jaw, which drops when it pants.
      z.poly([46, 26, 58, 27 + k, 57, 30 + k * 2, 46, 30], m);
    }, false, 1, 2);
    // The near ear: tall and pointed.
    part(q, (z) => z.poly([44, 15, 48, 1, 52, 13], m), false, 1, 1);
    q.poly([46, 12, 48, 5, 49, 12], d);
    // The nose, a snarl line, the brow and the ember eye.
    q.rect(60, 20, 3, 3, o).px(60, 20, PAL.steel0);
    q.line(48, 27, 61, 26, o);
    if (k > 0) {
      // The mouth hangs open: a dark inside and the tongue.
      q.poly([50, 27, 60, 26, 58, 28 + k, 50, 28], o);
      q.rect(52, 28, 4, 3, T).px(55, 30, PAL.red1);
    }
    q.line(45, 14, 51, 16, o);
    q.rect(47, 16, 4, 2, E);
    q.px(50, 17, L);
    // A white fang over the lower lip.
    q.rect(56, 27, 2, 2, W).px(56, 29, W);
    // The spiked collar, rust colored, around the neck.
    q.layer((z) => {
      z.poly([36, 17, 41, 15, 45, 31 - k, 40, 34 - k], c);
      z.edge(c, r, 'dr');
      z.edge(c, L, 'ul');
      for (const [x, y] of [[37, 21], [38, 26], [39, 31]]) {
        z.poly([x, y - k, x - 4, y - 2 - k, x, y + 2 - k], L);
        z.px(x - 1, y + 1 - k, c);
      }
    });
  });
}

/** The hound's sprites, built on first use. */
export const art: () => EnemyArt = lazy(() => ({
  small: [small(SMALL_A), small(SMALL_B)],
  large: [large(0), large(1)],
  frameTime: 0.3,
}));
