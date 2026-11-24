// Mogrum the Ork, the boss. A placeholder: one plan drawn at two scales.
// To be redrawn by hand at 32 by 32 (the map) and 96 by 96 (the battle).
import { C, PAL } from '../colors';
import { Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';
import { planPart } from './placeholder';

const L = PAL.moss2;
const M = PAL.moss1;
const D = PAL.moss0;

function frame(size: number, k: number, i: number): Sprite {
  return makeSprite(size, size, (p) => {
    const b = i * 0.5;
    // The club over the right shoulder.
    planPart(p, k, (z) => z.rect(12, 3, 1, 7, PAL.wood0));
    planPart(p, k, (z) => {
      z.ellipse(10.5, 0.5, 4, 5, PAL.wood1);
      z.shade(PAL.wood1, PAL.wood2, PAL.wood0);
      z.dot(11.5, 1.5, PAL.steel1);
      z.dot(13, 3, PAL.steel1);
    });
    planPart(p, k, (z) => {
      z.ellipse(3.5, 13, 4, 2, D);
      z.ellipse(8.5, 13, 4, 2, D);
    });
    planPart(p, k, (z) => z.ellipse(1, 7 + b, 3, 5, D));
    planPart(p, k, (z) => {
      z.ellipse(2, 6 + b, 12, 8.5 - b, M);
      z.shade(M, L, D);
      z.rect(2.5, 11, 11, 1, PAL.wood0);
      z.rect(7, 11, 2, 1, PAL.gold1);
    });
    planPart(p, k, (z) => z.ellipse(11.5, 5.5 + b, 3, 5, D));
    planPart(p, k, (z) => {
      z.poly([4.5, 4 + b, 2, 2.5 + b, 4.5, 3 + b], M);
      z.poly([11.5, 4 + b, 14, 2.5 + b, 11.5, 3 + b], M);
      z.ellipse(4, 2 + b, 8, 6, M);
      z.shade(M, L, D);
      z.rect(5, 3.5 + b, 6, 0.5, D);
      z.dot(6, 4 + b, PAL.gold1);
      z.dot(9, 4 + b, PAL.gold1);
      z.dot(6, 6 + b, PAL.parch2);
      z.dot(9, 6 + b, PAL.parch2);
    });
    planPart(p, k, (z) => {
      z.rect(5, 1.5 + b, 6, 1, PAL.steel0);
      z.dot(7.5, 1.5 + b, PAL.red1);
    });
    p.outline(C.outline);
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: [frame(32, 2, 0), frame(32, 2, 1)],
  large: [frame(96, 6, 0), frame(96, 6, 1)],
  frameTime: 0.55,
}));
