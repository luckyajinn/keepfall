// Icons for the HUD and the menus: coin, potion, sword, shield, armor and trinket.
//
// Small (8 by 8, the HUD and menu rows): authored as character grids, one pixel at a time,
// then given a 1 pixel outline with outline(). Every pixel counts at this size, so each icon is
// a plain silhouette with one highlight and one shadow tone.
// Large (24 by 24, the reward screen): built with painter calls, each part on its own outlined
// layer with three flat tones and a highlight, like the knight's large sprite.
// Light comes from the upper left. The shield and sword match what the knight carries
// (knight.ts): a teal kite shield with a gold rim and boss, a steel blade with a gold guard.
//
// The trinket is a cut gem drawn only in the three teal tones (TRINKET_RAMP, plus a cream glint
// that never changes), so drawIcon can swap the ramp for each trinket's own color.
import { C, PAL } from '../colors';
import { Painter, Sprite, lazy, makeSprite } from '../pixel';
import type { IconArt, IconName } from './art';

const W = PAL.steel2;
const s = PAL.steel1;
const d = PAL.steel0;
const Y = PAL.gold2;
const g = PAL.gold1;
const y = PAL.gold0;
const R = PAL.red2;
const r = PAL.red1;
const q = PAL.red0;
const T = PAL.teal2;
const t = PAL.teal1;
const u = PAL.teal0;
const B = PAL.wood1;
const b = PAL.wood0;
const P = PAL.parch2;
const o = C.outline;

const KEY = { W, s, d, Y, g, y, R, r, q, T, t, u, B, b, P, o };

/** An icon from character rows, outlined. Rows leave a free pixel at each edge for the outline. */
function small(rows: readonly string[]): () => Sprite {
  return () =>
    makeSprite(8, 8, (p) => {
      p.grid(rows, KEY);
      p.outline(o);
    });
}

// ---------- Small: 8 by 8 ----------

const SMALL: Record<IconName, () => Sprite> = {
  // A round coin with a raised rim, light on the upper left, and a stamped slot in the middle.
  coin: small([
    '........',
    '..YYgg..',
    '.YggggY.',
    '.YgyYgy.',
    '.ggyYgy.',
    '.Ygggyy.',
    '..gyyy..',
    '........',
  ]),
  // A wooden cork, a pale glass neck and a round red flask with a glint.
  potion: small([
    '........',
    '...Bb...',
    '...PW...',
    '..RRrr..',
    '.RPrrrq.',
    '.Rrrrqq.',
    '..rqqq..',
    '........',
  ]),
  // The knight's sword, tip up and to the right: steel blade, gold guard, wood grip, gold pommel.
  sword: small([
    '........',
    '.....WW.',
    '....Wsd.',
    '.Y.Wsd..',
    '..ygd...',
    '..by....',
    '.g..y...',
    '........',
  ]),
  // The knight's kite shield: gold rim along the top, teal face, gold boss.
  shield: small([
    '........',
    '.Yggggy.',
    '.TTtttu.',
    '.TtYgtu.',
    '.Ttgytu.',
    '..Ttuu..',
    '...tu...',
    '........',
  ]),
  // A steel breastplate: two shoulders around the neck, a ridge down the middle, a gold buckle.
  armor: small([
    '........',
    '.Ws..sd.',
    '.WWWssd.',
    '.WsWssd.',
    '..sWsd..',
    '..sWsd..',
    '..dgyd..',
    '........',
  ]),
  // A cut gem: a light table on top, a dark point below, and a cream glint.
  trinket: small([
    '........',
    '..TTTt..',
    '.TPTttu.',
    '.Tttttu.',
    '..ttuu..',
    '...tu...',
    '........',
    '........',
  ]),
};

// ---------- Large: 24 by 24 ----------

/** Draws one part with three flat tones on its own outlined layer. */
function part(p: Painter, paint: (l: Painter) => void, base: string, light: string, dark: string, lightDepth = 1, darkDepth = 1): void {
  p.layer((l) => {
    paint(l);
    l.shadeForm(base, light, dark, lightDepth, darkDepth);
  });
}

function large(paint: (p: Painter) => void): () => Sprite {
  return () => makeSprite(24, 24, paint);
}

