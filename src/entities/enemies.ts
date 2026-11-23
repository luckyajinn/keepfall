// Enemy types and their stats.
// Stats grow on higher floors. The boss has fixed stats.

export type EnemyKind = 'rat' | 'guard' | 'wisp' | 'hound' | 'lurker' | 'boss';
export type EnemyTrait = 'none' | 'heavy' | 'double';

export interface EnemyStats {
  kind: EnemyKind;
  name: string;
  maxHp: number;
  atk: number;
  xp: number;
  gold: number;
  trait: EnemyTrait;
  /** For the heavy trait: how many normal attacks come before each heavy blow. */
  heavyEvery: number;
  boss: boolean;
}

interface Template {
  name: string;
  hp: number;
  atk: number;
  xp: number;
  gold: number;
  trait: EnemyTrait;
  heavyEvery?: number;
}

const TEMPLATES: Record<EnemyKind, Template> = {
  rat: { name: 'Cellar Rat', hp: 9, atk: 3, xp: 5, gold: 3, trait: 'none' },
  guard: { name: 'Rust Guard', hp: 16, atk: 4, xp: 9, gold: 6, trait: 'heavy', heavyEvery: 2 },
  wisp: { name: 'Tallow Wisp', hp: 9, atk: 5, xp: 8, gold: 6, trait: 'none' },
  hound: { name: 'Gate Hound', hp: 15, atk: 4, xp: 10, gold: 7, trait: 'double' },
  lurker: { name: 'Rafter Lurker', hp: 12, atk: 5, xp: 9, gold: 8, trait: 'none' },
  boss: { name: 'Mogrum the Ork', hp: 140, atk: 10, xp: 60, gold: 60, trait: 'heavy', heavyEvery: 2 },
};

export function makeEnemyStats(kind: EnemyKind, floorNum: number): EnemyStats {
  const t = TEMPLATES[kind];
  const boss = kind === 'boss';
  const power = boss ? 1 : 1 + 0.6 * (floorNum - 1);
  const loot = boss ? 1 : 1 + 0.5 * (floorNum - 1);
  return {
    kind,
    name: t.name,
    maxHp: Math.round(t.hp * power),
    atk: Math.max(1, Math.round(t.atk * power)),
    xp: Math.round(t.xp * loot),
    gold: Math.round(t.gold * loot),
    trait: t.trait,
    heavyEvery: t.heavyEvery ?? 0,
    boss,
  };
}

/** An enemy standing on the floor map. */
export interface MapEnemy {
  id: number;
  stats: EnemyStats;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  /** 0 to 1 progress of the current step. 1 means it has arrived. */
  moveT: number;
  /** Hidden enemies are not drawn. They ambush the knight when it steps next to them. */
  hidden: boolean;
  /** Patrol between two tiles, or null to stand still. */
  patrol: { ax: number; ay: number; bx: number; by: number; toB: boolean } | null;
  wait: number;
  /** Seconds left in which this enemy can't start a fight (after the knight flees). */
  dazed: number;
}
