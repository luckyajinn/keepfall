// The knight's state for one run, and the numbers that come from it.
import type { TrinketId } from '../items/trinkets';
import type { SaveData } from '../meta/save';

export type GearSlot = 'sword' | 'shield' | 'armor';
export const GEAR_SLOTS: readonly GearSlot[] = ['sword', 'shield', 'armor'];

export interface Knight {
  level: number;
  xp: number;
  hp: number;
  gold: number;
  potions: number;
  gear: Record<GearSlot, number>;
  trinkets: TrinketId[];
  /** Boosts bought from the vendor between floors. They last for this run only. */
  temp: { atk: number; hp: number; guard: number };
  /** Boosts bought in the shop between runs. */
  perm: { atk: number; hp: number };
}

export function newKnight(save: SaveData): Knight {
  const u = save.upgrades;
  const k: Knight = {
    level: 1,
    xp: 0,
    hp: 0,
    gold: save.gold,
    potions: 2 + u.belt,
    gear: { sword: 1 + u.sword, shield: 1 + u.shield, armor: 1 + u.armor },
    trinkets: [],
    temp: { atk: 0, hp: 0, guard: 0 },
    perm: { atk: u.might, hp: u.vigor * 4 },
  };
  k.hp = maxHp(k);
  return k;
}

export function has(k: Knight, id: TrinketId): boolean {
  return k.trinkets.includes(id);
}

export function maxHp(k: Knight): number {
  return 24 + 5 * (k.level - 1) + 8 * k.gear.armor + k.perm.hp + k.temp.hp + (has(k, 'oak') ? 10 : 0);
}

export function attackPower(k: Knight): number {
  return 3 + (k.level - 1) + 3 * k.gear.sword + k.perm.atk + k.temp.atk + (has(k, 'ember') ? 2 : 0);
}

/** The share of damage that Guard blocks, from 0 to 1. */
export function guardShare(k: Knight): number {
  return Math.min(0.85, 0.35 + 0.12 * k.gear.shield + k.temp.guard);
}

export function xpToNext(level: number): number {
  return 12 + 8 * (level - 1);
}

export function potionHeal(k: Knight): number {
  return Math.max(10, Math.round(maxHp(k) * 0.4));
}

export function heal(k: Knight, amount: number): number {
  const before = k.hp;
  k.hp = Math.min(maxHp(k), k.hp + amount);
  return k.hp - before;
}

/** Adds XP and returns how many levels were gained. Each level heals half of max health. */
export function gainXp(k: Knight, amount: number): number {
  k.xp += amount;
  let levels = 0;
  while (k.xp >= xpToNext(k.level)) {
    k.xp -= xpToNext(k.level);
    k.level++;
    levels++;
    heal(k, Math.ceil(maxHp(k) * 0.5));
  }
  return levels;
}