const LARGE: Record<IconName, () => Sprite> = {
  coin: large((p) => {
    // The coin's edge shows below its face, so it reads as a thick disc.
    p.layer((l) => {
      l.circle(11, 12, 9, y);
      l.circle(12, 12, 9, y);
      l.edge(y, b, 'dr');
      l.circle(11, 11, 9, g);
      l.circle(12, 11, 9, g);
      l.shadeForm(g, Y, y, 1, 1);
      // A raised rim: a dark groove a step inside the edge, light below it on the lower right.
      const ring = new Painter(24, 24);
      ring.circle(11, 11, 6, g).circle(12, 11, 6, g);
      const inner = new Painter(24, 24);
      inner.circle(11, 11, 5, g).circle(12, 11, 5, g);
      for (let j = 0; j < 24; j++) {
        for (let i = 0; i < 24; i++) {
          if (ring.get(i, j) && !inner.get(i, j)) l.px(i, j, i + j < 23 ? y : Y);
        }
      }
      // The stamp: a small keep tower with a gate, in the gold shadow, lit on its left edge.
      l.rect(9, 8, 6, 7, y);
      l.px(9, 7, y).px(11, 7, y).px(12, 7, y).px(14, 7, y);
      l.vline(9, 8, 7, Y);
      l.rect(11, 12, 2, 3, b);
      l.px(10, 9, b).px(13, 9, b);
      // The glint on the upper left.
      l.px(6, 5, P).px(5, 6, Y).px(7, 4, Y);
    });
  }),
  potion: large((p) => {
    // The glass flask: neck, lip, and a round body full of red potion.
    p.layer((l) => {
      l.rect(9, 5, 6, 2, PAL.steel2);
      l.rect(10, 7, 4, 3, PAL.steel1);
      l.vline(10, 7, 3, PAL.steel2);
      l.vline(13, 7, 3, PAL.steel0);
      l.circle(12, 15, 7, r);
      l.rect(9, 8, 6, 2, r);
      l.shadeForm(r, R, q, 1, 2);
      // The top of the potion inside the neck, a shine down the left side and two bubbles.
      l.hline(10, 9, 4, R);
      l.vline(7, 12, 4, P).px(8, 11, P).px(8, 16, R);
      l.px(14, 13, R).px(15, 16, R).px(16, 15, R);
      l.px(12, 19, q).px(9, 18, q);
    });
    // The cork, pushed into the neck.
    part(p, (l) => l.rect(10, 1, 4, 4, B), B, PAL.wood2, b, 1, 1);
    p.hline(10, 4, 4, b);
  }),
  sword: large((p) => {
    // The blade, tip at the upper right, three pixels wide: highlight, base, shadow.
    p.layer((l) => {
      for (let yy = 2; yy <= 15; yy++) {
        const x = 23 - yy;
        l.px(x - 1, yy, W).px(x, yy, s).px(x + 1, yy, d);
      }
      // The tip.
      l.px(21, 1, W).px(22, 1, s).px(22, 2, d);
      // A fuller groove down the middle.
      for (let yy = 5; yy <= 13; yy++) l.px(23 - yy, yy, PAL.steel2);
    });
    // The cross guard, square to the blade.
    p.layer((l) => {
      for (let k = 0; k < 8; k++) {
        l.px(5 + k, 11 + k, g);
        l.px(6 + k, 11 + k, k < 4 ? Y : g);
        l.px(5 + k, 12 + k, y);
      }
    });
    // The grip, bound in wood, and the gold pommel.
    p.layer((l) => {
      for (let k = 0; k < 4; k++) {
        l.px(7 - k, 16 + k, B).px(8 - k, 16 + k, b).px(7 - k, 17 + k, b);
      }
    });
    p.layer((l) => {
      l.circle(3, 20, 1, g);
      l.px(2, 19, Y).px(3, 19, Y).px(4, 21, y).px(3, 21, y);
    });
  }),
  shield: large((p) => {
    p.layer((l) => {
      l.poly([3, 1, 21, 1, 21, 12, 12, 23, 3, 12], g);
      l.edge(g, y, 'dr');
      l.edge(g, Y, 'ul');
      l.poly([5, 3, 19, 3, 19, 11.5, 12, 20.5, 5, 11.5], t);
      l.shadeForm(t, T, u, 2, 2);
      // The gold boss, lit on its upper left.
      l.circle(12, 10, 2, g);
      l.px(11, 9, Y).px(12, 9, Y).px(11, 8, Y);
      l.px(13, 11, y).px(12, 12, y).px(14, 10, y);
      // Four rivets on the rim.
      l.px(4, 2, PAL.parch2).px(20, 2, y).px(4, 11, y).px(20, 11, y);
    });
  }),
  armor: large((p) => {
    // The breastplate: broad shoulders, a scooped neck, a waist and a flared skirt.
    part(
      p,
      (l) => {
        l.poly([2, 4, 8, 2, 10, 5, 14, 5, 16, 2, 22, 4, 20, 10, 18, 14, 19, 17, 5, 17, 6, 14, 4, 10], s);
      },
      s,
      W,
      d,
      2,
      2,
    );
    // A ridge down the middle catches the light on its left.
    p.vline(11, 6, 11, W).vline(12, 6, 11, d);
    // The belt line, then two plates of the skirt below.
    part(
      p,
      (l) => {
        l.poly([5, 18, 19, 18, 20, 21, 4, 21], s);
      },
      s,
      W,
      d,
      1,
      1,
    );
    // Gold rivets on the shoulders and at the belt.
    p.px(5, 5, g).px(18, 5, y).px(7, 15, g).px(16, 15, y);
  }),
  trinket: large((p) => {
    // A cut gem: the crown (top facets) is light, the pavilion (lower point) goes dark to the right.
    p.layer((l) => {
      // Crown: left facet, table, right facet.
      l.poly([7, 3, 10, 3, 9, 8, 2, 8], T);
      l.poly([10, 3, 14, 3, 15, 8, 9, 8], T);
      l.poly([14, 3, 17, 3, 22, 8, 15, 8], t);
      // Girdle: the widest line.
      l.hline(2, 8, 20, T);
      // Pavilion: three facets down to the point.
      l.poly([2, 9, 9, 9, 12, 22], t);
      l.poly([9, 9, 15, 9, 12, 22], t);
      l.poly([15, 9, 22, 9, 12, 22], u);
      // Facet lines.
      l.line(9, 9, 12, 20, T);
      l.line(14, 9, 12, 20, u);
      l.line(9, 3, 9, 7, t);
      l.line(14, 3, 14, 7, t);
      // The glint on the table.
      l.px(11, 4, P).px(10, 5, P).px(12, 5, P).px(11, 6, P);
      l.px(4, 9, P);
    });
  }),
};

/** Every icon in both sizes, built on first use. */
export const art: () => Record<IconName, IconArt> = lazy(() => {
  const out = {} as Record<IconName, IconArt>;
  for (const name of Object.keys(SMALL) as IconName[]) out[name] = { small: SMALL[name](), large: LARGE[name]() };
  return out;
});

/** The three teal tones the trinket is drawn in, which drawIcon swaps for a trinket's own color. */
export const TRINKET_RAMP = [PAL.teal0, PAL.teal1, PAL.teal2] as const;
