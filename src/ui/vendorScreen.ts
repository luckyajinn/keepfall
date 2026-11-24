// The vendor between floors. What it sells lasts for the current run only.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, panel, text, textWidth } from '../render/draw';
import { fillPx, snap } from '../render/pixel';
import { drawIcon } from '../render/sprites';
import { VENDOR_ITEMS, VENDOR_TRINKET_PRICE, buyFromVendor, buyVendorTrinket, vendorPrice } from '../items/vendor';
import { TRINKETS, TrinketId } from '../items/trinkets';
import { attackPower, guardShare, maxHp } from '../entities/knight';
import { FINAL_FLOOR } from '../map/tiles';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { hint } from './hints';
import { inset, purse, splitLines } from './hud';

// The layout, in logical units (two per art pixel).
const PANEL_X = 32;
const PANEL_Y = 16;
const PANEL_W = 736;
const PANEL_H = 544;
/** Left and right edges of the text inside the panel. */
const LEFT = 56;
const RIGHT = 744;
const MENU_X = 48;
const MENU_Y = 112;
const MENU_W = 704;
/** Six rows of 36 end at y 328, above the description box. */
const ROW_H = 36;
const DESC_Y = 344;
const DESC_H = 52;
/** The pixel font's line height (11 pixels). */
const LINE = 22;

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
    fillPx(ctx, 0, 0, W, H, C.bg);
    // The panel ends at y 560, leaving the strip below it free for the Sound off message.
    panel(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    text(ctx, 'The Stair Vendor', LEFT, 40, { size: 32, bold: true, color: C.gold, baseline: 'top' });
    text(ctx, 'What you buy here lasts until this run ends.', LEFT, 80, { size: 16, color: C.inkDim, baseline: 'top' });
    purse(ctx, RIGHT, 36, k.gold);

    const rows = VENDOR_ITEMS.map((item) => {
      const price = vendorPrice(item, run.vendorCounts);
      return { label: item.name, right: `${price} gold`, dim: k.gold < price };
    });
    const sold = run.vendorTrinket === null;
    const trinketDim = sold || k.gold < VENDOR_TRINKET_PRICE;
    const trinketPrice = sold ? 'Sold' : `${VENDOR_TRINKET_PRICE} gold`;
    if (this.offer) rows.push({ label: TRINKETS[this.offer].name, right: trinketPrice, dim: trinketDim });
    rows.push({ label: `Climb to floor ${run.floorNum + 1}`, right: '', dim: false });
    drawMenu(ctx, rows, this.state.index, MENU_X, MENU_Y, MENU_W, ROW_H, 18);
    if (this.offer) {
      // The gem sits just left of the price. A sold gem is drawn in the dark browns.
      const ry = MENU_Y + VENDOR_ITEMS.length * ROW_H;
      const gx = MENU_X + MENU_W - 12 - textWidth(trinketPrice) - 14;
      drawIcon(ctx, 'trinket', gx, ry + ROW_H / 2 - 2, 'small', sold ? C.panelLight : TRINKETS[this.offer].color);
    }

    // The description box holds two lines. One line sits in its middle.
    const lines = splitLines(this.describe(this.state.index), MENU_W - 32);
    inset(ctx, MENU_X, DESC_Y, MENU_W, DESC_H);
    const top = snap(DESC_Y + DESC_H / 2 - (lines.length * LINE - (LINE - 14)) / 2);
    lines.forEach((line, i) => text(ctx, line, MENU_X + 16, top + i * LINE, { size: 16, baseline: 'top' }));

    text(ctx, `Health ${k.hp} / ${maxHp(k)}    Attack ${attackPower(k)}    Guard ${Math.round(guardShare(k) * 100)}%    Potions ${k.potions}`, LEFT, 420, {
      size: 16,
      color: C.inkDim,
      baseline: 'top',
    });
    if (this.note) text(ctx, this.note, LEFT, 452, { size: 16, color: C.ember, baseline: 'top' });
    text(ctx, hint('menuBuy'), RIGHT, 526, { size: 16, color: C.inkFaint, align: 'right', baseline: 'top' });
  }
}
