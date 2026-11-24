// Short on-screen hints that name the controls.
// Each hint has wording for keys, and can have different wording for touch buttons.

export type HintId =
  | 'menuPick'
  | 'menuBuy'
  | 'battleMenu'
  | 'battleNext'
  | 'back'
  | 'toVendor'
  | 'toShop'
  | 'mapMove'
  | 'helpMove'
  | 'helpSound'
  | 'helpPause'
  | 'pauseMenu'
  | 'soundMenu'
  | 'soundMuted';

/** Set `touch` to true while the player is using the touch buttons. */
export const controls = { touch: false };

const HINTS: Record<HintId, { keys: string; touch?: string }> = {
  menuPick: { keys: 'W and S to choose. Enter to pick.', touch: 'Arrows to choose. OK to pick.' },
  menuBuy: { keys: 'W and S to choose. Enter to buy.', touch: 'Arrows to choose. OK to buy.' },
  battleMenu: { keys: 'W and S to choose, Enter to pick', touch: 'Arrows to choose, OK to pick' },
  battleNext: { keys: 'Press Enter to go on', touch: 'Tap OK to go on' },
  back: { keys: 'Press Enter to go back', touch: 'Tap OK to go back' },
  toVendor: { keys: 'Press Enter to visit the vendor', touch: 'Tap OK to visit the vendor' },
  toShop: { keys: 'Press Enter to visit the shop', touch: 'Tap OK to visit the shop' },
  mapMove: {
    keys: 'Move with W A S D. Walk into an enemy to fight it, or go around. Find the stairs.',
    touch: 'Hold an arrow to move. Walk into an enemy to fight it, or go around. Find the stairs.',
  },
  helpMove: {
    keys: 'Move the knight with W, A, S and D. Find the stairs to climb to the next floor.',
    touch: 'Hold an arrow on the pad to move the knight. Find the stairs to climb to the next floor.',
  },
  helpSound: { keys: 'Press M at any time to turn the sound off or on.', touch: 'Tap Sound at any time to turn the sound off or on.' },
  helpPause: {
    keys: 'Press Escape on the map to pause. From there you can also give up the run and keep your gold.',
    touch: 'Tap Back on the map to pause. From there you can also give up the run and keep your gold.',
  },
  pauseMenu: { keys: 'W and S to choose. Enter to pick. Esc to resume.', touch: 'Arrows to choose. OK to pick. Back to resume.' },
  soundMenu: {
    keys: 'W and S to choose. Enter to play. A and D for volume. Esc to go back.',
    touch: 'Up and down to choose. OK to play. Left and right for volume. Back to leave.',
  },
  soundMuted: { keys: 'Sound is off. Press M to turn it back on.', touch: 'Sound is off. Tap Sound to turn it back on.' },
};

/** The hint text for the controls in use. Falls back to the key wording. */
export function hint(id: HintId): string {
  const h = HINTS[id];
  return controls.touch && h.touch ? h.touch : h.keys;
}
