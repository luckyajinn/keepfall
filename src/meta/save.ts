// Saved progress, kept in the browser's local storage.
// Only gold, shop upgrades and a few counters are saved. A run in progress is not.

export type UpgradeId = 'vigor' | 'might' | 'belt' | 'sword' | 'shield' | 'armor';

export interface SaveData {
  version: 1;
  gold: number;
  upgrades: Record<UpgradeId, number>;
  runs: number;
  wins: number;
  bestFloor: number;
}

const KEY = 'keepfall.save.v1';

export function emptySave(): SaveData {
  return {
    version: 1,
    gold: 0,
    upgrades: { vigor: 0, might: 0, belt: 0, sword: 0, shield: 0, armor: 0 },
    runs: 0,
    wins: 0,
    bestFloor: 0,
  };
}

function wholeNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

export function loadSave(): SaveData {
  const save = emptySave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return save;
    const data = JSON.parse(raw) as Partial<SaveData>;
    save.gold = wholeNumber(data.gold);
    save.runs = wholeNumber(data.runs);
    save.wins = wholeNumber(data.wins);
    save.bestFloor = wholeNumber(data.bestFloor);
    const ups = (data.upgrades ?? {}) as Record<string, unknown>;
    for (const id of Object.keys(save.upgrades) as UpgradeId[]) {
      save.upgrades[id] = wholeNumber(ups[id]);
    }
  } catch {
    // Storage can be blocked or hold bad data. Start fresh in that case.
  }
  return save;
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // The game still works without saving.
  }
}
