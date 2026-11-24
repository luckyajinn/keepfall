// The bar across the top of the map: floor, health, XP, gold, potions, gear and trinkets.
import { C } from '../render/colors';
import { Ctx, W, bar, text } from '../render/draw';
import { drawIcon } from '../render/sprites';
import { Knight, maxHp, xpToNext } from '../entities/knight';
import { TRINKETS } from '../items/trinkets';
import { FINAL_FLOOR } from '../map/tiles';

export const HUD_H = 56;

export function drawHud(ctx: Ctx, k: Knight, floorNum: number): void {
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = C.panelEdge;
  ctx.fillRect(0, HUD_H - 2, W, 2);

  // Left: floor and level
  text(ctx, `Floor ${floorNum} of ${FINAL_FLOOR}`, 14, 23, { size: 17, bold: true, color: C.gold });
  text(ctx, `Level ${k.level}`, 14, 44, { size: 14, color: C.inkDim });

  // Middle: health and XP
  const bx = 150;
  const bw = 230;
  const max = maxHp(k);
  bar(ctx, bx, 9, bw, 18, k.hp / max, k.hp / max <= 0.3 ? C.ember : C.red);
  text(ctx, `Health ${k.hp} / ${max}`, bx + bw / 2, 18.5, { size: 13, bold: true, align: 'center', baseline: 'middle', shadow: true });
  const need = xpToNext(k.level);
  bar(ctx, bx, 34, bw, 10, k.xp / need, C.xp);
  text(ctx, `XP ${k.xp} / ${need}`, bx + bw + 8, 43, { size: 12, color: C.inkDim });

  // Right: gold and potions
  let x = 470;
  drawIcon(ctx, 'coin', x, 18, 'small');
  text(ctx, `${k.gold}`, x + 13, 23.5, { size: 16, bold: true, color: C.gold });
  x += 80;
  drawIcon(ctx, 'potion', x, 18, 'small');
  text(ctx, `x ${k.potions}`, x + 13, 23.5, { size: 16, bold: true });

  // Gear levels
  x = 610;
  drawIcon(ctx, 'sword', x, 18, 'small');
  text(ctx, `${k.gear.sword}`, x + 12, 23.5, { size: 15, bold: true });
  x += 46;
  drawIcon(ctx, 'shield', x, 18, 'small');
  text(ctx, `${k.gear.shield}`, x + 12, 23.5, { size: 15, bold: true });
  x += 46;
  drawIcon(ctx, 'armor', x, 18, 'small');
  text(ctx, `${k.gear.armor}`, x + 12, 23.5, { size: 15, bold: true });

  // Trinkets
  if (k.trinkets.length) {
    text(ctx, 'Trinkets', 610, 44, { size: 12, color: C.inkDim });
    k.trinkets.forEach((id, i) => drawIcon(ctx, 'trinket', 672 + i * 16, 40, 'small', TRINKETS[id].color));
  } else {
    text(ctx, 'No trinkets yet', 610, 44, { size: 12, color: C.inkFaint });
  }
}
