// The shop between runs. What it sells is permanent.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, fillRR, panel, text } from '../render/draw';
import { iconCoin } from '../render/sprites';
import { SHOP_ITEMS, buyFromShop, isMaxed, shopPrice } from '../meta/shop';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { hint } from './hints';

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
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 70, 24, 660, 552);
    text(ctx, 'The Shop', 100, 74, { size: 32, bold: true, color: C.gold });
    text(ctx, 'What you buy here is yours in every run from now on.', 100, 100, { size: 15, italic: true, color: C.inkDim });
    iconCoin(ctx, 610, 64, 20);
    text(ctx, `${save.gold}`, 626, 72, { size: 24, bold: true, color: C.gold });

    const rows = SHOP_ITEMS.map((item) => {
      const maxed = isMaxed(item, save);
      const price = shopPrice(item, save);
      return {
        label: `${item.name}   ${save.upgrades[item.id]} / ${item.max}`,
        right: maxed ? 'max' : `${price} gold`,
        dim: maxed || save.gold < price,
      };
    });
    rows.push({ label: 'Start a new run', right: '', dim: false });
    rows.push({ label: 'Back to the title', right: '', dim: false });
    drawMenu(ctx, rows, this.state.index, 100, 122, 600, 42, 19);

    fillRR(ctx, 100, 466, 600, 50, 8, C.panelLight);
    const sel = this.state.index;
    const desc =
      sel < SHOP_ITEMS.length
        ? SHOP_ITEMS[sel].text
        : sel === SHOP_ITEMS.length
          ? 'Head back into the keep with your upgrades.'
          : 'Return to the title screen.';
    text(ctx, desc, 120, 497, { size: 17 });
    if (this.note) text(ctx, this.note, 100, 546, { size: 15, color: C.ember });
    text(ctx, hint('menuBuy'), 700, 546, { size: 13, color: C.inkFaint, align: 'right' });
  }
}
