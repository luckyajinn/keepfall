// Every character is drawn in code from simple shapes.
// Each sprite is drawn inside a 32 unit box centered on (0, 0), then scaled.
import { C } from './colors';
import { Ctx, circle, ellipse, fillRR, poly } from './draw';
import type { Dir } from '../input';
import type { EnemyKind } from '../entities/enemies';

function begin(ctx: Ctx, cx: number, cy: number, size: number, flip = false): void {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 32;
  ctx.scale(flip ? -s : s, s);
}

function shadow(ctx: Ctx, rx = 9): void {
  ellipse(ctx, 0, 13, rx, 3, C.shadow);
}

export function drawKnight(ctx: Ctx, cx: number, cy: number, size: number, dir: Dir, t: number, moving = false): void {
  begin(ctx, cx, cy, size, dir === 'left');
  shadow(ctx);
  const bob = moving ? Math.sin(t * 22) * 1 : Math.sin(t * 3) * 0.4;
  const step = moving ? Math.sin(t * 22) * 2 : 0;
  // Legs
  fillRR(ctx, -5, 6 + step * 0.4, 4, 7 - step * 0.4, 1.5, C.steelDark);
  fillRR(ctx, 1, 6 - step * 0.4, 4, 7 + step * 0.4, 1.5, C.steelDark);
  ctx.translate(0, bob);
  const back = dir === 'up';
  // Sword, held on the right
  if (!back) {
    fillRR(ctx, 9, -11, 2.4, 14, 1, '#e9e4d8');
    fillRR(ctx, 7.2, 2, 6, 2, 1, C.gold);
    fillRR(ctx, 9.2, 4, 2, 3, 1, C.rustDark);
  }
  // Body
  fillRR(ctx, -7, -4, 14, 12, 3, C.steel);
  fillRR(ctx, -7, 4, 14, 4, 2, C.steelShade);
  // Tabard
  fillRR(ctx, -3, -4, 6, 12, 1, C.red);
  if (!back) fillRR(ctx, -1.2, -1, 2.4, 5, 1, C.gold);
  // Helmet
  fillRR(ctx, -6.5, -14, 13, 11.5, 4, C.steel);
  fillRR(ctx, -6.5, -6, 13, 3.5, 1.5, C.steelShade);
  if (!back) {
    const shift = dir === 'down' ? 0 : 1.5;
    fillRR(ctx, -4.5 + shift, -10, 9, 2.6, 1, '#1a1412');
    fillRR(ctx, -0.6 + shift, -10, 1.2, 5.5, 0.5, '#1a1412');
  }
  // Plume
  ctx.beginPath();
  ctx.moveTo(-1, -14);
  ctx.quadraticCurveTo(-7, -20, -9, -13);
  ctx.quadraticCurveTo(-5, -16, -1, -12.5);
  ctx.closePath();
  ctx.fillStyle = C.ember;
  ctx.fill();
  // Shield, held on the left
  if (back) {
    fillRR(ctx, -5, -1, 10, 9, 2, C.tealDark);
  } else {
    poly(ctx, [-13, -3, -5, -3, -5, 4, -9, 9, -13, 4], C.teal);
    poly(ctx, [-11.5, -1.5, -6.5, -1.5, -6.5, 3.5, -9, 6.5, -11.5, 3.5], C.tealDark);
    circle(ctx, -9, 1.5, 1.4, C.gold);
  }
  ctx.restore();
}

function drawRat(ctx: Ctx, t: number): void {
  shadow(ctx, 11);
  const breathe = Math.sin(t * 5) * 0.5;
  // Tail
  ctx.beginPath();
  ctx.moveTo(-8, 7);
  ctx.quadraticCurveTo(-15, 8, -14, 1 + breathe);
  ctx.strokeStyle = '#b98c7a';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ellipse(ctx, -1, 5, 9.5, 6.5 + breathe * 0.4, '#7b6557');
  ellipse(ctx, -2, 7, 7, 3.5, '#8d7667');
  // Head
  ellipse(ctx, 8, 3, 5.5, 4.5, '#7b6557');
  circle(ctx, 5.5, -1.5, 2.6, '#8d7667');
  circle(ctx, 5.5, -1.5, 1.4, '#c79a8c');
  circle(ctx, 13, 4, 1.2, '#c79a8c');
  circle(ctx, 9.5, 2, 1.1, C.emberBright);
  // Feet
  ellipse(ctx, 3, 11, 2.4, 1.2, '#b98c7a');
  ellipse(ctx, -5, 11, 2.4, 1.2, '#b98c7a');
}

