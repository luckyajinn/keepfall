// The title screen.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C, PAL } from '../render/colors';
import { Ctx, H, W, drawMenu, panel, text } from '../render/draw';
import { textLog } from '../render/font';
import { devicePoint, drawSprite, fromPx } from '../render/pixel';
import { drawIcon, drawKnight } from '../render/sprites';
import { sfx } from '../audio/sfx';
import { menuInput, nightSky } from './common';
import { hint } from './hints';
import { LOGO_TEXT, logo, sparkleFrames } from './titleArt';

export class StartScreen implements Screen {
  private state = { index: 0 };

  constructor(private readonly game: Game) {}

  update(_dt: number, pressed: Action[]): void {
    const pick = menuInput(pressed, this.state, 4);
    if (pick >= 0) sfx.play('pick');
    if (pick === 0) this.game.startRun();
    else if (pick === 1) this.game.showShop();
    else if (pick === 2) this.game.showHelp();
    else if (pick === 3) this.game.showSound();
  }

  render(ctx: Ctx): void {
    const t = this.game.time;
    nightSky(ctx, t);
    // The knight stands on the near hill and looks across the valley at the keep.
    drawKnight(ctx, 200, 500, 'large', 'right', t, false);
    drawLogo(ctx, 52, 34, t);
    text(ctx, 'Three floors. One fat Ork. Take the keep.', 58, 146, { size: 20, color: C.ink, shadow: true });

    panel(ctx, 52, 166, 264, 176);
    drawMenu(ctx, [{ label: 'Start a run' }, { label: 'Shop' }, { label: 'How to play' }, { label: 'Sound' }], this.state.index, 62, 176, 244, 40, 20);

    const s = this.game.save;
    drawIcon(ctx, 'coin', 66, 368, 'small');
    text(ctx, `${s.gold} gold saved`, 82, 368, { size: 16, color: C.gold, shadow: true, baseline: 'middle' });
    const best = s.bestFloor > 0 ? `    Best floor ${s.bestFloor}` : '';
    text(ctx, `Runs ${s.runs}    Wins ${s.wins}${best}`, 58, 398, { size: 14, color: C.inkDim, shadow: true });
    text(ctx, hint('menuPick'), W - 16, H - 12, { size: 13, color: C.inkDim, align: 'right', shadow: true });
  }
}

/** The logo sprite with its top left at (x, y), and now and then a glint on one of its letters. */
function drawLogo(ctx: Ctx, x: number, y: number, t: number): void {
  const img = logo();
  drawSprite(ctx, img, x, y);
  // The tests read drawn text from the text record; the logo is a sprite, so it adds itself.
  if (import.meta.env.DEV) {
    const [dx, dy] = devicePoint(ctx, x, y);
    textLog.push({ s: LOGO_TEXT, color: PAL.gold1, x: dx, y: dy, w: img.w, h: img.h });
  }
  // A glint every few seconds, on the next letter each time: 5 steps of a tenth of a second.
  const period = 3.2;
  const step = Math.floor((t % period) / 0.1);
  if (step < 0 || step > 4) return;
  const spot = SPARKS[Math.floor(t / period) % SPARKS.length];
  const frame = [0, 1, 2, 1, 0][step];
  drawSprite(ctx, sparkleFrames()[frame], x + fromPx(spot[0]), y + fromPx(spot[1]), { center: true });
}

/** Where the glint shows on the logo, in its pixels: the top corners of K, the F and the last l. */
const SPARKS: readonly [number, number][] = [
  [2, 2],
  [82, 2],
  [134, 2],
  [58, 14],
];
