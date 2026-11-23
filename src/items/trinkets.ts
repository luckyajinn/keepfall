// Trinkets give passive bonuses for the rest of the run.

export type TrinketId = 'ember' | 'oak' | 'coin' | 'ribbon' | 'thorn' | 'leaf' | 'buckle' | 'bell';

export interface TrinketDef {
  id: TrinketId;
  name: string;
  text: string;
  color: string;
}

export const TRINKETS: Record<TrinketId, TrinketDef> = {
  ember: { id: 'ember', name: 'Ember Charm', text: '+2 attack', color: '#e2703a' },
  oak: { id: 'oak', name: 'Oak Token', text: '+10 max health', color: '#8a6a3c' },
  coin: { id: 'coin', name: 'Lucky Coin', text: '+25% gold from fights', color: '#f2b84b' },
  ribbon: { id: 'ribbon', name: "Scholar's Ribbon", text: '+25% XP from fights', color: '#79b0a6' },
  thorn: { id: 'thorn', name: 'Thorn Ring', text: 'Enemies that hit you take 2 damage', color: '#7a9a4a' },
  leaf: { id: 'leaf', name: "Mender's Leaf", text: 'Heal 3 health after each fight you win', color: '#a8c66c' },
  buckle: { id: 'buckle', name: 'Swift Buckle', text: 'Flee always works', color: '#c2bcb0' },
  bell: { id: 'bell', name: 'Bell of Warning', text: 'Ambushers no longer get the first turn', color: '#d9a0d0' },
};

export const TRINKET_IDS = Object.keys(TRINKETS) as TrinketId[];
