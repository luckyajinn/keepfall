// The screen shown when a floor is cleared.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, fillRR, panel, text } from '../render/draw';
import { iconArmor, iconShield, iconSword, iconTrinket } from '../render/sprites';
import { GEAR_EFFECT, GEAR_LABEL, gearName } from '../items/gear';
import type { FloorReward } from '../items/rewards';
import { TRINKETS } from '../items/trinkets';
import { hint } from './hints';

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
      text(ctx, hint('toVendor'), W / 2, 492, { size: 16, align: 'center', color: C.gold });
    }
  }
}
