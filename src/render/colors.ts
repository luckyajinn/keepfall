// The one fixed color set for the whole game. Every pixel the game draws should be one of these.
//
// The set is built from the game's warm fantasy colors. Each material has three tones, a shadow,
// a base and a highlight, listed in that order in RAMPS. Light comes from the upper left, so a
// shape's upper left edge takes the highlight and its lower right edge takes the shadow.
// The outline color is a very dark brown, never pure black.
//
// PAL holds every color by its own name. C keeps the older names that the screens already use,
// each mapped onto a color in PAL, so screen code keeps working while it is redrawn.

/** All 32 colors, by name. Each ramp goes shadow (0), base (1), highlight (2). */
export const PAL = {
  // Night browns: outlines, backgrounds, panels and walls. Darkest first.
  night0: '#140c0a',
  night1: '#22150f',
  night2: '#301f17',
  night3: '#45301f',
  night4: '#5e4129',
  // Wood and earth: floors, wooden things, panel edges.
  wood0: '#6e4c32',
  wood1: '#94693f',
  wood2: '#b98d57',
  // Parchment: text, paper, bone, wax.
  parch0: '#8a7558',
  parch1: '#bfa57a',
  parch2: '#f4e4c1',
  // Gold: coins, borders, the menu cursor.
  gold0: '#b07a22',
  gold1: '#f2b84b',
  gold2: '#ffe08a',
  // Ember: fire, warnings, the knight's plume.
  ember0: '#a8441e',
  ember1: '#e2703a',
  ember2: '#ffb35c',
  // Red: health, cloth, blood.
  red0: '#6e2218',
  red1: '#c8442f',
  red2: '#ec7d5e',
  // Moss: the Ork's skin, healing, leaves.
  moss0: '#3f5a27',
  moss1: '#7a9a4a',
  moss2: '#b5cd6f',
  // Teal: the shield, XP, cold things.
  teal0: '#2a5654',
  teal1: '#4e8f8b',
  teal2: '#8fc7b8',
  // Steel greys: armor, blades, stone.
  steel0: '#5f5a55',
  steel1: '#9a948a',
  steel2: '#d6d0c2',
  // Plum: shadowy creatures, magic.
  plum0: '#3b2436',
  plum1: '#6a4560',
  plum2: '#b07ea5',
} as const;

export type PalName = keyof typeof PAL;

/** Each material's shadow, base and highlight. `night` and `wood` together make one long brown ramp. */
export const RAMPS = {
  night: [PAL.night1, PAL.night2, PAL.night3],
  wood: [PAL.wood0, PAL.wood1, PAL.wood2],
  parch: [PAL.parch0, PAL.parch1, PAL.parch2],
  gold: [PAL.gold0, PAL.gold1, PAL.gold2],
  ember: [PAL.ember0, PAL.ember1, PAL.ember2],
  red: [PAL.red0, PAL.red1, PAL.red2],
  moss: [PAL.moss0, PAL.moss1, PAL.moss2],
  teal: [PAL.teal0, PAL.teal1, PAL.teal2],
  steel: [PAL.steel0, PAL.steel1, PAL.steel2],
  plum: [PAL.plum0, PAL.plum1, PAL.plum2],
} as const;

export type RampName = keyof typeof RAMPS;

/** Every color in the set, as lower case #rrggbb. */
export const PALETTE: readonly string[] = Object.values(PAL);

/** The older color names used by the screens, mapped onto the set. New code can use PAL directly. */
export const C = {
  /** The outline around every sprite and pixel panel. */
  outline: PAL.night0,
  bg: PAL.night1,
  bgDeep: PAL.night0,
  ink: PAL.parch2,
  inkDim: PAL.parch1,
  inkFaint: PAL.parch0,
  gold: PAL.gold1,
  goldDark: PAL.gold0,
  goldBright: PAL.gold2,
  ember: PAL.ember1,
  emberDark: PAL.ember0,
  emberBright: PAL.ember2,
  red: PAL.red1,
  redDark: PAL.red0,
  redBright: PAL.red2,
  moss: PAL.moss1,
  mossDark: PAL.moss0,
  mossBright: PAL.moss2,
  teal: PAL.teal1,
  tealDark: PAL.teal0,
  xp: PAL.teal2,
  floorA: PAL.wood0,
  floorB: PAL.night4,
  floorCrack: PAL.night3,
  wall: PAL.night1,
  wallFace: PAL.night3,
  wallFaceLine: PAL.night2,
  panel: PAL.night2,
  panelLight: PAL.night3,
  panelEdge: PAL.wood1,
  steel: PAL.steel2,
  steelDark: PAL.steel0,
  steelShade: PAL.steel1,
  rust: PAL.ember0,
  rustDark: PAL.red0,
  /** Ground shadows under sprites. A flat color now, not a see-through black. */
  shadow: PAL.night0,
} as const;

