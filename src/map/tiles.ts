// Tile grid basics.
export const TILE = 32;
export const COLS = 25;
export const ROWS = 17;
export const FINAL_FLOOR = 3;

export const Tile = { Wall: 0, Floor: 1, Stairs: 2 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export function idx(x: number, y: number): number {
  return y * COLS + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}
