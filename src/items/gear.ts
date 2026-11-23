// Gear: a sword for damage, a shield for Guard and armor for health.
import type { GearSlot } from '../entities/knight';

export const GEAR_LABEL: Record<GearSlot, string> = {
  sword: 'Sword',
  shield: 'Shield',
  armor: 'Armor',
};

export const GEAR_EFFECT: Record<GearSlot, string> = {
  sword: '+3 attack',
  shield: '+12% Guard block',
  armor: '+8 max health',
};

const NAMES: Record<GearSlot, string[]> = {
  sword: ['Worn Sword', 'Iron Sword', 'Steel Sword', 'Knightly Blade', 'Sunforged Blade'],
  shield: ['Plank Shield', 'Iron Shield', 'Kite Shield', 'Tower Shield', 'Sunforged Shield'],
  armor: ['Padded Coat', 'Mail Shirt', 'Scale Coat', 'Plate Armor', 'Sunforged Plate'],
};

export function gearName(slot: GearSlot, level: number): string {
  const names = NAMES[slot];
  if (level <= names.length) return names[level - 1];
  return `${names[names.length - 1]} +${level - names.length}`;
}