// Color lookups. These run on strings that screens pass in, so they are cached.

const rgbCache = new Map<string, [number, number, number, number]>();

/** Reads '#rgb', '#rrggbb', 'rgb(...)' and 'rgba(...)' into [r, g, b, alpha 0 to 1]. Anything else reads as the outline color. */
export function parseColor(color: string): [number, number, number, number] {
  let v = rgbCache.get(color);
  if (v) return v;
  const s = color.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^#([0-9a-f]{6})$/))) {
    const n = parseInt(m[1], 16);
    v = [n >> 16, (n >> 8) & 255, n & 255, 1];
  } else if ((m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/))) {
    v = [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16), 1];
  } else if ((m = s.match(/^rgba?\(([^)]*)\)$/))) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    v = [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1];
  } else {
    v = [0x14, 0x0c, 0x0a, 1];
  }
  rgbCache.set(color, v);
  return v;
}

const nearestCache = new Map<string, string>();

/** The color in the set closest to any CSS color (its alpha is ignored). Colors already in the set come back as they are. */
export function nearest(color: string): string {
  let hit = nearestCache.get(color);
  if (hit) return hit;
  const [r, g, b] = parseColor(color);
  let best = PALETTE[0];
  let bestD = Infinity;
  for (const p of PALETTE) {
    const [pr, pg, pb] = parseColor(p);
    // Weighted so that greens count most and blues least, roughly as the eye sees them.
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  hit = best;
  nearestCache.set(color, hit);
  return hit;
}

/** The ramp a set color belongs to, and its step in it (0 shadow, 1 base, 2 highlight). Null for night0 and night4. */
export function rampOf(color: string): { ramp: RampName; step: number } | null {
  const c = nearest(color);
  for (const name of Object.keys(RAMPS) as RampName[]) {
    const i = (RAMPS[name] as readonly string[]).indexOf(c);
    if (i >= 0) return { ramp: name, step: i };
  }
  return null;
}

/** The browns as one long ramp from the outline up to the lightest wood. */
const BROWNS: readonly string[] = [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.wood0, PAL.wood1, PAL.wood2];

/** The chain of tones a color steps along: the browns, or the outline then a material's three tones. */
function chainOf(color: string): readonly string[] {
  const c = nearest(color);
  if (BROWNS.includes(c)) return BROWNS;
  const r = rampOf(c);
  return r ? [PAL.night0, ...RAMPS[r.ramp]] : BROWNS;
}

/** One step lighter in the same ramp (the highlight for a base color). The highlight itself stays. */
export function lighter(color: string): string {
  const chain = chainOf(color);
  const i = chain.indexOf(nearest(color));
  return chain[Math.min(chain.length - 1, i + 1)];
}

/** One step darker in the same ramp (the shadow for a base color). Below the shadow comes the outline color. */
export function darker(color: string): string {
  const chain = chainOf(color);
  const i = chain.indexOf(nearest(color));
  return chain[Math.max(0, i - 1)];
}

/**
 * The ramp whose hue is closest to any CSS color. Unlike nearest(), it compares the mix of red,
 * green and blue more than the brightness, so a pale pink lands in plum, not in light grey.
 * Use it to recolor a three tone sprite (such as a trinket) for a color from outside the set.
 */
export function rampFor(color: string): RampName {
  const [r, g, b] = parseColor(color);
  const sum = Math.max(1, r + g + b);
  // Very dark colors have too little hue to go by: use the ramp of the nearest color, which is the
  // night browns for the dark brown of an empty trinket slot.
  if (sum < 255) return rampOf(color)?.ramp ?? 'night';
  let best: RampName = 'night';
  let bestD = Infinity;
  for (const name of Object.keys(RAMPS) as RampName[]) {
    for (const tone of RAMPS[name]) {
      const [tr, tg, tb] = parseColor(tone);
      const ts = Math.max(1, tr + tg + tb);
      const chroma = (r / sum - tr / ts) ** 2 + (g / sum - tg / ts) ** 2 + (b / sum - tb / ts) ** 2;
      const light = ((sum - ts) / 765) ** 2;
      const d = chroma * 40 + light * 4;
      if (d < bestD) {
        bestD = d;
        best = name;
      }
    }
  }
  return best;
}