function drawGuard(ctx: Ctx, t: number): void {
  shadow(ctx);
  const sway = Math.sin(t * 2.5) * 0.5;
  // Halberd
  fillRR(ctx, 10, -15, 1.6, 27, 0.8, '#5b4030');
  poly(ctx, [10.8, -17, 15, -11, 10.8, -8], C.steelShade);
  // Legs
  fillRR(ctx, -5, 6, 4, 7, 1.5, C.rustDark);
  fillRR(ctx, 1, 6, 4, 7, 1.5, C.rustDark);
  ctx.translate(0, sway);
  // Body
  fillRR(ctx, -8, -4, 16, 12, 3, C.rust);
  fillRR(ctx, -8, 4, 16, 4, 2, C.rustDark);
  circle(ctx, -4, 0, 1, C.rustDark);
  circle(ctx, 4, 0, 1, C.rustDark);
  circle(ctx, 0, 3, 1, C.rustDark);
  // Shoulders
  ellipse(ctx, -9, -3, 3.5, 3, C.rustDark);
  ellipse(ctx, 9, -3, 3.5, 3, C.rustDark);
  // Helmet, a flat topped bucket
  fillRR(ctx, -6.5, -15, 13, 12, 2, C.rust);
  fillRR(ctx, -7.5, -15.5, 15, 2.5, 1, C.rustDark);
  fillRR(ctx, -4.5, -10, 9, 3, 1, '#170f0c');
  circle(ctx, -2.2, -8.5, 1, C.emberBright);
  circle(ctx, 2.2, -8.5, 1, C.emberBright);
}

function drawWisp(ctx: Ctx, t: number): void {
  const hover = Math.sin(t * 4) * 1.5;
  ellipse(ctx, 0, 13, 6, 2, C.shadow);
  ctx.translate(0, hover - 2);
  const flick = Math.sin(t * 13) * 1.2;
  // Glow
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
  g.addColorStop(0, 'rgba(255, 179, 92, 0.45)');
  g.addColorStop(1, 'rgba(255, 179, 92, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-16, -16, 32, 32);
  // Outer flame
  ctx.beginPath();
  ctx.moveTo(0 + flick, -14);
  ctx.bezierCurveTo(9, -4, 10, 4, 6, 9);
  ctx.bezierCurveTo(3, 12, -3, 12, -6, 9);
  ctx.bezierCurveTo(-10, 4, -7, -3, 0 + flick, -14);
  ctx.fillStyle = C.ember;
  ctx.fill();
  // Inner flame
  ctx.beginPath();
  ctx.moveTo(0 + flick * 0.5, -7);
  ctx.bezierCurveTo(5, -1, 6, 5, 3.5, 8);
  ctx.bezierCurveTo(1.5, 10, -1.5, 10, -3.5, 8);
  ctx.bezierCurveTo(-6, 5, -4, -1, 0 + flick * 0.5, -7);
  ctx.fillStyle = '#ffd98a';
  ctx.fill();
  // Wax base and eyes
  fillRR(ctx, -4, 8, 8, 4, 1.5, '#efe2c4');
  circle(ctx, -2, 3, 1.2, '#3a1c10');
  circle(ctx, 2, 3, 1.2, '#3a1c10');
}

function drawHound(ctx: Ctx, t: number): void {
  shadow(ctx, 11);
  const breathe = Math.sin(t * 6) * 0.5;
  const dark = '#3b2f33';
  const mid = '#54454a';
  // Tail
  poly(ctx, [-10, 0, -15, -6, -9, 3], dark);
  // Legs
  fillRR(ctx, -9, 5, 3.4, 8, 1.2, dark);
  fillRR(ctx, -3, 6, 3.4, 7, 1.2, dark);
  fillRR(ctx, 3, 6, 3.4, 7, 1.2, dark);
  // Body
  fillRR(ctx, -11, -3 - breathe * 0.5, 19, 11 + breathe * 0.5, 4, mid);
  // Collar spikes
  fillRR(ctx, 4.5, -4, 3, 11, 1, C.rustDark);
  // Head
  fillRR(ctx, 5, -9, 10, 9, 3, mid);
  fillRR(ctx, 10, -4, 6, 4.5, 1.5, dark);
  poly(ctx, [6, -8, 7.5, -14, 10, -8.5], dark);
  poly(ctx, [10.5, -8.5, 13, -13.5, 14.5, -7.5], dark);
  circle(ctx, 10.5, -5.5, 1.2, C.emberBright);
  poly(ctx, [11.5, 0.5, 12.5, 2.5, 13.5, 0.5], '#efe2c4');
}

function drawLurker(ctx: Ctx, t: number): void {
  shadow(ctx, 10);
  const pulse = Math.sin(t * 3.5) * 0.8;
  const body = '#3a2b3d';
  const edge = '#55405a';
  // Claws
  poly(ctx, [-13, 4, -17, -4, -10, 0], edge);
  poly(ctx, [13, 4, 17, -4, 10, 0], edge);
  // Body, a hunched blob
  ctx.beginPath();
  ctx.moveTo(-12, 12);
  ctx.bezierCurveTo(-15, 0, -9, -12 - pulse, 0, -12 - pulse);
  ctx.bezierCurveTo(9, -12 - pulse, 15, 0, 12, 12);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, 12);
  ctx.bezierCurveTo(-9, 4, -5, -3, 0, -3);
  ctx.bezierCurveTo(5, -3, 9, 4, 8, 12);
  ctx.closePath();
  ctx.fillStyle = edge;
  ctx.fill();
  // Eyes
  ellipse(ctx, -4, -5, 2.4, 1.6, C.gold);
  ellipse(ctx, 4, -5, 2.4, 1.6, C.gold);
  circle(ctx, -4, -5, 0.8, '#1a1412');
  circle(ctx, 4, -5, 0.8, '#1a1412');
  circle(ctx, 0, -8.5, 1, C.gold);
  // Teeth
  poly(ctx, [-4, 2, -2.5, 5, -1, 2], '#efe2c4');
  poly(ctx, [1, 2, 2.5, 5, 4, 2], '#efe2c4');
}

