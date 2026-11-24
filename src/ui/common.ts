// Helpers shared by the menu style screens.
import type { Action } from '../input';
import { C } from '../render/colors';
import { Ctx, H, W, fillRR, poly } from '../render/draw';
import { sfx } from '../audio/sfx';

/** Moves a menu index with the up and down actions. Returns the picked row, or -1. */
export function menuInput(pressed: Action[], state: { index: number }, count: number): number {
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

export function nightSky(ctx: Ctx, t: number): void {
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
