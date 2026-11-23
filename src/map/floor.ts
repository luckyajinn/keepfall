// Builds each floor: rooms, corridors, the stairs and the enemies.
import { Rng } from '../rng';
import { COLS, FINAL_FLOOR, ROWS, Tile, idx } from './tiles';
import { EnemyKind, MapEnemy, makeEnemyStats } from '../entities/enemies';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Floor {
  num: number;
  tiles: Uint8Array;
  rooms: Room[];
  start: Point;
  stairs: Point | null;
  enemies: MapEnemy[];
}

let nextEnemyId = 1;

function makeMapEnemy(kind: EnemyKind, floorNum: number, x: number, y: number, hidden: boolean): MapEnemy {
  return {
    id: nextEnemyId++,
    stats: makeEnemyStats(kind, floorNum),
    x,
    y,
    fromX: x,
    fromY: y,
    moveT: 1,
    hidden,
    patrol: null,
    wait: 0,
    dazed: 0,
  };
}

export function tileAt(floor: Floor, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return Tile.Wall;
  return floor.tiles[idx(x, y)] as Tile;
}

function carveRoom(tiles: Uint8Array, r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) tiles[idx(x, y)] = Tile.Floor;
  }
}

function center(r: Room): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function carveCorridor(tiles: Uint8Array, a: Point, b: Point, horizontalFirst: boolean): void {
  let x = a.x;
  let y = a.y;
  const stepX = () => {
    while (x !== b.x) {
      tiles[idx(x, y)] = Tile.Floor;
      x += Math.sign(b.x - x);
    }
  };
  const stepY = () => {
    while (y !== b.y) {
      tiles[idx(x, y)] = Tile.Floor;
      y += Math.sign(b.y - y);
    }
  };
  if (horizontalFirst) {
    stepX();
    stepY();
  } else {
    stepY();
    stepX();
  }
  tiles[idx(x, y)] = Tile.Floor;
}

/** Tiles of a room that don't touch its edge. An enemy here can always be walked around. */
function innerTiles(r: Room): Point[] {
  const out: Point[] = [];
  for (let y = r.y + 1; y <= r.y + r.h - 2; y++) {
    for (let x = r.x + 1; x <= r.x + r.w - 2; x++) out.push({ x, y });
  }
  return out;
}

function inRoom(r: Room, x: number, y: number, inset = 0): boolean {
  return x >= r.x + inset && x <= r.x + r.w - 1 - inset && y >= r.y + inset && y <= r.y + r.h - 1 - inset;
}

const key = (x: number, y: number) => `${x},${y}`;