function drawOrk(ctx: Ctx, t: number): void {
  shadow(ctx, 13);
  const breathe = Math.sin(t * 2.2) * 0.6;
  const skin = C.moss;
  const skinDark = C.mossDark;
  // Club, resting on the shoulder
  ctx.save();
  ctx.translate(11, -2);
  ctx.rotate(0.35 + Math.sin(t * 2.2) * 0.03);
  fillRR(ctx, -1.5, -16, 3, 20, 1.2, '#5b4030');
  fillRR(ctx, -4, -21, 8, 10, 3, '#6e4f3a');
  circle(ctx, -3.5, -17, 1.2, C.steelShade);
  circle(ctx, 3.5, -15, 1.2, C.steelShade);
  circle(ctx, 0, -20.5, 1.2, C.steelShade);
  ctx.restore();
  // Feet
  ellipse(ctx, -6, 12, 4.5, 2.2, skinDark);
  ellipse(ctx, 6, 12, 4.5, 2.2, skinDark);
  // Big round belly
  ellipse(ctx, 0, 3, 13, 10 + breathe, skin);
  ellipse(ctx, 0, 5, 9, 6.5 + breathe * 0.6, '#8fae5c');
  // Belt and buckle
  fillRR(ctx, -12.5, 6, 25, 3, 1.2, '#5b4030');
  fillRR(ctx, -2, 5.3, 4, 4.4, 1, C.gold);
  // Arms
  ellipse(ctx, -12.5, 0, 3.6, 6, skinDark);
  ellipse(ctx, 12, -1, 3.6, 5.5, skinDark);
  // Head
  ellipse(ctx, 0, -8, 8.5, 7, skin);
  // Ears
  poly(ctx, [-8, -9, -13, -12, -7.5, -5.5], skin);
  poly(ctx, [8, -9, 13, -12, 7.5, -5.5], skin);
  // Brow and eyes
  fillRR(ctx, -6, -11.5, 12, 2, 1, skinDark);
  circle(ctx, -3, -8.8, 1.2, C.gold);
  circle(ctx, 3, -8.8, 1.2, C.gold);
  // Jaw and tusks
  fillRR(ctx, -5, -5.5, 10, 3, 1.4, skinDark);
  poly(ctx, [-4.5, -4.5, -3.5, -8, -2.5, -4.5], '#efe2c4');
  poly(ctx, [2.5, -4.5, 3.5, -8, 4.5, -4.5], '#efe2c4');
  // Dented iron crown
  poly(ctx, [-6, -13, -6, -17, -3, -14.5, 0, -18, 3, -14.5, 6, -17, 6, -13], C.steelDark);
  circle(ctx, 0, -14.3, 0.9, C.red);
}

