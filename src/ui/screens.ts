// The menu style screens: start, how to play, floor reward, vendor, win and lose, and the shop.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, circle, drawMenu, fillRR, panel, poly, text, wrapText } from '../render/draw';
import { drawEnemy, drawKnight, iconArmor, iconCoin, iconShield, iconSword, iconTrinket } from '../render/sprites';
import { GEAR_EFFECT, GEAR_LABEL, gearName } from '../items/gear';
import type { FloorReward } from '../items/rewards';
import { TRINKETS } from '../items/trinkets';
import { VENDOR_ITEMS, buyFromVendor, vendorPrice } from '../items/vendor';
import { SHOP_ITEMS, buyFromShop, isMaxed, shopPrice } from '../meta/shop';
import { attackPower, guardShare, maxHp } from '../entities/knight';
import { FINAL_FLOOR } from '../map/tiles';
import { sfx } from '../audio/sfx';

/** Moves a menu index with the up and down actions. Returns the picked row, or -1. */
function menuInput(pressed: Action[], state: { index: number }, count: number): number {
  for (const a of pressed) {
    if (a === 'up' || a === 'down') {
      state.index = (state.index + count + (a === 'up' ? -1 : 1)) % count;
      sfx.play('move');
    } else if (a === 'confirm') {
      return state.index;
    } else if (/^[1-8]$/.test(a) && Number(a) <= count) {
      state.index = Number(a) - 1;
      return state.index;
    }
  }
  return -1;
}

