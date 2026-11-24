// Gate Hound. A placeholder: one plan drawn at two scales. To be redrawn by hand at 16 by 16 and 64 by 64.
import { C, PAL } from '../colors';
import { Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';
import { planPart } from './placeholder';

const L = PAL.plum2;
const M = PAL.plum1;
const D = PAL.plum0;

function frame(size: number, k: number, i: number): Sprite {
  return makeSprite(size, size, (p) => {
    const b = i * 0.5;
    planPart(p, k, (z) => z.poly([4, 7, 1, 3, 2, 3, 5, 6], D));
    planPart(p, k, (z) => {
      z.rect(3, 11, 2, 4, D);
      z.rect(10, 11, 2, 4, D);
    });
    planPart(p, k, (z) => {
      z.ellipse(2, 6 + b, 11, 7 - b, M);
      z.shade(M, L, D);
      z.rect(6, 11, 2, 3, D);
    });
    planPart(p, k, (z) => z.poly([10, 5, 11, 1, 12.5, 4], D));
    planPart(p, k, (z) => {
      z.ellipse(10, 3 + b, 5, 6, M);
      z.rect(13, 6 + b, 2, 2, M);
      z.shade(M, L, D);
      z.dot(12, 4 + b, PAL.ember2);
      z.dot(14, 8 + b, PAL.parch2);
    });
    planPart(p, k, (z) => z.rect(9, 6 + b, 1, 5, PAL.red0));
    p.outline(C.outline);
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: [frame(16, 1, 0), frame(16, 1, 1)],
  large: [frame(64, 4, 0), frame(64, 4, 1)],
  frameTime: 0.3,
}));
