// The screen shown when a floor is cleared.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, panel, text } from '../render/draw';
import { drawSprite, fillPx, lazy } from '../render/pixel';
import { drawIcon, iconSize } from '../render/sprites';
import { GEAR_EFFECT, GEAR_LABEL, gearName } from '../items/gear';
import type { FloorReward } from '../items/rewards';
import { TRINKETS } from '../items/trinkets';
import { hint } from './hints';
import { divider } from './titleArt';

const rule = lazy(() => divider(180));

/** The two boxes, in logical units. */
const BOX_X = 140;
const BOX_W = 520;
const BOX_H = 100;
/** The square slot each icon sits in: the large icon with 8 units of room on each side. */
const SLOT = iconSize('large') + 16;

/**
 * A box set into the panel: darker than the panel, with a dark line along its top and left
 * and a light line along its bottom and right, as if cut in. The icon sits in a framed slot.
 */
function insetBox(ctx: Ctx, y: number): { iconX: number; iconY: number; textX: number } {
  fillPx(ctx, BOX_X, y, BOX_W, BOX_H, C.outline);
  fillPx(ctx, BOX_X + 2, y + 2, BOX_W - 2, BOX_H - 2, C.panelLight);
  fillPx(ctx, BOX_X + 2, y + 2, BOX_W - 4, BOX_H - 4, C.bg);
  const sx = BOX_X + 18;
  const sy = y + (BOX_H - SLOT) / 2;
  fillPx(ctx, sx, sy, SLOT, SLOT, C.goldDark);
  fillPx(ctx, sx + 2, sy + 2, SLOT - 4, SLOT - 4, C.outline);
  fillPx(ctx, sx + 4, sy + 4, SLOT - 8, SLOT - 8, C.bgDeep);
  return { iconX: sx + SLOT / 2, iconY: sy + SLOT / 2, textX: sx + SLOT + 20 };
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
    fillPx(ctx, 0, 0, W, H, C.bg);
    panel(ctx, 104, 64, 592, 472);
    text(ctx, `Floor ${this.floorNum} cleared`, W / 2, 122, { size: 36, bold: true, align: 'center', color: C.gold, shadow: true });
    drawSprite(ctx, rule(), W / 2, 140, { center: true });

    // The upgraded item.
    const a = insetBox(ctx, 160);
    drawIcon(ctx, r.slot, a.iconX, a.iconY, 'large');
    text(ctx, `${GEAR_LABEL[r.slot]} upgraded to level ${r.newLevel}`, a.textX, a.iconY - 12, { size: 21, bold: true, baseline: 'middle' });
    text(ctx, `${gearName(r.slot, r.newLevel)}: ${GEAR_EFFECT[r.slot]}`, a.textX, a.iconY + 14, { size: 16, color: C.inkDim, baseline: 'middle' });

    // The trinket roll.
    const b = insetBox(ctx, 276);
    if (r.trinket) {
      const tr = TRINKETS[r.trinket];
      drawIcon(ctx, 'trinket', b.iconX, b.iconY, 'large', tr.color);
      text(ctx, `You found a trinket: ${tr.name}`, b.textX, b.iconY - 12, { size: 21, bold: true, color: C.gold, baseline: 'middle' });
      text(ctx, tr.text, b.textX, b.iconY + 14, { size: 16, color: C.inkDim, baseline: 'middle' });
    } else {
      drawIcon(ctx, 'trinket', b.iconX, b.iconY, 'large', '#4a3a30');
      text(ctx, 'No trinket this time', b.textX, b.iconY - 12, { size: 21, bold: true, color: C.inkDim, baseline: 'middle' });
      text(ctx, 'Each cleared floor has a 1 in 4 chance of one.', b.textX, b.iconY + 14, { size: 16, color: C.inkFaint, baseline: 'middle' });
    }

    if (r.healed > 0) {
      text(ctx, `You catch your breath and heal ${r.healed} health.`, W / 2, 420, { size: 17, align: 'center', color: C.moss, shadow: true });
    }
    if (Math.sin(this.game.time * 5) > -0.3) {
      text(ctx, hint('toVendor'), W / 2, 496, { size: 16, align: 'center', color: C.gold, shadow: true });
    }
  }
}
