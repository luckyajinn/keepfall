// The how to play screen.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, W, circle, panel, text, wrapText } from '../render/draw';
import { nightSky } from './common';
import { hint } from './hints';

export class HelpScreen implements Screen {
  constructor(private readonly game: Game) {}

  update(_dt: number, pressed: Action[]): void {
    if (pressed.includes('confirm') || pressed.includes('cancel')) this.game.showStart();
  }

  render(ctx: Ctx): void {
    nightSky(ctx, this.game.time);
    panel(ctx, 70, 50, 660, 500);
    text(ctx, 'How to play', W / 2, 100, { size: 32, bold: true, align: 'center', color: C.gold });
    const lines = [
      hint('helpMove'),
      'You can see most enemies. Walk into one to fight it, or walk around it and miss out on its XP and gold.',
      'Some enemies hide. If you step next to one it ambushes you and gets the first turn.',
      'In a fight, pick Attack, Guard, Potion or Flee. Guard blocks part of the next hit and makes your next Attack stronger. Guard when an enemy winds up a heavy blow.',
      'Clearing a floor upgrades your lowest level item, with a 1 in 4 chance of a trinket. A vendor then sells boosts that last for this run only.',
      'On floor 3 you must beat the Ork. When a run ends you keep your gold and can spend it in the shop on upgrades that last forever.',
      hint('helpSound'),
    ];
    let y = 136;
    for (const line of lines) {
      circle(ctx, 104, y - 5, 3, C.gold);
      y = wrapText(ctx, line, 118, y, 570, 21, { size: 15 }) + 9;
    }
    text(ctx, hint('back'), W / 2, 526, { size: 14, align: 'center', color: C.gold });
  }
}
