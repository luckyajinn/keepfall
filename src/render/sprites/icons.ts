// Icons for the HUD and the menus: coin, potion, sword, shield, armor and trinket.
// Small icons are 8 by 8 (the HUD and menu rows), large ones 24 by 24 (the reward screen).
// Placeholders, but drawn by hand for each size. The trinket is drawn in the teal ramp and
// recolored for each trinket's own color by drawIcon.
import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { IconArt, IconName } from './art';

const W = PAL.steel2;
const s = PAL.steel1;
const d = PAL.steel0;
const Y = PAL.gold2;
const g = PAL.gold1;
const y = PAL.gold0;

function icon(w: number, paint: (p: Painter) => void): Sprite {
  return makeSprite(w, w, (p) => {
    paint(p);
    p.outline(C.outline);
  });
}

const small: Record<IconName, () => Sprite> = {
  coin: () =>
    icon(8, (p) => {
      p.ellipse(1, 1, 6, 6, g).shadeForm(g, Y, y);
      p.vline(4, 3, 2, y);
    }),
  potion: () =>
    icon(8, (p) => {
      p.hline(3, 1, 2, PAL.wood1);
      p.hline(3, 2, 2, PAL.parch1);
      p.ellipse(1, 3, 6, 4, PAL.red1).shadeForm(PAL.red1, PAL.red2, PAL.red0);
      p.px(2, 4, PAL.parch2);
    }),
  sword: () =>
    icon(8, (p) => {
      p.px(6, 1, W).px(5, 2, W).px(4, 3, s);
      p.px(2, 3, g).px(3, 4, g).px(4, 5, y);
      p.px(2, 5, PAL.wood0).px(1, 6, y);
    }),
  shield: () =>
    icon(8, (p) => {
      p.poly([1, 1, 7, 1, 7, 4, 4, 7, 1, 4], PAL.teal1).shadeForm(PAL.teal1, PAL.teal2, PAL.teal0);
      p.px(3, 3, g).px(4, 3, y);
    }),
  armor: () =>
    icon(8, (p) => {
      p.grid(['.ss..ss.', '.ssssss.', '.ssssss.', '..ssss..', '..ssss..'], { s }, 0, 1);
      p.shadeForm(s, W, d);
    }),
  trinket: () =>
    icon(8, (p) => {
      p.poly([4, 1, 7, 4, 4, 7, 1, 4], PAL.teal1).shadeForm(PAL.teal1, PAL.teal2, PAL.teal0);
    }),
};

const large: Record<IconName, () => Sprite> = {
  coin: () =>
    icon(24, (p) => {
      p.ellipse(2, 2, 20, 20, g).shadeForm(g, Y, y, 2, 2);
      p.ellipse(6, 6, 12, 12, y).ellipse(7, 7, 10, 10, g);
      p.rect(11, 9, 2, 6, y);
      p.px(11, 9, Y);
    }),
  potion: () =>
    icon(24, (p) => {
      p.rect(10, 2, 4, 3, PAL.wood1).shadeForm(PAL.wood1, PAL.wood2, PAL.wood0);
      p.rect(9, 5, 6, 4, PAL.parch1);
      p.ellipse(3, 8, 18, 14, PAL.parch1).shadeForm(PAL.parch1, PAL.parch2, PAL.parch0, 1, 1);
      p.ellipse(5, 11, 14, 10, PAL.red1).shadeForm(PAL.red1, PAL.red2, PAL.red0, 1, 2);
      p.px(8, 12, PAL.parch2).px(8, 13, PAL.parch2).px(9, 12, PAL.parch2);
    }),
  sword: () =>
    icon(24, (p) => {
      p.poly([18, 2, 22, 2, 22, 6, 11, 17, 7, 13], s).shadeForm(s, W, d);
      p.line(20, 4, 10, 14, W);
      p.layer((q) => q.poly([4, 12, 7, 9, 15, 17, 12, 20], g).shadeForm(g, Y, y));
      p.layer((q) => q.poly([6, 16, 8, 18, 4, 22, 2, 20], PAL.wood0).edge(PAL.wood0, PAL.wood1, 'ul'));
      p.layer((q) => q.circle(3, 21, 1, g).px(2, 20, Y));
    }),
  shield: () =>
    icon(24, (p) => {
      p.poly([3, 2, 21, 2, 21, 12, 12, 22, 3, 12], g).shadeForm(g, Y, y);
      p.poly([5, 4, 19, 4, 19, 11.5, 12, 19.5, 5, 11.5], PAL.teal1).shadeForm(PAL.teal1, PAL.teal2, PAL.teal0, 1, 2);
      p.circle(12, 10, 2, g).px(11, 9, Y).px(13, 11, y);
    }),
  armor: () =>
    icon(24, (p) => {
      p.poly([3, 3, 9, 3, 12, 6, 15, 3, 21, 3, 19, 11, 19, 21, 5, 21, 5, 11], s).shadeForm(s, W, d, 1, 2);
      p.vline(12, 8, 13, d).vline(11, 8, 13, W);
      p.hline(6, 16, 13, d);
    }),
  trinket: () =>
    icon(24, (p) => {
      p.poly([12, 2, 21, 10, 12, 22, 3, 10], PAL.teal1).shadeForm(PAL.teal1, PAL.teal2, PAL.teal0, 1, 2);
      p.poly([12, 2, 21, 10, 3, 10], PAL.teal2);
      p.line(8, 10, 12, 21, PAL.teal0);
      p.px(10, 5, PAL.parch2).px(9, 6, PAL.parch2);
    }),
};

/** Every icon in both sizes, built on first use. */
export const art: () => Record<IconName, IconArt> = lazy(() => {
  const out = {} as Record<IconName, IconArt>;
  for (const name of Object.keys(small) as IconName[]) out[name] = { small: small[name](), large: large[name]() };
  return out;
});

/** The three teal tones the trinket is drawn in, which drawIcon swaps for a trinket's own color. */
export const TRINKET_RAMP = [PAL.teal0, PAL.teal1, PAL.teal2] as const;
