// Simulates whole runs with the real battle rules, without the map. Run it with: npm run sim
import { Rng } from '../../src/rng';
import { emptySave, SaveData } from '../../src/meta/save';
import { newKnight, maxHp, Knight } from '../../src/entities/knight';
import { giveFloorReward, rollTrinket } from '../../src/items/rewards';
import { makeEnemyStats, EnemyKind } from '../../src/entities/enemies';
import { Battle } from '../../src/battle/battle';
import { VENDOR_ITEMS, VENDOR_TRINKET_PRICE, buyFromVendor, buyVendorTrinket, newVendorCounts } from '../../src/items/vendor';

// `trinket` buys the vendor's trinket when gold allows: 'first' before anything else, 'afterPotions' once potions are up to 3.
// Plans without it do not roll the vendor trinket, so their random draws stay as they were.
interface Plan { fightShare: number; guards: boolean; potionAt: number; shop?: Partial<SaveData['upgrades']>; vendor?: boolean; trinket?: 'first' | 'afterPotions' }

function fight(k: Knight, kind: EnemyKind, floor: number, ambush: boolean, rng: Rng, plan: Plan): boolean {
  const b = new Battle(k, makeEnemyStats(kind, floor), ambush, rng);
  b.begin();
  let turns = 0;
  while (b.outcome === 'ongoing' && turns++ < 300) {
    if (plan.guards && b.charging) b.act('guard');
    else if (k.potions > 0 && k.hp <= maxHp(k) * plan.potionAt) b.act('potion');
    else b.act('attack');
  }
  return b.outcome === 'won';
}

function run(seed: number, plan: Plan) {
  const rng = new Rng(seed);
  const save = emptySave();
  Object.assign(save.upgrades, plan.shop ?? {});
  const k = newKnight(save);
  const counts = newVendorCounts();
  for (let floor = 1; floor <= 3; floor++) {
    const fights: { kind: EnemyKind; ambush: boolean }[] = [];
    if (floor < 3) {
      const kinds: EnemyKind[] = floor === 1 ? ['rat', 'rat', 'guard'] : ['rat', 'guard', 'wisp', 'hound', 'wisp', 'hound'];
      const visible = floor === 1 ? rng.int(3, 4) : rng.int(4, 5);
      const hidden = floor === 1 ? 2 : rng.int(2, 3);
      for (let i = 0; i < visible; i++) if (rng.chance(plan.fightShare)) fights.push({ kind: rng.pick(kinds), ambush: false });
      // About half of the hidden enemies are met, whatever the player wants.
      for (let i = 0; i < hidden; i++) if (rng.chance(0.5)) fights.push({ kind: 'lurker', ambush: true });
    } else {
      for (let i = 0; i < 2; i++) if (rng.chance(plan.fightShare)) fights.push({ kind: rng.pick(['guard', 'hound', 'wisp'] as EnemyKind[]), ambush: false });
      if (rng.chance(0.4)) fights.push({ kind: 'lurker', ambush: true });
    }
    rng.shuffle(fights);
    for (const f of fights) if (!fight(k, f.kind, floor, f.ambush, rng, plan)) return { won: false, floor, level: k.level, gold: k.gold };
    if (floor < 3) {
      giveFloorReward(k, rng);
      if (plan.vendor !== false) {
        // The game rolls the vendor's trinket as the vendor opens, right after the floor reward.
        const offer = plan.trinket ? rollTrinket(k, rng) : null;
        if (plan.trinket === 'first') buyVendorTrinket(k, offer);
        // Potions first when short, then whetstones.
        for (let n = 0; n < 6; n++) {
          if (plan.trinket === 'afterPotions' && k.potions >= 3 && buyVendorTrinket(k, offer)) continue;
          const want = k.potions < 3 ? VENDOR_ITEMS[0] : VENDOR_ITEMS[1];
          if (!buyFromVendor(k, want, counts)) break;
        }
      }
    } else if (!fight(k, 'boss', 3, false, rng, plan)) return { won: false, floor: 3.5, level: k.level, gold: k.gold };
  }
  return { won: true, floor: 4, level: k.level, gold: k.gold };
}

function report(label: string, plan: Plan) {
  const N = 3000; let w = 0, early = 0, lvl = 0, gold = 0;
  for (let s = 1; s <= N; s++) { const r = run(s * 7919 + 13, plan); if (r.won) w++; if (r.floor < 3.5) early++; lvl += r.level; gold += r.gold; }
  console.log(label.padEnd(40), 'win', ((w / N) * 100).toFixed(0).padStart(3) + '%', ' died before boss', ((early / N) * 100).toFixed(0).padStart(3) + '%', ' avg level', (lvl / N).toFixed(1), ' avg gold home', (gold / N).toFixed(0));
}

console.log('floor 3 attack:', (['rat', 'guard', 'wisp', 'hound', 'lurker', 'boss'] as EnemyKind[]).map((k) => `${k} ${makeEnemyStats(k, 3).atk}`).join(', '));
// Target bands for these four lines: 0 to 1%, 15 to 30%, 65 to 80%, 15 to 35%.
report('skip all, careful', { fightShare: 0, guards: true, potionAt: 0.4 });
report('half clear, careful', { fightShare: 0.5, guards: true, potionAt: 0.4 });
report('full clear, careful', { fightShare: 1, guards: true, potionAt: 0.4 });
report('full clear, never guards', { fightShare: 1, guards: false, potionAt: 0.3 });
report('full clear, careful, no vendor', { fightShare: 1, guards: true, potionAt: 0.4, vendor: false });
report('full clear, careful, small shop', { fightShare: 1, guards: true, potionAt: 0.4, shop: { vigor: 2, might: 1 } });
console.log(`vendor trinket at ${VENDOR_TRINKET_PRICE} gold:`);
report('full clear, careful, trinket, potions', { fightShare: 1, guards: true, potionAt: 0.4, trinket: 'first' });
report('full clear, careful, potions, trinket', { fightShare: 1, guards: true, potionAt: 0.4, trinket: 'afterPotions' });
