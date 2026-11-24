// The vendor between floors. What it sells lasts for the current run only.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, fillRR, panel, text } from '../render/draw';
import { iconCoin } from '../render/sprites';
import { VENDOR_ITEMS, buyFromVendor, vendorPrice } from '../items/vendor';
import { attackPower, guardShare, maxHp } from '../entities/knight';
import { FINAL_FLOOR } from '../map/tiles';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { hint } from './hints';

export class VendorScreen implements Screen {
  private state = { index: 0 };
  private note = '';

  constructor(private readonly game: Game) {}

  update(_dt: number, pressed: Action[]): void {
    const run = this.game.run!;
    const pick = menuInput(pressed, this.state, VENDOR_ITEMS.length + 1);
    if (pick < 0) return;
    if (pick === VENDOR_ITEMS.length) {
      this.game.nextFloor();
      return;
    }
    const item = VENDOR_ITEMS[pick];
    const price = vendorPrice(item, run.vendorCounts);
    if (buyFromVendor(run.knight, item, run.vendorCounts)) {
      run.spent += price;
      this.note = `Bought: ${item.name}.`;
      sfx.play('buy');
    } else {
      this.note = 'You do not have enough gold for that.';
      sfx.play('deny');
    }
  }

  render(ctx: Ctx): void {
    const run = this.game.run!;
    const k = run.knight;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 70, 40, 660, 520);
    text(ctx, 'The Stair Vendor', 100, 92, { size: 32, bold: true, color: C.gold });
    text(ctx, 'What you buy here lasts until this run ends.', 100, 120, { size: 15, italic: true, color: C.inkDim });
    iconCoin(ctx, 610, 82, 20);
    text(ctx, `${k.gold}`, 626, 90, { size: 24, bold: true, color: C.gold });

    const rows = VENDOR_ITEMS.map((item) => {
      const price = vendorPrice(item, run.vendorCounts);
      return { label: item.name, right: `${price} gold`, dim: k.gold < price };
    });
    rows.push({ label: `Climb to floor ${run.floorNum + 1}`, right: '', dim: false });
    drawMenu(ctx, rows, this.state.index, 100, 150, 600, 46, 20);

    fillRR(ctx, 100, 396, 600, 60, 8, C.panelLight);
    const sel = this.state.index;
    const desc =
      sel < VENDOR_ITEMS.length
        ? VENDOR_ITEMS[sel].text
        : run.floorNum + 1 >= FINAL_FLOOR
          ? 'The Ork waits on the last floor. Gold you keep goes home with you.'
          : 'Head up the stairs. Gold you keep goes home with you.';
    text(ctx, desc, 120, 432, { size: 17 });

    text(ctx, `Health ${k.hp} / ${maxHp(k)}    Attack ${attackPower(k)}    Guard ${Math.round(guardShare(k) * 100)}%    Potions ${k.potions}`, 100, 492, {
      size: 15,
      color: C.inkDim,
    });
    if (this.note) text(ctx, this.note, 100, 524, { size: 15, color: C.ember });
    text(ctx, hint('menuBuy'), 700, 524, { size: 13, color: C.inkFaint, align: 'right' });
  }
}
