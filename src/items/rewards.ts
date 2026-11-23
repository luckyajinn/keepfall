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
    const options = TRINKET_IDS.filter((id) => !k.trinkets.includes(id));
    if (options.length) {
      trinket = rng.pick(options);
      k.trinkets.push(trinket);
      if (trinket === 'oak') heal(k, 10);
    }
  }

  const healed = heal(k, Math.ceil(maxHp(k) * 0.25));
  return { slot, newLevel: k.gear[slot], trinket, healed };
}
