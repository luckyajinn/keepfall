// Checks the trinket for sale at the vendor. Usage: PORT=5173 node tests/vendor-trinket.cjs [shot folder]
// With a shot folder, it also saves screenshots of the vendor screen there.
const fs = require('fs');
const path = require('path');
const { open, state, checks } = require('./lib.cjs');
const shots = process.argv[2];
const t = checks();

// Runs code in the page with the game as `g` and some game modules loaded.
const inPage = (page, fn, arg) => page.evaluate(async ({ src, arg }) => {
  const m = {
    knight: await import('/src/entities/knight.ts'),
    trinkets: await import('/src/items/trinkets.ts'),
    vendor: await import('/src/items/vendor.ts'),
    battle: await import('/src/battle/battle.ts'),
    enemies: await import('/src/entities/enemies.ts'),
    rng: await import('/src/rng.ts'),
  };
  return new Function('g', 'm', 'arg', `return (${src})(g, m, arg);`)(window.keepfall, m, arg);
}, { src: fn.toString(), arg });

const press = async (page, key) => { await page.keyboard.press(key); await page.waitForTimeout(40); };
const index = (page) => page.evaluate(() => window.keepfall.screen.state.index);
const lastSound = (page) => page.evaluate(() => window.keepfallSfx.played[window.keepfallSfx.played.length - 1]);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name) }); };

// Starts a fresh run and opens the vendor after floor 1. `owned` trinkets are given first, `gold` is set after.
const freshVendor = (page, owned = [], gold = 100) => inPage(page, (g, m, a) => {
  g.startRun(); g.floorCleared();
  g.run.knight.trinkets = [...a.owned]; g.run.knight.hp = m.knight.maxHp(g.run.knight);
  g.showVendor(); g.run.knight.gold = a.gold;
  return { offer: g.run.vendorTrinket, screen: g.screen.constructor.name, owned: [...g.run.knight.trinkets] };
}, { owned, gold });

// Puts a chosen trinket on sale, as if the roll had picked it.
const offerThis = (page, id) => inPage(page, (g, m, id) => { g.run.vendorTrinket = id; g.screen = new g.screen.constructor(g); }, id);

