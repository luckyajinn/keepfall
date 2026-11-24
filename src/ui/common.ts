// Helpers shared by the menu style screens.
import type { Action } from '../input';
import { Ctx, hash2 } from '../render/draw';
import { drawSprite, fromPx } from '../render/pixel';
import { frameAt } from '../render/sprites/art';
import { FLAG_AT, WINDOW_AT, backdropParts } from './titleArt';
import { sfx } from '../audio/sfx';

/** Moves a menu index with the up and down actions. Returns the picked row, or -1. */
export function menuInput(pressed: Action[], state: { index: number }, count: number): number {
  for (const a of pressed) {
    if (a === 'up' || a === 'down') {
      state.index = (state.index + count + (a === 'up' ? -1 : 1)) % count;
      sfx.play('move');
    } else if (a === 'confirm') {
      return state.index;
    } else if (/^[1-8]$/.test(a) && Number(a) <= count) {
      state.index = Number(a) - 1;
      return state.index;
    }
  }
  return -1;
}

/**
 * The title backdrop: a dusk sky over the keep and the hills, drawn as one pixel picture that
 * fills the screen. The keep's windows flicker and its flag waves. `dark` gives the deeper,
 * later dusk the win screen uses behind its panel. See titleArt.ts.
 */
export function nightSky(ctx: Ctx, t: number, dark = false): void {
  const art = backdropParts(dark);
  drawSprite(ctx, art.sky, 0, 0);
  // The windows flicker now and then, not on a beat.
  const flicker = hash2(Math.floor(t * 5), 11) < 0.35 ? 1 : 0;
  drawSprite(ctx, art.windows[flicker], fromPx(WINDOW_AT.x), fromPx(WINDOW_AT.y));
  drawSprite(ctx, frameAt(art.flag, t, 0.22), fromPx(FLAG_AT.x), fromPx(FLAG_AT.y));
}