function nightSky(ctx: Ctx, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1110');
  g.addColorStop(0.55, '#4a2a1c');
  g.addColorStop(1, '#8a4a26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // A low warm sun behind the keep.
  const sun = ctx.createRadialGradient(560, 380, 10, 560, 380, 260);
  sun.addColorStop(0, 'rgba(255, 200, 120, 0.85)');
  sun.addColorStop(0.25, 'rgba(242, 150, 70, 0.45)');
  sun.addColorStop(1, 'rgba(242, 150, 70, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  // The keep, as a dark outline.
  const dark = '#150e0c';
  ctx.fillStyle = dark;
  ctx.fillRect(440, 250, 240, 350);
  ctx.fillRect(410, 190, 70, 410);
  ctx.fillRect(640, 220, 70, 380);
  ctx.fillRect(520, 130, 80, 200);
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(410 + i * 20, 178, 12, 14);
    ctx.fillRect(640 + i * 20, 208, 12, 14);
    ctx.fillRect(520 + i * 22.6, 118, 13, 14);
  }
  for (let i = 0; i < 8; i++) ctx.fillRect(482 + i * 20, 240, 12, 12);
  poly(ctx, [556, 118, 560, 70, 564, 118], dark);
  poly(ctx, [562, 74, 590, 82, 562, 92], C.red);
  // Lit windows.
  const flick = 0.75 + Math.sin(t * 5) * 0.12;
  ctx.fillStyle = `rgba(255, 190, 100, ${flick})`;
  for (const [wx, wy] of [
    [436, 260],
    [436, 340],
    [668, 290],
    [552, 180],
    [500, 320],
    [600, 320],
  ]) {
    fillRR(ctx, wx, wy, 12, 20, 6, ctx.fillStyle as string);
  }
  // The gate.
  fillRR(ctx, 530, 500, 60, 100, 28, '#2a1a12');
  // Hills.
  ctx.fillStyle = '#100a08';
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.quadraticCurveTo(200, 440, 430, 540);
  ctx.quadraticCurveTo(620, 590, 800, 530);
  ctx.lineTo(800, 600);
  ctx.lineTo(0, 600);
  ctx.closePath();
  ctx.fill();
}

export class StartScreen implements Screen {
  private state = { index: 0 };

  constructor(private readonly game: Game) {}

  update(_dt: number, pressed: Action[]): void {
    const pick = menuInput(pressed, this.state, 3);
    if (pick >= 0) sfx.play('pick');
    if (pick === 0) this.game.startRun();
    else if (pick === 1) this.game.showShop();
    else if (pick === 2) this.game.showHelp();
  }

  render(ctx: Ctx): void {
    const t = this.game.time;
    nightSky(ctx, t);
    drawKnight(ctx, 230, 505, 110, 'right', t, false);
    text(ctx, 'KeepFall', 60, 150, { size: 84, bold: true, color: C.gold, shadow: true });
    text(ctx, 'Three floors. One fat Ork. Take the keep.', 64, 190, { size: 20, italic: true, color: C.ink, shadow: true });

    panel(ctx, 60, 230, 300, 150);
    drawMenu(ctx, [{ label: 'Start a run' }, { label: 'Shop' }, { label: 'How to play' }], this.state.index, 72, 244, 276, 42, 20);

    const s = this.game.save;
    iconCoin(ctx, 72, 408, 16);
    text(ctx, `${s.gold} gold saved`, 86, 414, { size: 16, color: C.gold, shadow: true });
    text(ctx, `Runs ${s.runs}    Wins ${s.wins}`, 64, 438, { size: 14, color: C.inkDim, shadow: true });
    text(ctx, 'W and S to choose. Enter to pick.', W - 20, H - 16, { size: 13, color: C.inkDim, align: 'right', shadow: true });
  }
}

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
      'Move the knight with W, A, S and D. Find the stairs to climb to the next floor.',
      'You can see most enemies. Walk into one to fight it, or walk around it and miss out on its XP and gold.',
      'Some enemies hide. If you step next to one it ambushes you and gets the first turn.',
      'In a fight, pick Attack, Guard, Potion or Flee. Guard blocks part of the next hit and makes your next Attack stronger. Guard when an enemy winds up a heavy blow.',
      'Clearing a floor upgrades your lowest level item, with a 1 in 4 chance of a trinket. A vendor then sells boosts that last for this run only.',
      'On floor 3 you must beat the Ork. When a run ends you keep your gold and can spend it in the shop on upgrades that last forever.',
      'Press M at any time to turn the sound off or on.',
    ];
    let y = 136;
    for (const line of lines) {
      circle(ctx, 104, y - 5, 3, C.gold);
      y = wrapText(ctx, line, 118, y, 570, 21, { size: 15 }) + 9;
    }
    text(ctx, 'Press Enter to go back', W / 2, 526, { size: 14, align: 'center', color: C.gold });
  }
}

export class RewardScreen implements Screen {
  private age = 0;

  constructor(
    private readonly game: Game,
    private readonly reward: FloorReward,
    private readonly floorNum: number,
  ) {}

  update(dt: number, pressed: Action[]): void {
    this.age += dt;
    if (this.age > 0.4 && pressed.includes('confirm')) this.game.showVendor();
  }

  render(ctx: Ctx): void {
    const r = this.reward;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 110, 70, 580, 460);
    text(ctx, `Floor ${this.floorNum} cleared`, W / 2, 130, { size: 36, bold: true, align: 'center', color: C.gold });

    // The upgraded item.
    fillRR(ctx, 150, 165, 500, 100, 8, C.panelLight);
    const ix = 200;
    const iy = 215;
    if (r.slot === 'sword') iconSword(ctx, ix, iy, 52);
    else if (r.slot === 'shield') iconShield(ctx, ix, iy, 50);
    else iconArmor(ctx, ix, iy, 50);
    text(ctx, `${GEAR_LABEL[r.slot]} upgraded to level ${r.newLevel}`, 250, 205, { size: 21, bold: true });
    text(ctx, `${gearName(r.slot, r.newLevel)}: ${GEAR_EFFECT[r.slot]}`, 250, 234, { size: 16, color: C.inkDim });

