// Tallow Wisp. A placeholder: one plan drawn at two scales. To be redrawn by hand at 16 by 16 and 64 by 64.
// No glow: light in this art style is flat colors only.
import { C, PAL } from '../colors';
import { Sprite, lazy, makeSprite } from '../pixel';
import type { EnemyArt } from './art';
import { planPart } from './placeholder';

function frame(size: number, k: number, i: number): Sprite {
  return makeSprite(size, size, (p) => {
    const lean = i ? 1 : 0;
    planPart(p, k, (z) => {
      z.poly([8 + lean, 1, 12, 6, 12, 10, 10, 12, 6, 12, 4, 10, 4, 6], PAL.ember1);
      z.shade(PAL.ember1, PAL.ember2, PAL.ember0);
      z.poly([8 + lean * 0.5, 5, 10, 8, 10, 11, 6, 11, 6, 8], PAL.gold1);
      z.shade(PAL.gold1, PAL.gold2, PAL.gold1);
      z.dot(6, 8, C.outline);
      z.dot(9, 8, C.outline);
    });
    planPart(p, k, (z) => {
      z.rect(5, 12, 6, 3, PAL.parch1);
      z.shade(PAL.parch1, PAL.parch2, PAL.parch0);
    });
    p.outline(C.outline);
  });
}

export const art: () => EnemyArt = lazy(() => ({
  small: [frame(16, 1, 0), frame(16, 1, 1)],
  large: [frame(64, 4, 0), frame(64, 4, 1)],
  frameTime: 0.2,
}));
