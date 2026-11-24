// The how to play screen.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, W, panel, text, textWidth } from '../render/draw';
import { drawSprite, lazy, snap } from '../render/pixel';
import { nightSky } from './common';
import { controls, hint } from './hints';
import { bullet, divider } from './titleArt';

/** The panel, the column of text inside it, and the spacing of the lines, in logical units. */
const BOX = { x: 56, y: 20, w: 688, h: 560 };
const TEXT_X = 96;
const TEXT_W = 616;
const LINE = 22;
const GAP = 10;
/** The first baseline at the earliest, and where the last line may end at the latest. */
const TOP = 110;
const BOTTOM = 536;

const rule = lazy(() => divider(160));

/** Splits a sentence into lines that fit `width`, measured in the pixel font. */
function wrapLines(str: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && textWidth(test, { size: 15 }) > width) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Wraps a sentence into as few lines as fit `width`, then evens them out so no line is left with one word. */
function balanced(str: string, width: number): string[] {
  const lines = wrapLines(str, width);
  if (lines.length < 2) return lines;
  let lo = 100;
  let hi = width;
  while (hi - lo > 2) {
    const mid = Math.floor((lo + hi) / 2);
    if (wrapLines(str, mid).length > lines.length) lo = mid;
    else hi = mid;
  }
  return wrapLines(str, hi);
}

function helpLines(): string[] {
  return [
    hint('helpMove'),
    'You can see most enemies. Walk into one to fight it, or walk around it and miss out on its XP and gold.',
    'Some enemies hide. If you step next to one it ambushes you and gets the first turn.',
    'In a fight, pick Attack, Guard, Potion or Flee. Guard blocks part of the next hit and makes your next Attack stronger. Guard when an enemy winds up a heavy blow.',
    'Clearing a floor upgrades your lowest level item, with a 1 in 4 chance of a trinket. A vendor then sells boosts that last for this run only.',
    'On floor 3 you must beat the Ork. When a run ends you keep your gold and can spend it in the shop on upgrades that last forever.',
    hint('helpSound'),
    hint('helpPause'),
  ];
}

export class HelpScreen implements Screen {
  /** Help can be opened from the pause menu. The run clock stays stopped while it is read. */
  readonly pausesRun = true;
  /** The wrapped lines, kept for the wording (keys or touch) they were made for. */
  private wrapped: { touch: boolean; items: string[][] } | null = null;

  /** `back` runs when the player leaves. Without it the title screen comes back. */
  constructor(
    private readonly game: Game,
    private readonly back?: () => void,
  ) {}

  update(_dt: number, pressed: Action[]): void {
    if (!pressed.includes('confirm') && !pressed.includes('cancel')) return;
    if (this.back) this.back();
    else this.game.showStart();
  }

  private items(): string[][] {
    if (!this.wrapped || this.wrapped.touch !== controls.touch) {
      this.wrapped = { touch: controls.touch, items: helpLines().map((l) => balanced(l, TEXT_W)) };
    }
    return this.wrapped.items;
  }

  render(ctx: Ctx): void {
    nightSky(ctx, this.game.time);
    panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h);
    text(ctx, 'How to play', W / 2, 68, { size: 32, bold: true, align: 'center', color: C.gold, shadow: true });
    drawSprite(ctx, rule(), W / 2, 84, { center: true });
    // The list sits in the middle of the room between the title and the hint.
    const items = this.items();
    const height = items.reduce((a, l) => a + l.length * LINE, 0) + (items.length - 1) * GAP;
    let y = TOP + snap(Math.max(0, BOTTOM - TOP - height) / 2);
    for (const lines of items) {
      drawSprite(ctx, bullet(), TEXT_X - 16, y - 7, { center: true });
      for (const line of lines) {
        text(ctx, line, TEXT_X, y, { size: 15 });
        y += LINE;
      }
      y += GAP;
    }
    text(ctx, hint('back'), W / 2, BOX.y + BOX.h - 22, { size: 14, align: 'center', color: C.gold, shadow: true });
  }
}
