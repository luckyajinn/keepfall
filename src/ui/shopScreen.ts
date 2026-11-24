// The shop between runs. What it sells is permanent.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, panel, text } from '../render/draw';
import { fillPx } from '../render/pixel';
import { SHOP_ITEMS, buyFromShop, isMaxed, shopPrice } from '../meta/shop';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { hint } from './hints';
import { inset, purse } from './hud';

// The layout, in logical units (two per art pixel).
/** Left and right edges of the text inside the panel. */
const LEFT = 56;
const RIGHT = 744;
const MENU_X = 48;
const MENU_Y = 112;
const MENU_W = 704;
/** Eight rows of 34 end at y 384, above the description box. */
const ROW_H = 34;
/** The column of "2 / 10" counts, right of the longest upgrade name. */
const COUNT_X = 260;
const DESC_Y = 400;

export class ShopScreen implements Screen {
  private state = { index: 0 };
  private note = '';

  constructor(private readonly game: Game) {}

  update(_dt: number, pressed: Action[]): void {
    if (pressed.includes('cancel')) {
      this.game.showStart();
      return;
    }
    const pick = menuInput(pressed, this.state, SHOP_ITEMS.length + 2);
    if (pick < 0) return;
    if (pick === SHOP_ITEMS.length) {
      this.game.startRun();
      return;
    }
    if (pick === SHOP_ITEMS.length + 1) {
      this.game.showStart();
      return;
    }
    const item = SHOP_ITEMS[pick];
    const save = this.game.save;
    if (isMaxed(item, save)) {
      this.note = `${item.name} is as high as it goes.`;
      sfx.play('deny');
    } else if (buyFromShop(item, save)) {
      this.note = `Bought: ${item.name}. It is saved.`;
      sfx.play('buy');
    } else {
      this.note = 'You do not have enough gold for that.';
      sfx.play('deny');
    }
  }

  render(ctx: Ctx): void {
    const save = this.game.save;
    fillPx(ctx, 0, 0, W, H, C.bg);
    // The panel ends at y 560, leaving the strip below it free for the Sound off message.
    panel(ctx, 32, 16, 736, 544);
    text(ctx, 'The Shop', LEFT, 40, { size: 32, bold: true, color: C.gold, baseline: 'top' });
    text(ctx, 'What you buy here is yours in every run from now on.', LEFT, 80, { size: 16, color: C.inkDim, baseline: 'top' });
    purse(ctx, RIGHT, 36, save.gold);

    const sel = this.state.index;
    const counts: string[] = [];
    const rows = SHOP_ITEMS.map((item) => {
      const maxed = isMaxed(item, save);
      const price = shopPrice(item, save);
      counts.push(`${save.upgrades[item.id]} / ${item.max}`);
      return {
        label: item.name,
        right: maxed ? 'max' : `${price} gold`,
        dim: maxed || save.gold < price,
      };
    });
    rows.push({ label: 'Start a new run', right: '', dim: false });
    rows.push({ label: 'Back to the title', right: '', dim: false });
    drawMenu(ctx, rows, sel, MENU_X, MENU_Y, MENU_W, ROW_H, 18);
    // How many of each upgrade are owned, in a column of their own, in the same color as their row.
    counts.forEach((count, i) => {
      const color = rows[i].dim ? C.inkFaint : i === sel ? C.gold : C.ink;
      text(ctx, count, COUNT_X, MENU_Y + i * ROW_H + ROW_H / 2 - 2, { size: 16, color, baseline: 'middle', bold: i === sel });
    });

    const desc =
      sel < SHOP_ITEMS.length
        ? SHOP_ITEMS[sel].text
        : sel === SHOP_ITEMS.length
          ? 'Head back into the keep with your upgrades.'
          : 'Return to the title screen.';
    inset(ctx, MENU_X, DESC_Y, MENU_W, 38);
    text(ctx, desc, MENU_X + 16, DESC_Y + 12, { size: 16, baseline: 'top' });
    if (this.note) text(ctx, this.note, LEFT, 452, { size: 16, color: C.ember, baseline: 'top' });
    text(ctx, hint('menuBuy'), RIGHT, 526, { size: 16, color: C.inkFaint, align: 'right', baseline: 'top' });
  }
}
