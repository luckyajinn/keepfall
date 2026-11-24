// The title screen.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, panel, text } from '../render/draw';
import { drawKnight, iconCoin } from '../render/sprites';
import { sfx } from '../audio/sfx';
import { menuInput, nightSky } from './common';
import { hint } from './hints';

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
    drawKnight(ctx, 230, 505, 110, 'right', t, false);
    text(ctx, 'KeepFall', 60, 126, { size: 84, bold: true, color: C.gold, shadow: true });
    text(ctx, 'Three floors. One fat Ork. Take the keep.', 64, 166, { size: 20, italic: true, color: C.ink, shadow: true });

    // The title sits a little high to make room for 4 menu rows, so the lines under the menu stay clear of the knight.
    panel(ctx, 60, 200, 300, 192);
    drawMenu(ctx, [{ label: 'Start a run' }, { label: 'Shop' }, { label: 'How to play' }, { label: 'Sound' }], this.state.index, 72, 214, 276, 42, 20);

    const s = this.game.save;
    iconCoin(ctx, 72, 410, 16);
    text(ctx, `${s.gold} gold saved`, 86, 416, { size: 16, color: C.gold, shadow: true });
    const best = s.bestFloor > 0 ? `    Best floor ${s.bestFloor}` : '';
    text(ctx, `Runs ${s.runs}    Wins ${s.wins}${best}`, 64, 438, { size: 14, color: C.inkDim, shadow: true });
    text(ctx, hint('menuPick'), W - 20, H - 16, { size: 13, color: C.inkDim, align: 'right', shadow: true });
  }
}