function tryGenerate(num: number, rng: Rng): Floor | null {
  const tiles = new Uint8Array(COLS * ROWS);
  const rooms: Room[] = [];
  for (let i = 0; i < 80 && rooms.length < 6; i++) {
    const w = rng.int(4, 7);
    const h = rng.int(3, 5);
    const x = rng.int(1, COLS - w - 1);
    const y = rng.int(1, ROWS - h - 1);
    const clash = rooms.some((o) => x <= o.x + o.w && x + w >= o.x && y <= o.y + o.h && y + h >= o.y);
    if (!clash) rooms.push({ x, y, w, h });
  }
  if (rooms.length < 5) return null;

  rooms.sort((a, b) => center(a).x - center(b).x || center(a).y - center(b).y);
  rooms.forEach((r) => carveRoom(tiles, r));
  for (let i = 0; i < rooms.length - 1; i++) {
    carveCorridor(tiles, center(rooms[i]), center(rooms[i + 1]), rng.chance(0.5));
  }
  // One extra link makes a loop, so there is often a second way around.
  const skip = rng.int(0, rooms.length - 3);
  carveCorridor(tiles, center(rooms[skip]), center(rooms[skip + 2]), rng.chance(0.5));

  const start = center(rooms[0]);
  const lastRoom = rooms[rooms.length - 1];
  const stairs = rng.pick(innerTiles(lastRoom));
  tiles[idx(stairs.x, stairs.y)] = Tile.Stairs;

  const taken = new Set<string>([key(start.x, start.y), key(stairs.x, stairs.y)]);
  const enemies: MapEnemy[] = [];
  const visibleKinds: EnemyKind[] = num === 1 ? ['rat', 'rat', 'guard'] : ['rat', 'guard', 'wisp', 'hound', 'wisp', 'hound'];
  const visibleCount = num === 1 ? rng.int(3, 4) : rng.int(4, 5);
  const hiddenCount = num === 1 ? 2 : rng.int(2, 3);
  const otherRooms = rooms.slice(1);

  // Enemies the player can see. They stand in the inner part of a room, so there is always a way around.
  const roomOrder = rng.shuffle([...otherRooms]);
  for (let i = 0; i < visibleCount; i++) {
    const room = roomOrder[i % roomOrder.length];
    const free = innerTiles(room).filter((p) => !taken.has(key(p.x, p.y)));
    if (!free.length) continue;
    const spot = rng.pick(free);
    const enemy = makeMapEnemy(rng.pick(visibleKinds), num, spot.x, spot.y, false);
    taken.add(key(spot.x, spot.y));
    if (rng.chance(0.55)) {
      // Try to give it a short patrol path inside the room.
      const dirs = rng.shuffle([
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]);
      for (const d of dirs) {
        let len = 0;
        const want = rng.int(2, 3);
        while (len < want) {
          const nx = spot.x + d.x * (len + 1);
          const ny = spot.y + d.y * (len + 1);
          if (!inRoom(room, nx, ny, 1) || taken.has(key(nx, ny))) break;
          len++;
        }
        if (len >= 1) {
          for (let s = 1; s <= len; s++) taken.add(key(spot.x + d.x * s, spot.y + d.y * s));
          enemy.patrol = { ax: spot.x, ay: spot.y, bx: spot.x + d.x * len, by: spot.y + d.y * len, toB: true };
          enemy.wait = rng.range(0.2, 0.8);
          break;
        }
      }
    }
    enemies.push(enemy);
  }

  // Hidden ambushers. They also stay inside rooms, so one that the knight fled from can be walked around.
  for (let i = 0; i < hiddenCount; i++) {
    const room = rng.pick(otherRooms);
    const free = innerTiles(room).filter((p) => !taken.has(key(p.x, p.y)));
    if (!free.length) continue;
    const spot = rng.pick(free);
    taken.add(key(spot.x, spot.y));
    enemies.push(makeMapEnemy('lurker', num, spot.x, spot.y, true));
  }

  return { num, tiles, rooms, start, stairs, enemies };
}

/** The last floor has a set shape: an entry room, a guard hall and the boss hall. */
function bossFloor(num: number, rng: Rng): Floor {
  const tiles = new Uint8Array(COLS * ROWS);
  const entry: Room = { x: 1, y: 6, w: 4, h: 5 };
  const hall: Room = { x: 7, y: 5, w: 7, h: 7 };
  const throne: Room = { x: 16, y: 3, w: 8, h: 11 };
  const rooms = [entry, hall, throne];
  rooms.forEach((r) => carveRoom(tiles, r));
  carveCorridor(tiles, { x: 4, y: 8 }, { x: 7, y: 8 }, true);
  carveCorridor(tiles, { x: 13, y: 8 }, { x: 16, y: 8 }, true);
  // Pillars in the boss hall.
  for (const p of [
    { x: 18, y: 5 },
    { x: 18, y: 11 },
    { x: 21, y: 5 },
    { x: 21, y: 11 },
  ]) {
    tiles[idx(p.x, p.y)] = Tile.Wall;
  }

  const enemies: MapEnemy[] = [];
  const guardSpots = rng.shuffle([
    { x: 9, y: 6 },
    { x: 11, y: 10 },
    { x: 9, y: 10 },
    { x: 11, y: 6 },
  ]);
  const kinds: EnemyKind[] = ['guard', 'hound', 'wisp'];
  enemies.push(makeMapEnemy(rng.pick(kinds), num, guardSpots[0].x, guardSpots[0].y, false));
  enemies.push(makeMapEnemy(rng.pick(kinds), num, guardSpots[1].x, guardSpots[1].y, false));
  enemies.push(makeMapEnemy('lurker', num, guardSpots[2].x, guardSpots[2].y, true));
  enemies.push(makeMapEnemy('boss', num, 21, 8, false));

  return { num, tiles, rooms, start: { x: 2, y: 8 }, stairs: null, enemies };
}

export function generateFloor(num: number, rng: Rng): Floor {
  if (num >= FINAL_FLOOR) return bossFloor(num, rng);
  for (let attempt = 0; attempt < 200; attempt++) {
    const floor = tryGenerate(num, rng);
    if (floor) return floor;
  }
  throw new Error('Could not build a floor');
}
