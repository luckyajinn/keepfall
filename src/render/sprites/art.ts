// The shapes every character and icon file in this folder exports, and small helpers they share.
//
// One file per character: knight.ts, rat.ts, guard.ts, wisp.ts, hound.ts, lurker.ts, boss.ts,
// plus icons.ts. Each one exports `art`, a function that builds its sprites the first time it is
// called (with lazy() from pixel.ts) and then returns the same object every time.
//
// - Enemy files export `art: () => EnemyArt`. All frames face right. drawEnemy flips them.
// - knight.ts exports `art: () => KnightArt`. Left is made by flipping right.
// - icons.ts exports `art: () => Record<IconName, IconArt>`.
//
// Sizes (art pixels): small 16 by 16 (one map tile), large 64 by 64 (battle). The boss is
// 32 by 32 small and 96 by 96 large. Icons are 8 by 8 small and 24 by 24 large.
// A sprite is drawn with its box centered on the point the screen asks for.

import type { Sprite } from '../pixel';

export type SpriteSize = 'small' | 'large';

/** Optional extras for drawing a character: a stepped alpha, and a solid color for a hit flash. */
export interface SpriteFx {
  /** 0 to 1, rounded to a 25% step. */
  alpha?: number;
  /** Every opaque pixel drawn in this color. */
  tint?: string;
  /** Shows the enemy's wind-up pose, if its art has one. Used while it readies a heavy blow. */
  windup?: boolean;
}

/** What every enemy file exports (through `art()`). */
export interface EnemyArt {
  /** Map frames, facing right, played in a loop as the idle animation. 16 by 16 (the boss 32 by 32). */
  small: Sprite[];
  /** Battle frames, facing right, played in a loop. 64 by 64 (the boss 96 by 96). */
  large: Sprite[];
  /** Seconds each frame shows. */
  frameTime: number;
  /** Optional large frames for the pose shown while the enemy winds up a heavy blow. */
  windup?: Sprite[];
}

/** One facing of the knight. */
export interface KnightPose {
  /** Played in a loop while standing. */
  idle: Sprite[];
  /** Played in a loop while moving. */
  walk: Sprite[];
}

/** What knight.ts exports (through `art()`). Left is right flipped, so it is not stored. */
export interface KnightArt {
  /** 16 by 16, one map tile. */
  small: Record<'down' | 'up' | 'right', KnightPose>;
  /** 64 by 64, for the battle and the title. */
  large: Record<'down' | 'up' | 'right', KnightPose>;
  /** Seconds per idle frame and per walk frame. */
  idleTime: number;
  walkTime: number;
}

export type IconName = 'coin' | 'potion' | 'sword' | 'shield' | 'armor' | 'trinket';

/** What icons.ts exports for each icon (through `art()`). */
export interface IconArt {
  /** 8 by 8. */
  small: Sprite;
  /** 24 by 24. */
  large: Sprite;
}

/** The frame to show at time t (seconds) for a looping animation. `offset` lets two copies of one enemy move out of step. */
export function frameAt(frames: readonly Sprite[], t: number, frameTime: number, offset = 0): Sprite {
  const i = Math.floor((t + offset) / frameTime);
  return frames[((i % frames.length) + frames.length) % frames.length];
}