    // The trinket roll.
    fillRR(ctx, 150, 280, 500, 100, 8, C.panelLight);
    if (r.trinket) {
      const tr = TRINKETS[r.trinket];
      iconTrinket(ctx, ix, 330, 40, tr.color);
      text(ctx, `You found a trinket: ${tr.name}`, 250, 320, { size: 21, bold: true, color: C.gold });
      text(ctx, tr.text, 250, 349, { size: 16, color: C.inkDim });
    } else {
      iconTrinket(ctx, ix, 330, 40, '#4a3a30');
      text(ctx, 'No trinket this time', 250, 320, { size: 21, bold: true, color: C.inkDim });
      text(ctx, 'Each cleared floor has a 1 in 4 chance of one.', 250, 349, { size: 16, color: C.inkFaint });
    }

    if (r.healed > 0) {
      text(ctx, `You catch your breath and heal ${r.healed} health.`, W / 2, 425, { size: 17, align: 'center', color: C.moss });
    }
    if (Math.sin(this.game.time * 5) > -0.3) {
      text(ctx, 'Press Enter to visit the vendor', W / 2, 492, { size: 16, align: 'center', color: C.gold });
    }
  }
}

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
    text(ctx, 'W and S to choose. Enter to buy.', 700, 524, { size: 13, color: C.inkFaint, align: 'right' });
  }
}

export interface RunSummary {
  won: boolean;
  floorNum: number;
  level: number;
  kills: number;
  goldEarned: number;
  goldSaved: number;
}

export class EndScreen implements Screen {
  private age = 0;

  constructor(
    private readonly game: Game,
    private readonly sum: RunSummary,
  ) {
    if (sum.won) sfx.play('win');
  }

  update(dt: number, pressed: Action[]): void {
    this.age += dt;
    if (this.age > 0.6 && pressed.includes('confirm')) this.game.showShop();
  }

  render(ctx: Ctx): void {
    const s = this.sum;
    const t = this.game.time;
    if (s.won) {
      nightSky(ctx, t);
      ctx.fillStyle = 'rgba(18, 12, 10, 0.45)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = C.bgDeep;
      ctx.fillRect(0, 0, W, H);
    }
    panel(ctx, 150, 70, 500, 460);
    if (s.won) {
      text(ctx, 'The keep is yours!', W / 2, 135, { size: 40, bold: true, align: 'center', color: C.gold });
      text(ctx, 'Mogrum the Ork is beaten and the hall is quiet.', W / 2, 168, { size: 16, italic: true, align: 'center', color: C.inkDim });
      drawKnight(ctx, W / 2, 232, 84, 'down', t, false);
    } else {
      text(ctx, 'You have fallen', W / 2, 135, { size: 40, bold: true, align: 'center', color: C.ember });
      text(ctx, `The keep holds, for now. You reached floor ${s.floorNum}.`, W / 2, 168, { size: 16, italic: true, align: 'center', color: C.inkDim });
      ctx.globalAlpha = 0.5;
      drawEnemy(ctx, 'boss', W / 2, 240, 80, t);
      ctx.globalAlpha = 1;
    }
    const rows: [string, string][] = [
      ['Level reached', `${s.level}`],
      ['Enemies beaten', `${s.kills}`],
      ['Gold earned this run', `${s.goldEarned}`],
      ['Gold saved for the shop', `${s.goldSaved}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 322 + i * 34;
      const last = i === rows.length - 1;
      text(ctx, label, 210, y, { size: 18, color: last ? C.gold : C.ink, bold: last });
      text(ctx, value, 590, y, { size: 18, align: 'right', color: last ? C.gold : C.ink, bold: last });
    });
    if (Math.sin(t * 5) > -0.3) {
      text(ctx, 'Press Enter to visit the shop', W / 2, 492, { size: 16, align: 'center', color: C.gold });
    }
  }
}

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
    text(ctx, 'W and S to choose. Enter to buy.', 700, 546, { size: 13, color: C.inkFaint, align: 'right' });
  }
}
