// Rafter Lurker: the ambusher that drops from the rafters. A hunched plum blob with a lighter
// belly, two wide gold eyes and a small third one above them, two white fangs and a hooked claw
// at each side. Sneaky and a little comic.
//
// Small (16 by 16): character grids. Large (64 by 64): painter calls, each part on its own
// outlined layer, back to front. Both sizes play the same loop: rest, breathe in (the body swells
// up a pixel), rest with the eyes darting back, and a blink.

import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';

const H = PAL.plum2;
const m = PAL.plum1;
const d = PAL.plum0;
const Y = PAL.gold2;
const g = PAL.gold1;
const y = PAL.gold0;
const W = PAL.parch2;
const w = PAL.parch1;
const v = PAL.parch0;
const r = PAL.red0;
const o = C.outline;

const KEY = { H, m, d, B: H, Y, g, y, W, w, v, r, o };

/** The loop: 0 rest, 1 breathe in, 2 rest with the eyes looking back, 3 blink. */
const POSES = [0, 1, 0, 2, 0, 3];

// ---------- Small: 16 by 16 ----------
// The body, hunched forward to the right. The eyes (rows 6 and 7) are laid over it per pose.
// B is the lighter belly. The claws are pale hooks at each side.

const SMALL_BODY = [
  '................',
  '................',
  '......HHmm......',
  '.....Hmmmmmd....',
  '....Hmmmmgmmd...',
  '...Hmmmmmmmmmd..',
  '...Hmmmmmmmmmd..',
  '...Hmmmmmmmmmd..',
  '..WmmmmmmmmmmdW.',
  '..wHmmmooooomdw.',
  '.wwmmmmWBBWmdww.',
  '..dmmmBBBBBmmd..',
  '...dmBBBBBBmd...',
  '....ddddddddd...',
  '....dd.....dd...',
  '................',
];

/** The two eyes, rows 6 and 7, for each pose: open looking right, open looking back, shut. */
const SMALL_EYES: Record<'right' | 'back' | 'shut', string[]> = {
  right: ['.......gg.gg....', '.......go.go....'],
  back: ['.......gg.gg....', '.......og.og....'],
  shut: ['.......mm.mm....', '.......oo.oo....'],
};

function smallFrame(pose: number): Sprite {
  return makeSprite(16, 16, (p) => {
    // Breathing in: the top of the body rises a pixel and the middle row is doubled.
    const up = pose === 1 ? 1 : 0;
    p.grid(SMALL_BODY.slice(7), KEY, 0, 7);
    p.grid(SMALL_BODY.slice(0, 8), KEY, 0, -up);
    const eyes = pose === 2 ? SMALL_EYES.back : pose === 3 ? SMALL_EYES.shut : SMALL_EYES.right;
    p.grid(eyes, KEY, 0, 6 - up);
    p.outline(o);
  });
}

// ---------- Large: 64 by 64 ----------

// A hooked claw facing right: an arm stub and two pale hooks curling up. The left claw is this mirrored.
const CLAW = [
  '........W..',
  '.........W.',
  '.........wv',
  '...W.....wv',
  '....W...wwv',
  '....wv..wwv',
  '....wv.wwv.',
  '....wwwwwv.',
  '..mmwwwwv..',
  'mmmmmwwv...',
  'mmmmmmmd...',
  'dmmmmmd....',
  '.dddd......',
];

function claw(p: Painter, x: number, yy: number, right: boolean): void {
  const rows = right ? CLAW : CLAW.map((row) => row.split('').reverse().join(''));
  p.layer((q) => {
    q.grid(rows, { m, d, W, w, v }, x, yy);
  });
}

function largeFrame(pose: number): Sprite {
  return makeSprite(64, 64, (p) => {
    const lift = pose === 1 ? 1 : 0;
    // The far claw, raised behind the hump, and the stubby feet.
    claw(p, 2, 33 - lift, false);
    p.layer((q) => {
      q.rect(15, 55, 10, 5, d);
      q.rect(38, 55, 11, 5, d);
      q.edge(d, m, 'u');
    });
    // The body: a hump at the back, the face pushed forward and down to the right.
    p.layer((q) => {
      q.ellipse(7, 9 - lift, 40, 42 + lift, m);
      q.ellipse(20, 17 - lift, 37, 40 + lift, m);
      q.ellipse(8, 30, 50, 28, m);
      q.shadeForm(m, H, d, 2, 3);
      // A checker step from base to shadow on the lower right.
      q.ditherSwap(m, d, 44, 38, 14, 20);
      // Bumps along the hump.
      for (const [bx, by] of [[15, 17], [21, 13], [12, 27], [27, 11]]) {
        q.px(bx, by - lift, H).px(bx + 1, by - lift, H).px(bx, by + 1 - lift, d).px(bx + 1, by + 1 - lift, d);
      }
      // The lighter belly, low and forward.
      q.ellipse(22, 39, 28, 19 + lift, H);
      q.ditherSwap(H, m, 22, 39, 28, 3);
      q.edge(H, m, 'dr', 1);
      q.edge(m, d, 'd', 1);
    });
    // The mouth: a wide grin with two fangs hanging over the lip.
    p.layer((q) => {
      q.rect(33, 39, 18, 2, r);
      q.px(32, 38, r).px(51, 38, r);
      q.hline(34, 39, 16, o);
    }, o);
    p.layer((q) => {
      for (const fx of [36, 45]) {
        q.rect(fx, 40, 3, 2, W);
        q.px(fx + 1, 42, W);
        q.px(fx + 2, 41, w);
      }
    });
    // Eyes: two wide gold eyes and a small third one above, looking toward the foe on the right.
    const ey = 25 - lift;
    const look = pose === 2 ? -1 : 1;
    const eye = (x: number, yy: number, ew: number, eh: number, pw: number, ph: number): void => {
      p.layer((q) => {
        if (pose === 3) {
          // Shut: a lid of body color with a dark lash line.
          q.rect(x, yy + Math.floor(eh / 2) - 1, ew, 2, m);
          q.hline(x, yy + Math.floor(eh / 2), ew, o);
          return;
        }
        q.ellipse(x, yy, ew, eh, g);
        q.edge(g, y, 'dr', 1);
        q.edge(g, Y, 'ul', 1);
        const px = x + Math.floor((ew - pw) / 2) + look * Math.floor(ew / 4);
        q.rect(px, yy + Math.floor((eh - ph) / 2), pw, ph, o);
        q.px(px, yy + Math.floor((eh - ph) / 2), W);
      });
    };
    eye(29, ey, 11, 9, 3, 5);
    eye(43, ey, 11, 9, 3, 5);
    eye(39, ey - 9, 6, 6, 2, 2);
    // The near claw, reaching forward on the right.
    claw(p, 50, 38 - lift, true);
  });
}

export const art: () => EnemyArt = lazy(() => {
  // Each pose is built once; the loop shows the rest pose between the others.
  const small = [0, 1, 2, 3].map(smallFrame);
  const large = [0, 1, 2, 3].map(largeFrame);
  return {
    small: POSES.map((i) => small[i]),
    large: POSES.map((i) => large[i]),
    frameTime: 0.35,
  };
});
