// Cellar Rat. A placeholder: one plan drawn at two scales. To be redrawn by hand at 16 by 16 and 64 by 64.
import { C, PAL } from '../colors';
import { Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';
import { planPart } from './placeholder';

const furL = PAL.wood1;
const fur = PAL.wood0;
const furD = PAL.night4;
const pink = PAL.red2;

function frame(size: number, k: number, i: number): Sprite {
  return makeSprite(size, size, (p) => {
    const b = i; // the body sinks a little in the second frame
    planPart(p, k, (z) => z.line(4, 11, 1, 8, PAL.parch0));
    planPart(p, k, (z) => z.ellipse(9, 3 + b * 0.5, 3, 3, pink));
    planPart(p, k, (z) => {
      z.ellipse(3, 6 + b * 0.5, 10, 7 - b * 0.5, fur);
      z.shade(fur, furL, furD);
    });
    planPart(p, k, (z) => {
      z.ellipse(9, 5 + b * 0.5, 6, 6, fur);
      z.rect(13, 8, 1, 2, fur);
      z.shade(fur, furL, furD);
      z.dot(12, 7, PAL.ember2);
      z.dot(14, 8, pink);
    });
    planPart(p, k, (z) => {
      z.rect(5, 12, 2, 1, pink);
      z.rect(10, 12, 2, 1, pink);
    });
    p.outline(C.outline);
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: [frame(16, 1, 0), frame(16, 1, 1)],
  large: [frame(64, 4, 0), frame(64, 4, 1)],
  frameTime: 0.35,
}));
