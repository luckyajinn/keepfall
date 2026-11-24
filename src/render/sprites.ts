// Entry points for drawing characters and icons. The art itself lives in src/render/sprites/,
// one file per character (see sprites/art.ts for the shape each file exports).
//
// Every function takes the center of the sprite's box (cx, cy) in logical units and a size,
// 'small' (the map) or 'large' (the battle, the title and the end screens). Sprites are drawn at
// their native size, snapped to the pixel grid, never scaled.
import type { Dir } from '../input';
import type { EnemyKind } from '../entities/enemies';
import { RAMPS, rampFor } from './colors';
import type { Ctx } from './draw';
import { PX, Sprite, drawSprite, recolor } from './pixel';
import { EnemyArt, IconName, SpriteFx, SpriteSize, frameAt } from './sprites/art';
import { art as knightArt } from './sprites/knight';
import { art as ratArt } from './sprites/rat';
import { art as guardArt } from './sprites/guard';
import { art as wispArt } from './sprites/wisp';
import { art as houndArt } from './sprites/hound';
import { art as lurkerArt } from './sprites/lurker';
import { art as bossArt } from './sprites/boss';
import { TRINKET_RAMP, art as iconArt } from './sprites/icons';

export type { EnemyArt, IconName, KnightArt, KnightPose, IconArt, SpriteFx, SpriteSize } from './sprites/art';

const ENEMY_ART: Record<EnemyKind, () => EnemyArt> = {
  rat: ratArt,
  guard: guardArt,
  wisp: wispArt,
  hound: houndArt,
  lurker: lurkerArt,
  boss: bossArt,
};

/**
 * Draws the knight with its box centered on (cx, cy). `dir` picks the facing (left is right
 * flipped). `moving` plays the walk cycle, otherwise the idle one. `t` is the game time in seconds.
 */
export function drawKnight(ctx: Ctx, cx: number, cy: number, size: SpriteSize, dir: Dir, t: number, moving = false, fx: SpriteFx = {}): void {
  const a = knightArt();
  const pose = a[size][dir === 'left' ? 'right' : dir];
  const img = moving ? frameAt(pose.walk, t, a.walkTime) : frameAt(pose.idle, t, a.idleTime);
  drawSprite(ctx, img, cx, cy, { center: true, flip: dir === 'left', alpha: fx.alpha, tint: fx.tint });
}

/**
 * Draws an enemy with its box centered on (cx, cy). Enemy art faces right; `flip` makes it face left.
 * Add an offset to `t` (such as the enemy's id) so that two of a kind do not move in step.
 */
export function drawEnemy(ctx: Ctx, kind: EnemyKind, cx: number, cy: number, size: SpriteSize, t: number, flip = false, fx: SpriteFx = {}): void {
  const a = ENEMY_ART[kind]();
  const img = frameAt(a[size], t, a.frameTime);
  drawSprite(ctx, img, cx, cy, { center: true, flip, alpha: fx.alpha, tint: fx.tint });
}

/** The size of a character's box in logical units, for laying out around it. */
export function spriteSize(kind: EnemyKind | 'knight', size: SpriteSize): { w: number; h: number } {
  const frames = kind === 'knight' ? knightArt()[size].down.idle : ENEMY_ART[kind]()[size];
  return { w: frames[0].w * PX, h: frames[0].h * PX };
}

// Icons.

/** The size of an icon's box in logical units: 16 for small, 48 for large. */
export function iconSize(size: SpriteSize): number {
  return (size === 'small' ? 8 : 24) * PX;
}

function trinketIn(img: Sprite, color: string): Sprite {
  // The ramp closest in hue to the trinket's color. Built once per ramp: recolor() caches by its map.
  const ramp = RAMPS[rampFor(color)];
  return recolor(img, { [TRINKET_RAMP[0]]: ramp[0], [TRINKET_RAMP[1]]: ramp[1], [TRINKET_RAMP[2]]: ramp[2] });
}

/**
 * Draws an icon centered on (cx, cy). `color` recolors the trinket into the ramp closest in hue
 * (any CSS color works). The other icons have fixed colors and ignore it.
 */
export function drawIcon(ctx: Ctx, name: IconName, cx: number, cy: number, size: SpriteSize, color?: string): void {
  let img = iconArt()[name][size];
  if (name === 'trinket' && color) img = trinketIn(img, color);
  drawSprite(ctx, img, cx, cy, { center: true });
}

// The old icon functions, kept as thin wrappers so screens still compile. `s` was the old width in
// logical units: 32 and over picks the large icon. New code should call drawIcon.

const old = (s: number): SpriteSize => (s >= 32 ? 'large' : 'small');

export function iconCoin(ctx: Ctx, x: number, y: number, s: number): void {
  drawIcon(ctx, 'coin', x, y, old(s));
}

export function iconPotion(ctx: Ctx, x: number, y: number, s: number): void {
  drawIcon(ctx, 'potion', x, y, old(s));
}

export function iconSword(ctx: Ctx, x: number, y: number, s: number): void {
  drawIcon(ctx, 'sword', x, y, old(s));
}

export function iconShield(ctx: Ctx, x: number, y: number, s: number): void {
  drawIcon(ctx, 'shield', x, y, old(s));
}

export function iconArmor(ctx: Ctx, x: number, y: number, s: number): void {
  drawIcon(ctx, 'armor', x, y, old(s));
}

export function iconTrinket(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  drawIcon(ctx, 'trinket', x, y, old(s), color);
}
