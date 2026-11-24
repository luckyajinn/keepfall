// Rust Guard. A placeholder: one plan drawn at two scales. To be redrawn by hand at 16 by 16 and 64 by 64.
import { C, PAL } from '../colors';
import { Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';
import { planPart } from './placeholder';

// Rusted iron: light, base, shadow.
const L = PAL.ember1;
const M = PAL.ember0;
const D = PAL.red0;

function frame(size: number, k: number, i: number): Sprite {
  return makeSprite(size, size, (p) => {
    const b = i * 0.5;
    planPart(p, k, (z) => {
      z.rect(12, 1, 1, 13, PAL.wood0);
    });
    planPart(p, k, (z) => {
      z.poly([13, 1, 15, 3, 13, 6], PAL.steel1);
      z.shade(PAL.steel1, PAL.steel2, PAL.steel0);
    });
    planPart(p, k, (z) => {
      z.rect(5, 12, 2, 3, D);
      z.rect(8, 12, 2, 3, D);
    });
    planPart(p, k, (z) => {
      z.rect(4, 7 + b, 7, 6, M);
      z.shade(M, L, D);
    });
    planPart(p, k, (z) => {
      z.ellipse(3, 6 + b, 3, 3, M);
      z.ellipse(9, 6 + b, 3, 3, M);
      z.shade(M, L, D);
    });
    planPart(p, k, (z) => {
      z.rect(5, 2 + b, 6, 5, M);
      z.shade(M, L, D);
      z.rect(4, 2 + b, 8, 1, D);
      z.rect(7, 4 + b, 4, 1, C.outline);
      z.dot(9, 4 + b, PAL.ember2);
    });
    planPart(p, k, (z) => z.dot(11, 9 + b, L));
    p.outline(C.outline);
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: [frame(16, 1, 0), frame(16, 1, 1)],
  large: [frame(64, 4, 0), frame(64, 4, 1)],
  frameTime: 0.5,
}));
