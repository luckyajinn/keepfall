// Rafter Lurker. A placeholder: one plan drawn at two scales. To be redrawn by hand at 16 by 16 and 64 by 64.
import { C, PAL } from '../colors';
import { Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';
import { planPart } from './placeholder';

const L = PAL.plum1;
const M = PAL.plum0;
const D = PAL.night2;

function frame(size: number, k: number, i: number): Sprite {
  return makeSprite(size, size, (p) => {
    const b = i;
    planPart(p, k, (z) => {
      z.poly([4, 12, 1, 8, 5, 10], PAL.plum1);
      z.poly([12, 12, 15, 8, 11, 10], PAL.plum1);
    });
    planPart(p, k, (z) => {
      z.ellipse(3, 3 + b, 10, 12 - b, M);
      z.shade(M, L, D);
      z.ellipse(6, 8, 6, 6, L);
      z.dot(8, 6 + b, PAL.gold1);
      z.dot(11, 6 + b, PAL.gold1);
      z.dot(10, 4 + b, PAL.gold1);
      z.dot(8, 10, PAL.parch2);
      z.dot(11, 10, PAL.parch2);
    });
    p.outline(C.outline);
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: [frame(16, 1, 0), frame(16, 1, 1)],
  large: [frame(64, 4, 0), frame(64, 4, 1)],
  frameTime: 0.45,
}));
