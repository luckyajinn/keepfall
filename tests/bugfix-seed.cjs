// Regression test for fix 5 in PLAN.md "Bugs found and fixed": ?seed= repeats every floor, not only floor 1.
//   - With the same ?seed=, floors 1, 2 and 3 are the same (tiles, start, stairs, and each enemy's kind,
//     place, hidden flag and patrol) however many random numbers fights and rewards draw in between.
//   - Different seeds give different floors. A second run on the same page gets a different run seed.
//   - run.seed is a whole number that fits in 32 bits.
// Enemy ids are left out of the comparison: they come from a counter that keeps going across runs.
// Each floor is read in the same page task that builds it, before any game frame lets patrols move.
// Run with the dev server up: PORT=5173 node tests/bugfix-seed.cjs
const { open, checks, fight } = require('./lib.cjs');
const { waitScreen } = require('./bugfix-common.cjs');
const PORT = process.env.PORT || 5173;

// Installs window.__kfSnap(), which describes the floor on the map right now.
const installSnap = (page) => page.evaluate(() => {
  window.__kfSnap = () => { const f = window.keepfall.map.floor;
    return JSON.stringify({ num: f.num, tiles: Array.from(f.tiles), start: f.start, stairs: f.stairs,
      enemies: f.enemies.map((e) => ({ kind: e.stats.kind, x: e.x, y: e.y, hidden: e.hidden, patrol: e.patrol })) }); };
});

async function reload(page, seed) {
  await page.goto(`http://localhost:${PORT}/?seed=${seed}`);
  await page.waitForFunction(() => window.keepfall);
  await installSnap(page);
}

// One run: floors 1, 2 and 3, with `extra` random draws from the game's rng before each new floor.
const playRun = (page, extra) => page.evaluate((n) => {
  const g = window.keepfall; const out = {};
  g.startRun(); out.seed = g.run.seed; out.f1 = window.__kfSnap();
  for (let i = 0; i < n; i++) g.rng.next();
  g.nextFloor(); out.f2 = window.__kfSnap();
  for (let i = 0; i < n * 3; i++) g.rng.next();
  g.nextFloor(); out.f3 = window.__kfSnap();
  return out;
}, extra);

(async () => {
  const t = checks();
  const SEED = 4242;
  const { browser, page, errors } = await open(SEED);
  await installSnap(page);

  // Run A: no extra draws.
  const a = await playRun(page, 0);
  // Run B: the same seed on a fresh page, with extra draws before floors 2 and 3.
  await reload(page, SEED);
  const b = await playRun(page, 37);
  t.ok(a.seed === b.seed, 'the same ?seed= gives the same run seed on a fresh page', `${a.seed} ${b.seed}`);
  t.ok(a.f1 === b.f1, 'same seed: floor 1 is the same');
  t.ok(a.f2 === b.f2, 'same seed: floor 2 is the same after 37 extra random draws');
  t.ok(a.f3 === b.f3, 'same seed: floor 3 is the same after 111 more extra random draws');
  t.ok(a.f1 !== a.f2, 'floor 1 and floor 2 of one run differ');

  // Run C: the same seed, with a real fight on floor 1 and the floor reward before floor 2.
  await reload(page, SEED);
  const c1 = await page.evaluate(() => { const g = window.keepfall; g.startRun();
    return { seed: g.run.seed, f1: window.__kfSnap(), rng: g.rng.s }; });
  t.ok(c1.f1 === a.f1, 'same seed (run C): floor 1 is the same');
  const fought = await page.evaluate(() => { const g = window.keepfall; const e = g.map.floor.enemies.find((x) => !x.hidden);
    g.run.knight.hp = 999; // a sure win, so the run goes on; the fight still draws its random numbers
    g.startBattle(e, false); return e.stats.kind; });
  await waitScreen(page, 'BattleScreen');
  const outcome = await fight(page);
  await waitScreen(page, 'MapScreen');
  const c2 = await page.evaluate(() => { const g = window.keepfall; const drawsAfterFight = g.rng.s; g.floorCleared();
    const drawsAfterReward = g.rng.s; g.nextFloor(); return { f2: window.__kfSnap(), drawsAfterFight, drawsAfterReward }; });
  t.ok(outcome === 'won' && c2.drawsAfterFight !== c1.rng && c2.drawsAfterReward !== c2.drawsAfterFight,
    `a real fight (${fought}, ${outcome}) and the floor reward drew random numbers`);
  const c3 = await page.evaluate(() => { const g = window.keepfall; for (let i = 0; i < 5; i++) g.rng.next(); g.nextFloor(); return window.__kfSnap(); });
  t.ok(c2.f2 === a.f2, 'same seed: floor 2 is the same after a real fight and a floor reward');
  t.ok(c3 === a.f3, 'same seed: floor 3 is the same after a real fight and a floor reward');

  // A different seed gives different floors.
  await reload(page, SEED + 1);
  const d = await playRun(page, 0);
  t.ok(d.seed !== a.seed, 'a different ?seed= gives a different run seed', `${a.seed} ${d.seed}`);
  t.ok(d.f1 !== a.f1 && d.f2 !== a.f2, 'a different ?seed= gives different floors 1 and 2');

  // A second run on the same page gets its own run seed and its own floors.
  await reload(page, SEED);
  const runs = await page.evaluate(() => { const g = window.keepfall; const out = [];
    for (let i = 0; i < 40; i++) { g.startRun(); out.push({ seed: g.run.seed, f1: window.__kfSnap() }); } return out; });
  t.ok(runs[0].f1 === a.f1, 'the first run on a fresh page matches run A');
  t.ok(runs[1].seed !== runs[0].seed && runs[1].f1 !== runs[0].f1, 'a second startRun on the same page gets a different run seed and floor 1', `${runs[0].seed} ${runs[1].seed}`);
  t.ok(new Set(runs.map((r) => r.seed)).size === runs.length, '40 runs on one page all get different run seeds');
  const bad = runs.map((r) => r.seed).filter((s) => !(Number.isInteger(s) && s >= 0 && s <= 0xffffffff));
  t.ok(bad.length === 0, 'every run seed is a whole number from 0 to 2^32 - 1', JSON.stringify(bad));
  console.log('run seeds', runs.slice(0, 5).map((r) => r.seed).join(' '));

  await browser.close();
  t.done(errors);
})().catch((e) => { console.error(e); process.exit(1); });
