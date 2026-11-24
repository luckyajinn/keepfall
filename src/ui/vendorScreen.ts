// The vendor between floors. What it sells lasts for the current run only.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, fillRR, panel, text } from '../render/draw';
import { drawIcon } from '../render/sprites';
import { VENDOR_ITEMS, VENDOR_TRINKET_PRICE, buyFromVendor, buyVendorTrinket, vendorPrice } from '../items/vendor';
import { TRINKETS, TrinketId } from '../items/trinkets';
import { attackPower, guardShare, maxHp } from '../entities/knight';
import { FINAL_FLOOR } from '../map/tiles';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { hint } from './hints';

export class VendorScreen implements Screen {
  private state = { index: 0 };
  private note = '';
  /** The trinket offered at this visit. Its row stays, shown as sold, once it is bought. */
  private readonly offer: TrinketId | null;

  constructor(private readonly game: Game) {
    this.offer = game.run!.vendorTrinket;
  }

  /** The trinket row comes after the items, when there is one. The Climb row is last. */
  private get climbRow(): number {
    return VENDOR_ITEMS.length + (this.offer ? 1 : 0);
  }

  update(_dt: number, pressed: Action[]): void {
    const run = this.game.run!;
    const pick = menuInput(pressed, this.state, this.climbRow + 1);
    if (pick < 0) return;
    if (pick === this.climbRow) {
      this.game.nextFloor();
      return;
    }
    if (pick === VENDOR_ITEMS.length) {
      this.buyTrinket();
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

  private buyTrinket(): void {
    const run = this.game.run!;
    const id = run.vendorTrinket;
    if (!id) {
      this.note = 'That trinket is sold.';
      sfx.play('deny');
    } else if (buyVendorTrinket(run.knight, id)) {
      run.spent += VENDOR_TRINKET_PRICE;
      run.vendorTrinket = null;
      this.note = `Bought: ${TRINKETS[id].name}.`;
      sfx.play('buy');
    } else {
      this.note = 'You do not have enough gold for that.';
      sfx.play('deny');
    }
  }

  /** The text for the description box under the menu. */
  private describe(sel: number): string {
    const run = this.game.run!;
    if (sel < VENDOR_ITEMS.length) return VENDOR_ITEMS[sel].text;
    if (sel < this.climbRow && this.offer) {
      const tr = TRINKETS[this.offer];
      return run.vendorTrinket ? `A trinket: ${tr.text}.` : `Sold. The ${tr.name} is yours until this run ends.`;
    }
    return run.floorNum + 1 >= FINAL_FLOOR
      ? 'The Ork waits on the last floor. Gold you keep goes home with you.'
      : 'Head up the stairs. Gold you keep goes home with you.';
  }

  render(ctx: Ctx): void {
    const run = this.game.run!;
    const k = run.knight;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 70, 40, 660, 520);
    text(ctx, 'The Stair Vendor', 100, 92, { size: 32, bold: true, color: C.gold });
    text(ctx, 'What you buy here lasts until this run ends.', 100, 120, { size: 15, italic: true, color: C.inkDim });
    drawIcon(ctx, 'coin', 610, 82, 'small');
    text(ctx, `${k.gold}`, 626, 90, { size: 24, bold: true, color: C.gold });

    const rows = VENDOR_ITEMS.map((item) => {
      const price = vendorPrice(item, run.vendorCounts);
      return { label: item.name, right: `${price} gold`, dim: k.gold < price };
    });
    const sold = run.vendorTrinket === null;
    const trinketDim = sold || k.gold < VENDOR_TRINKET_PRICE;
    if (this.offer) {
      rows.push({ label: TRINKETS[this.offer].name, right: sold ? 'Sold' : `${VENDOR_TRINKET_PRICE} gold`, dim: trinketDim });
    }
    rows.push({ label: `Climb to floor ${run.floorNum + 1}`, right: '', dim: false });
    // Rows of 40 so six of them end above the description box at y 396.
    drawMenu(ctx, rows, this.state.index, 100, 150, 600, 40, 20);
    if (this.offer) {
      ctx.globalAlpha = trinketDim ? 0.5 : 1;
      drawIcon(ctx, 'trinket', 596, 150 + VENDOR_ITEMS.length * 40 + 18, 'small', sold ? '#4a3a30' : TRINKETS[this.offer].color);
      ctx.globalAlpha = 1;
    }

    fillRR(ctx, 100, 396, 600, 60, 8, C.panelLight);
    text(ctx, this.describe(this.state.index), 120, 432, { size: 17 });

    text(ctx, `Health ${k.hp} / ${maxHp(k)}    Attack ${attackPower(k)}    Guard ${Math.round(guardShare(k) * 100)}%    Potions ${k.potions}`, 100, 492, {
      size: 15,
      color: C.inkDim,
    });
    if (this.note) text(ctx, this.note, 100, 524, { size: 15, color: C.ember });
    text(ctx, hint('menuBuy'), 700, 524, { size: 13, color: C.inkFaint, align: 'right' });
  }
}