export function drawEnemy(ctx: Ctx, kind: EnemyKind, cx: number, cy: number, size: number, t: number, flip = false): void {
  begin(ctx, cx, cy, size, flip);
  switch (kind) {
    case 'rat':
      drawRat(ctx, t);
      break;
    case 'guard':
      drawGuard(ctx, t);
      break;
    case 'wisp':
      drawWisp(ctx, t);
      break;
    case 'hound':
      drawHound(ctx, t);
      break;
    case 'lurker':
      drawLurker(ctx, t);
      break;
    case 'boss':
      drawOrk(ctx, t);
      break;
  }
  ctx.restore();
}

// Small icons for the HUD and menus. Each fits in a box about `s` wide.
export function iconCoin(ctx: Ctx, x: number, y: number, s: number): void {
  circle(ctx, x, y, s / 2, C.goldDark);
  circle(ctx, x - s * 0.04, y - s * 0.04, s * 0.4, C.gold);
  fillRR(ctx, x - s * 0.07, y - s * 0.22, s * 0.14, s * 0.44, s * 0.05, C.goldDark);
}

export function iconPotion(ctx: Ctx, x: number, y: number, s: number): void {
  fillRR(ctx, x - s * 0.14, y - s * 0.5, s * 0.28, s * 0.3, s * 0.05, '#d9cdb2');
  fillRR(ctx, x - s * 0.2, y - s * 0.56, s * 0.4, s * 0.12, s * 0.04, '#8a6a3c');
  circle(ctx, x, y + s * 0.12, s * 0.36, '#d9cdb2');
  circle(ctx, x, y + s * 0.14, s * 0.29, C.red);
  circle(ctx, x - s * 0.1, y + s * 0.04, s * 0.07, '#f0a090');
}

export function iconSword(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  fillRR(ctx, -s * 0.07, -s * 0.55, s * 0.14, s * 0.75, s * 0.05, '#e9e4d8');
  fillRR(ctx, -s * 0.24, s * 0.16, s * 0.48, s * 0.1, s * 0.04, C.gold);
  fillRR(ctx, -s * 0.06, s * 0.24, s * 0.12, s * 0.26, s * 0.04, C.rustDark);
  ctx.restore();
}

export function iconShield(ctx: Ctx, x: number, y: number, s: number): void {
  const h = s / 2;
  poly(ctx, [x - h * 0.8, y - h * 0.9, x + h * 0.8, y - h * 0.9, x + h * 0.8, y + h * 0.1, x, y + h, x - h * 0.8, y + h * 0.1], C.teal);
  poly(ctx, [x - h * 0.5, y - h * 0.6, x + h * 0.5, y - h * 0.6, x + h * 0.5, y, x, y + h * 0.6, x - h * 0.5, y], C.tealDark);
  circle(ctx, x, y - h * 0.15, h * 0.18, C.gold);
}

export function iconArmor(ctx: Ctx, x: number, y: number, s: number): void {
  const h = s / 2;
  poly(
    ctx,
    [x - h * 0.9, y - h * 0.8, x - h * 0.35, y - h * 0.9, x, y - h * 0.6, x + h * 0.35, y - h * 0.9, x + h * 0.9, y - h * 0.8, x + h * 0.7, y - h * 0.1, x + h * 0.55, y + h * 0.9, x - h * 0.55, y + h * 0.9, x - h * 0.7, y - h * 0.1],
    C.steel,
  );
  fillRR(ctx, x - h * 0.55, y + h * 0.45, h * 1.1, h * 0.45, h * 0.1, C.steelShade);
  fillRR(ctx, x - h * 0.08, y - h * 0.5, h * 0.16, h * 0.95, h * 0.05, C.steelDark);
}

export function iconTrinket(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  const h = s / 2;
  poly(ctx, [x, y - h, x + h * 0.8, y, x, y + h, x - h * 0.8, y], color);
  poly(ctx, [x, y - h * 0.55, x + h * 0.4, y, x, y + h * 0.55, x - h * 0.4, y], 'rgba(255, 255, 255, 0.3)');
}
