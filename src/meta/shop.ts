// The shop between runs. Purchases here are permanent and are saved.
// Each purchase of the same thing costs more than the last one.
import { SaveData, UpgradeId, writeSave } from './save';

export interface ShopItem {
  id: UpgradeId;
  name: string;
  text: string;
  basePrice: number;
  growth: number;
  max: number;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'vigor', name: 'Vigor', text: '+4 max health in every run.', basePrice: 25, growth: 1.4, max: 10 },
  { id: 'might', name: 'Might', text: '+1 attack in every run.', basePrice: 35, growth: 1.5, max: 8 },
  { id: 'belt', name: 'Potion Belt', text: 'Start each run with one more potion.', basePrice: 40, growth: 1.8, max: 3 },
  { id: 'sword', name: 'Better Sword', text: 'Start each run with a sword one level higher.', basePrice: 70, growth: 2.2, max: 2 },
  { id: 'shield', name: 'Better Shield', text: 'Start each run with a shield one level higher.', basePrice: 70, growth: 2.2, max: 2 },
  { id: 'armor', name: 'Better Armor', text: 'Start each run with armor one level higher.', basePrice: 70, growth: 2.2, max: 2 },
];

export function shopPrice(item: ShopItem, save: SaveData): number {
  return Math.round(item.basePrice * Math.pow(item.growth, save.upgrades[item.id]));
}

export function isMaxed(item: ShopItem, save: SaveData): boolean {
  return save.upgrades[item.id] >= item.max;
}

export function buyFromShop(item: ShopItem, save: SaveData): boolean {
  if (isMaxed(item, save)) return false;
  const price = shopPrice(item, save);
  if (save.gold < price) return false;
  save.gold -= price;
  save.upgrades[item.id]++;
  writeSave(save);
  return true;
}
