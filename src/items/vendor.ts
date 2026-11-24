// The vendor between floors. Everything sold here lasts for the current run only.
import { Knight, heal } from '../entities/knight';
import type { TrinketId } from './trinkets';
import { giveTrinket } from './rewards';

export type VendorItemId = 'potion' | 'whetstone' | 'tonic' | 'oil';

export interface VendorItem {
  id: VendorItemId;
  name: string;
  text: string;
  basePrice: number;
  priceStep: number;
}

export const VENDOR_ITEMS: readonly VendorItem[] = [
  { id: 'potion', name: 'Potion', text: 'One more potion to drink in a fight.', basePrice: 12, priceStep: 4 },
  { id: 'whetstone', name: 'Whetstone', text: '+2 attack until this run ends.', basePrice: 20, priceStep: 10 },
  { id: 'tonic', name: 'Iron Tonic', text: '+8 max health until this run ends.', basePrice: 20, priceStep: 10 },
  { id: 'oil', name: 'Guard Oil', text: '+6% Guard block until this run ends.', basePrice: 18, priceStep: 8 },
];

export type VendorCounts = Record<VendorItemId, number>;

export function newVendorCounts(): VendorCounts {
  return { potion: 0, whetstone: 0, tonic: 0, oil: 0 };
}

export function vendorPrice(item: VendorItem, counts: VendorCounts): number {
  return item.basePrice + item.priceStep * counts[item.id];
}

export function buyFromVendor(k: Knight, item: VendorItem, counts: VendorCounts): boolean {
  const price = vendorPrice(item, counts);
  if (k.gold < price) return false;
  k.gold -= price;
  counts[item.id]++;
  switch (item.id) {
    case 'potion':
      k.potions++;
      break;
    case 'whetstone':
      k.temp.atk += 2;
      break;
    case 'tonic':
      k.temp.hp += 8;
      heal(k, 8);
      break;
    case 'oil':
      k.temp.guard += 0.06;
      break;
  }
  return true;
}

/** Each vendor visit offers one trinket the knight does not own, at this fixed price. */
export const VENDOR_TRINKET_PRICE = 25;

/** Buys the offered trinket. Returns false and changes nothing when there is none, it is owned or gold is short. */
export function buyVendorTrinket(k: Knight, id: TrinketId | null): boolean {
  if (!id || k.trinkets.includes(id) || k.gold < VENDOR_TRINKET_PRICE) return false;
  k.gold -= VENDOR_TRINKET_PRICE;
  giveTrinket(k, id);
  return true;
}