(async () => {
  const { browser, page, errors } = await open(5);
  const IDS = await inPage(page, (g, m) => m.trinkets.TRINKET_IDS);
  const PRICE = await inPage(page, (g, m) => m.vendor.VENDOR_TRINKET_PRICE);

  // The offer is a trinket the knight does not own.
  let fine = true;
  for (let i = 0; i < 40; i++) {
    const owned = IDS.filter((_, j) => (i >> (j % 5)) & 1 && j < 7);
    const v = await freshVendor(page, owned);
    if (v.screen !== 'VendorScreen' || !v.offer || owned.includes(v.offer) || !IDS.includes(v.offer)) { fine = false; console.log('bad offer', JSON.stringify(v)); }
  }
  t.ok(fine, 'the vendor offers a trinket the knight does not own, over 40 visits');
  const seven = await freshVendor(page, IDS.filter((id) => id !== 'thorn'));
  t.ok(seven.offer === 'thorn', 'a knight with 7 trinkets is offered the eighth', seven.offer);

  // showVendor draws one number from the game's stream and picks from the unowned trinkets with it.
  const draw = await inPage(page, (g, m) => {
    g.startRun(); g.floorCleared(); g.run.knight.trinkets = ['ember', 'bell'];
    const copy = new m.rng.Rng(0); copy.s = g.rng.s;
    const options = m.trinkets.TRINKET_IDS.filter((id) => !g.run.knight.trinkets.includes(id));
    const want = copy.pick(options);
    g.showVendor();
    return { want, got: g.run.vendorTrinket, sameStream: copy.s === g.rng.s };
  });
  t.ok(draw.got === draw.want && draw.sameStream, 'showVendor rolls one pick from this.rng over the unowned trinkets', JSON.stringify(draw));

  // Buying with enough gold.
  const v1 = await freshVendor(page, [], 100);
  await shot(page, 'vendor-trinket-start.png');
  await press(page, 's'); await press(page, 's'); await press(page, 's'); await press(page, 's');
  t.ok(await index(page) === 4, 'S four times selects the trinket row');
  await shot(page, 'vendor-trinket-for-sale.png');
  await press(page, 'Enter');
  let s = await state(page);
  let run = await page.evaluate(() => ({ spent: window.keepfall.run.spent, offer: window.keepfall.run.vendorTrinket }));
  t.ok(s.trinkets.includes(v1.offer) && s.trinkets.length === 1, 'buying adds the trinket to the knight', JSON.stringify(s.trinkets));
  t.ok(s.gold === 100 - PRICE, `buying takes ${PRICE} gold`, `gold ${s.gold}`);
  t.ok(run.spent === PRICE, 'the price counts in run.spent', `spent ${run.spent}`);
  t.ok(run.offer === null, 'the offer is cleared after buying');
  t.ok(await lastSound(page) === 'buy', 'buying plays buy');
  await shot(page, 'vendor-trinket-sold.png');
  await press(page, '5');
  s = await state(page);
  run = await page.evaluate(() => ({ spent: window.keepfall.run.spent, screen: window.keepfall.screen.constructor.name }));
  t.ok(s.gold === 100 - PRICE && s.trinkets.length === 1 && run.spent === PRICE && run.screen === 'VendorScreen', 'the sold trinket can not be bought again at this visit');
  t.ok(await lastSound(page) === 'deny', 'trying the sold row plays deny');
  const pure = await inPage(page, (g, m, id) => {
    const k = g.run.knight; const before = JSON.stringify(k);
    return { again: m.vendor.buyVendorTrinket(k, id), none: m.vendor.buyVendorTrinket(k, null), same: JSON.stringify(k) === before };
  }, v1.offer);
  t.ok(!pure.again && !pure.none && pure.same, 'buyVendorTrinket refuses an owned trinket and a null offer and changes nothing');

  // Too little gold.
  const v2 = await freshVendor(page, [], PRICE - 1);
  const before = await state(page);
  await press(page, '5');
  s = await state(page);
  run = await page.evaluate(() => ({ spent: window.keepfall.run.spent, offer: window.keepfall.run.vendorTrinket }));
  t.ok(s.gold === PRICE - 1 && s.trinkets.length === 0 && run.spent === 0 && run.offer === v2.offer && s.hp === before.hp, 'too little gold changes nothing');
  t.ok(await lastSound(page) === 'deny', 'too little gold plays deny');
  await shot(page, 'vendor-trinket-too-little-gold.png');

  // The Oak Token heals 10 when bought, as it does from a floor reward.
  await freshVendor(page, [], 100);
  await offerThis(page, 'oak');
  await inPage(page, (g, m) => { g.run.knight.hp = m.knight.maxHp(g.run.knight) - 20; });
  const oakBefore = await inPage(page, (g, m) => ({ hp: g.run.knight.hp, max: m.knight.maxHp(g.run.knight) }));
  await press(page, '5');
  const oakAfter = await inPage(page, (g, m) => ({ hp: g.run.knight.hp, max: m.knight.maxHp(g.run.knight) }));
  t.ok(oakAfter.max === oakBefore.max + 10 && oakAfter.hp === oakBefore.hp + 10, 'the Oak Token adds 10 max health and heals 10', JSON.stringify({ oakBefore, oakAfter }));

  // Every other trinket works once bought.
  for (const id of IDS.filter((x) => x !== 'oak')) {
    await freshVendor(page, [], 100);
    await offerThis(page, id);
    const pre = await inPage(page, (g, m) => ({ atk: m.knight.attackPower(g.run.knight) }));
    await press(page, '5');
    const r = await inPage(page, (g, m, a) => {
      const k = g.run.knight; const id = a.id;
      if (!k.trinkets.includes(id)) return { ok: false, why: 'not owned' };
      const foe = m.enemies.makeEnemyStats('guard', 1);
      // Fights a floor 1 guard with plain attacks until it ends.
      const fightOut = (seed, ambush = false) => {
        const b = new m.battle.Battle(k, foe, ambush, new m.rng.Rng(seed)); const events = b.begin();
        for (let i = 0; i < 100 && b.outcome === 'ongoing'; i++) events.push(...b.act('attack'));
        return { b, events };
      };
      if (id === 'ember') return { ok: m.knight.attackPower(k) === a.pre.atk + 2, why: `atk ${a.pre.atk} -> ${m.knight.attackPower(k)}` };
      if (id === 'coin') { const { b } = fightOut(1); return { ok: b.reward.gold === Math.round(foe.gold * 1.25) && b.reward.gold !== foe.gold, why: `gold ${b.reward.gold} of ${foe.gold}` }; }
      if (id === 'ribbon') { const { b } = fightOut(1); return { ok: b.reward.xp === Math.round(foe.xp * 1.25) && b.reward.xp !== foe.xp, why: `xp ${b.reward.xp} of ${foe.xp}` }; }
      if (id === 'thorn') { const { events } = fightOut(2); return { ok: events.some((e) => e.source === 'thorn'), why: 'thorn event' }; }
      if (id === 'leaf') { k.hp = 20; const { b, events } = fightOut(3); return { ok: b.outcome === 'won' && events.some((e) => e.text.startsWith("Your Mender's Leaf heals")), why: 'leaf heal event' }; }
      if (id === 'buckle') { let all = true; for (let s = 1; s <= 30; s++) { const b = new m.battle.Battle(k, foe, false, new m.rng.Rng(s)); b.begin(); b.act('flee'); if (b.outcome !== 'fled') all = false; } return { ok: all, why: '30 flees' }; }
      if (id === 'bell') { let clean = true; for (let s = 1; s <= 30; s++) { const b = new m.battle.Battle(k, foe, true, new m.rng.Rng(s)); if (b.begin().some((e) => e.anim === 'knightHit')) clean = false; } return { ok: clean, why: '30 ambushes' }; }
      return { ok: false, why: 'unknown' };
    }, { id, pre });
    t.ok(r.ok, `bought ${id} works`, r.why);
  }

  // A knight who owns all 8 is offered none. The screen has 5 rows and still works.
  const all = await freshVendor(page, IDS, 100);
  t.ok(all.offer === null, 'a knight with all 8 trinkets is offered none');
  await shot(page, 'vendor-trinket-none.png');
  for (let i = 0; i < 4; i++) await press(page, 's');
  t.ok(await index(page) === 4, 'with no offer, S four times reaches Climb');
  await press(page, 's');
  t.ok(await index(page) === 0, 'with no offer, S wraps from Climb to the first row');
  await press(page, 'w');
  t.ok(await index(page) === 4, 'with no offer, W from the first row goes to Climb');
  await press(page, '6');
  t.ok((await state(page)).screen === 'VendorScreen', 'with no offer, key 6 does nothing');
  await press(page, '5');
  s = await state(page);
  t.ok(s.screen === 'MapScreen' && s.floor === 2, 'with no offer, key 5 climbs to floor 2', `${s.screen} ${s.floor}`);

  // The second visit rolls again.
  const visits = await inPage(page, (g) => {
    const seen = new Set(); let fresh = true;
    for (let i = 0; i < 30; i++) {
      g.startRun(); g.floorCleared(); g.showVendor(); const first = g.run.vendorTrinket;
      g.nextFloor(); g.floorCleared(); const s0 = g.rng.s; g.showVendor();
      const second = g.run.vendorTrinket;
      if (!second || g.run.knight.trinkets.includes(second) || g.rng.s === s0) fresh = false;
      seen.add(`${first}>${second}`);
    }
    return { fresh, kinds: seen.size, floor: g.run.floorNum };
  });
  t.ok(visits.fresh && visits.floor === 2 && visits.kinds > 10, 'the second vendor visit rolls a new offer', JSON.stringify(visits));

  // Every row is reachable with W and S and with its number key. Climb goes to the next floor.
  await freshVendor(page, [], 0);
  const down = [];
  for (let i = 0; i < 6; i++) { await press(page, 's'); down.push(await index(page)); }
  t.ok(JSON.stringify(down) === '[1,2,3,4,5,0]', 'S walks all 6 rows and wraps', JSON.stringify(down));
  const up = [];
  for (let i = 0; i < 6; i++) { await press(page, 'w'); up.push(await index(page)); }
  t.ok(JSON.stringify(up) === '[5,4,3,2,1,0]', 'W walks all 6 rows backward', JSON.stringify(up));
  let keysOk = true;
  for (let n = 1; n <= 5; n++) { await press(page, String(n)); if (await index(page) !== n - 1 || (await state(page)).screen !== 'VendorScreen') keysOk = false; }
  t.ok(keysOk, 'keys 1 to 5 pick the item and trinket rows and stay on the vendor');
  await press(page, '7');
  t.ok((await state(page)).screen === 'VendorScreen' && await index(page) === 4, 'key 7 does nothing with 6 rows');
  await press(page, '6');
  s = await state(page);
  t.ok(s.screen === 'MapScreen' && s.floor === 2, 'key 6 climbs to floor 2', `${s.screen} ${s.floor}`);
  await freshVendor(page, [], 0);
  await press(page, 'w');
  t.ok(await index(page) === 5, 'W from the first row selects Climb');
  await press(page, 'Enter');
  s = await state(page);
  t.ok(s.screen === 'MapScreen' && s.floor === 2, 'Enter on Climb goes to floor 2');

  // giveFloorReward gives the same results and draws the same numbers as the version before the vendor trinket.
  // That check needs a copy of the old src/items/rewards.ts at tests/old-rewards/rewards.ts, with its imports
  // pointed at ../../src. The copy is not committed, so without it the check is skipped.
  const hasOld = fs.existsSync(path.join(__dirname, 'old-rewards', 'rewards.ts'));
  const same = hasOld && await page.evaluate(async () => {
    const now = await import('/src/items/rewards.ts');
    const old = await import('/tests/old-rewards/rewards.ts');
    const { Rng } = await import('/src/rng.ts');
    const { newKnight, maxHp } = await import('/src/entities/knight.ts');
    const { emptySave } = await import('/src/meta/save.ts');
    const { TRINKET_IDS } = await import('/src/items/trinkets.ts');
    let bad = 0, trinkets = 0, oaks = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const r = new Rng(seed * 31 + 7);
      const k = newKnight(emptySave());
      k.gear = { sword: r.int(1, 3), shield: r.int(1, 3), armor: r.int(1, 3) };
      k.trinkets = TRINKET_IDS.filter(() => r.chance(seed % 9 === 0 ? 0.95 : 0.3));
      k.hp = r.int(1, maxHp(k));
      const k2 = structuredClone(k);
      const a = new Rng(seed), b = new Rng(seed);
      const ra = old.giveFloorReward(k, a), rb = now.giveFloorReward(k2, b);
      if (JSON.stringify(ra) !== JSON.stringify(rb) || JSON.stringify(k) !== JSON.stringify(k2) || a.next() !== b.next()) bad++;
      if (ra.trinket) trinkets++;
      if (ra.trinket === 'oak') oaks++;
    }
    return { bad, trinkets, oaks };
  });
  if (!same) console.log('SKIP giveFloorReward old version check: no copy at tests/old-rewards/rewards.ts');
  else t.ok(same.bad === 0 && same.trinkets > 500 && same.oaks > 30, 'giveFloorReward matches the old version over 4000 seeds', JSON.stringify(same));

  await browser.close();
  t.done(errors);
})().catch((e) => { console.error(e); process.exit(1); });
