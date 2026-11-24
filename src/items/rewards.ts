// The reward for clearing a floor.
// The lowest level item always goes up one level. There is a 25% chance of a trinket as well.
import { Rng } from '../rng';
import { GEAR_SLOTS, GearSlot, Knight, heal, maxHp } from '../entities/knight';
import { TRINKET_IDS, TrinketId } from './trinkets';

export const TRINKET_CHANCE = 0.25;

export interface FloorReward {
  slot: GearSlot;
  newLevel: number;
  trinket: TrinketId | null;
  healed: number;
}

export function giveFloorReward(k: Knight, rng: Rng): FloorReward {
  const lowest = Math.min(...GEAR_SLOTS.map((s) => k.gear[s]));
  const slot = rng.pick(GEAR_SLOTS.filter((s) => k.gear[s] === lowest));
  k.gear[slot]++;
  // New armor adds max health. Give the knight that health right away.
  if (slot === 'armor') heal(k, 8);

  let trinket: TrinketId | null = null;
  if (rng.chance(TRINKET_CHANCE)) {
    trinket = rollTrinket(k, rng);
    if (trinket) giveTrinket(k, trinket);
  }

  const healed = heal(k, Math.ceil(maxHp(k) * 0.25));
  return { slot, newLevel: k.gear[slot], trinket, healed };
}

/** A random trinket the knight does not own yet, or null when it owns them all (no number is drawn then). */
export function rollTrinket(k: Knight, rng: Rng): TrinketId | null {
  const options = TRINKET_IDS.filter((id) => !k.trinkets.includes(id));
  return options.length ? rng.pick(options) : null;
}

/** Hands a trinket to the knight. Used by the floor reward and the vendor. */
export function giveTrinket(k: Knight, id: TrinketId): void {
  k.trinkets.push(id);
  // The Oak Token adds max health. Give the knight that health right away.
  if (id === 'oak') heal(k, 10);
}
