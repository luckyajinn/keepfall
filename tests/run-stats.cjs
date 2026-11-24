// Checks the run timer and the run stats on the end screen.
// Usage: PORT=5173 node tests/run-stats.cjs
// Set SHOTS to a folder to also save screenshots of the four end screens.
const path_ = require('path');
const { open, state, path, step, checks } = require('./lib.cjs');
const t = checks();

const seconds = (page) => page.evaluate(() => window.keepfall.run.stats.seconds);
const stats = (page) => page.evaluate(() => ({ ...window.keepfall.run.stats }));

// Seconds counted over about `ms` of wall clock time. Each frame adds at most 0.05 s, so the count
// can fall behind a slow browser but must never run ahead of the clock.
async function timed(page, ms) {
  const a = await seconds(page); const w = Date.now();
  await page.waitForTimeout(ms);
  const b = await seconds(page); const wall = (Date.now() - w) / 1000;
  return { grew: b - a, wall };
}
const sane = (r) => r.grew > r.wall * 0.5 && r.grew <= r.wall + 0.1;

// Health lost to blows, read from the battle's own events (logged by the patch below).
// Only a knightHit lowers health, and it never comes first in a list, so compare with the event before it.
const lostFromEvents = (page) => page.evaluate(() => {
  let lost = 0;
  for (const list of window.keepfall.screen.battle.__log) {
    for (let i = 1; i < list.length; i++) if (list[i].anim === 'knightHit') lost += list[i - 1].knightHp - list[i].knightHp;
  }
  return lost;
});

// Waits for the battle menu, or for the fight to be over and its last event showing.
async function waitTurn(page) {
  for (let i = 0; i < 300; i++) {
    const s = await state(page);
    if (s.screen !== 'BattleScreen' || s.battle.inMenu || s.battle.outcome !== 'ongoing') return s;
    await page.keyboard.press('Enter'); await page.waitForTimeout(40);
  }
  throw new Error('battle turn did not end');
}

// Plays the current battle with `pick(state)` until it is over. Returns the battle's numbers just
// before it ends and the run stats just after.
async function play(page, pick) {
  let s = await waitTurn(page);
  while (s.screen === 'BattleScreen' && s.battle.outcome === 'ongoing') {
    await page.keyboard.press(pick(s)); await page.waitForTimeout(40); s = await waitTurn(page);
  }
  const b = await page.evaluate(() => { const x = window.keepfall.screen.battle; return { outcome: x.outcome, potionsUsed: x.potionsUsed, damageTaken: x.damageTaken }; });
  b.lost = await lostFromEvents(page);
  // Leave the battle screen.
  for (let i = 0; i < 40 && (await state(page)).screen === 'BattleScreen'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(80); }
  const after = await state(page);
  return { b, after };
}

// Walks to the nearest visible enemy until a battle starts. Returns false if none can be reached.
async function walkToFight(page) {
  for (let n = 0; n < 200; n++) {
    const s = await state(page);
    if (s.screen === 'BattleScreen') return true;
    if (s.screen !== 'MapScreen') { await page.waitForTimeout(80); continue; }
    const visible = s.enemies.filter((e) => !e.hidden && !e.dazed && e.kind !== 'boss');
    let keys = null;
    for (const e of visible) {
      const p = path(s, e.x, e.y, new Set(s.enemies.filter((o) => o !== e && !o.hidden).map((o) => `${o.x},${o.y}`)));
      if (p && (!keys || p.length < keys.length)) keys = p;
    }
    if (!keys || !keys.length) { await page.waitForTimeout(100); continue; }
    await step(page, keys[0]);
  }
  return false;
}

// Every string drawn by the next frame.
const drawnText = (page) => page.evaluate(() => new Promise((done) => {
  const proto = CanvasRenderingContext2D.prototype; const orig = proto.fillText; const seen = [];
  proto.fillText = function (s, ...rest) { seen.push(String(s)); return orig.call(this, s, ...rest); };
  requestAnimationFrame(() => requestAnimationFrame(() => { proto.fillText = orig; done(seen); }));
}));

(async () => {
  const { browser, page, errors } = await open(7);

  // Pure rules first.
  const pure = await page.evaluate(async () => {
    const { Battle } = await import('/src/battle/battle.ts');
    const { Rng } = await import('/src/rng.ts');
    const { newKnight, maxHp } = await import('/src/entities/knight.ts');
    const { emptySave } = await import('/src/meta/save.ts');
    const { makeEnemyStats } = await import('/src/entities/enemies.ts');
    const { formatTime } = await import('/src/ui/endScreen.ts');
    const out = {};
    // Damage counted against health lost, attacking only and guarding only.
    // The boss has too much health to fall in six turns, so no win heals the knight.
    for (const action of ['attack', 'guard']) {
      const k = newKnight(emptySave()); k.hp = 200; k.potions = 0;
      const b = new Battle(k, makeEnemyStats('boss', 3), false, new Rng(11)); b.begin();
      let blocked = 0, hits = 0;
      for (let i = 0; i < 6 && b.outcome === 'ongoing'; i++) {
        for (const e of b.act(action)) if (e.anim === 'knightHit') { hits++; if (e.blocked) blocked++; }
      }
      out[action] = { lost: 200 - k.hp, counted: b.damageTaken, hits, blocked };
    }
    // A blow bigger than the health left counts only the health left.
    { const k = newKnight(emptySave()); k.hp = 2; k.potions = 0;
      const b = new Battle(k, makeEnemyStats('boss', 3), false, new Rng(3)); b.begin();
      while (b.outcome === 'ongoing') b.act('attack');
      out.lethal = { outcome: b.outcome, counted: b.damageTaken, hp: k.hp }; }
    // A potion at full health is refused and not counted. A real drink is.
    { const k = newKnight(emptySave());
      const b = new Battle(k, makeEnemyStats('rat', 1), false, new Rng(5)); b.begin();
      const refused = b.act('potion').length;
      const afterRefused = { used: b.potionsUsed, potions: k.potions };
      k.hp = maxHp(k) - 12; b.act('potion');
      out.potion = { refused, afterRefused, used: b.potionsUsed, potions: k.potions }; }
    out.time = [0, 42.7, 59.99, 60, 61, 582, 754.2, 3725].map(formatTime);
    return out;
  });
  t.ok(pure.attack.counted === pure.attack.lost && pure.attack.hits > 0 && pure.attack.blocked === 0, 'damage counted matches health lost without Guard', JSON.stringify(pure.attack));
  t.ok(pure.guard.counted === pure.guard.lost && pure.guard.hits > 0 && pure.guard.blocked === pure.guard.hits, 'damage counted matches health lost with Guard', JSON.stringify(pure.guard));
  t.ok(pure.lethal.outcome === 'lost' && pure.lethal.counted === 2 && pure.lethal.hp === 0, 'a killing blow counts only the health that was left', JSON.stringify(pure.lethal));
  t.ok(pure.potion.refused === 0 && pure.potion.afterRefused.used === 0 && pure.potion.afterRefused.potions === 2, 'a refused potion at full health is not counted', JSON.stringify(pure.potion));
  t.ok(pure.potion.used === 1 && pure.potion.potions === 1, 'a real drink is counted once', JSON.stringify(pure.potion));
  t.ok(JSON.stringify(pure.time) === JSON.stringify(['0:00', '0:42', '0:59', '1:00', '1:01', '9:42', '12:34', '62:05']), 'time formatting', JSON.stringify(pure.time));

  // Log each battle's events on the battle itself. This is the same module the game uses.
  await page.evaluate(async () => {
    const { Battle } = await import('/src/battle/battle.ts');
    for (const name of ['begin', 'act']) {
      const orig = Battle.prototype[name];
      Battle.prototype[name] = function (...args) { const ev = orig.apply(this, args); (this.__log ||= []).push(ev); return ev; };
    }
  });

  // No time passes before a run.
  t.ok(await page.evaluate(() => window.keepfall.run === null), 'no run on the title screen');
  const runWall = Date.now();
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const s0 = await stats(page);
  t.ok(s0.potionsUsed === 0 && s0.damageTaken === 0 && s0.seconds < 1, 'stats start at zero', JSON.stringify(s0));
  const runSeed = await page.evaluate(() => window.keepfall.run.seed);

  const onMap = await timed(page, 1000);
  t.ok(sane(onMap), 'seconds grow on the map', JSON.stringify(onMap));

  // Fight 1: a won fight. Refuse a potion at full health, drink one for real, then win.
  t.ok(await walkToFight(page), 'reached a first fight');
  const inBattle = await timed(page, 1000);
  t.ok(sane(inBattle), 'seconds grow in a battle', JSON.stringify(inBattle));
  await waitTurn(page);
  const k0 = await page.evaluate(() => { const k = window.keepfall.run.knight; return { hp: k.hp, potions: k.potions }; });
  // Make sure the knight is at full health before the refused drink.
  await page.evaluate(async () => { const { maxHp } = await import('/src/entities/knight.ts'); const k = window.keepfall.run.knight; k.hp = maxHp(k); });
  await page.keyboard.press('3'); await page.waitForTimeout(150);
  const refused = await page.evaluate(() => ({ used: window.keepfall.screen.battle.potionsUsed, potions: window.keepfall.run.knight.potions }));
  t.ok(refused.used === 0 && refused.potions === k0.potions, 'refused potion at full health not counted in the game', JSON.stringify(refused));
  await page.evaluate(() => { window.keepfall.run.knight.hp -= 10; });
  await page.keyboard.press('3'); await page.waitForTimeout(150);
  const drank = await page.evaluate(() => ({ used: window.keepfall.screen.battle.potionsUsed, potions: window.keepfall.run.knight.potions }));
  t.ok(drank.used === 1 && drank.potions === k0.potions - 1, 'real potion counted in the game', JSON.stringify(drank));
  const won = await play(page, (x) => (x.battle.charging ? '2' : '1'));
  const s1 = await stats(page);
  t.ok(won.b.outcome === 'won', 'first fight was won', won.b.outcome);
  t.ok(won.b.damageTaken === won.b.lost, 'damage counted matches health lost in the won fight', JSON.stringify(won.b));
  t.ok(s1.potionsUsed === 1 && s1.damageTaken === won.b.damageTaken, 'won fight carried over to the run', JSON.stringify(s1));

  // Fight 2: guard twice so the enemy hits, drink a potion, then flee.
  t.ok(await walkToFight(page), 'reached a second fight');
  let turn = 0;
  const fled = await play(page, (x) => { turn++; return turn <= 2 ? '2' : turn === 3 && x.potions > 0 ? '3' : '4'; });
  const s2 = await stats(page);
  t.ok(fled.b.outcome === 'fled', 'second fight was fled', fled.b.outcome);
  t.ok(fled.b.damageTaken > 0 && fled.b.potionsUsed === 1, 'fled fight has damage and a potion to carry over', JSON.stringify(fled.b));
  t.ok(fled.b.damageTaken === fled.b.lost, 'damage counted matches health lost in the fled fight', JSON.stringify(fled.b));
  t.ok(s2.damageTaken === s1.damageTaken + fled.b.damageTaken && s2.potionsUsed === s1.potionsUsed + fled.b.potionsUsed, 'fled fight carried over to the run', JSON.stringify(s2));

  // The reward screen and the vendor are part of the run.
  await page.evaluate(() => window.keepfall.floorCleared()); await page.waitForTimeout(100);
  t.ok((await state(page)).screen === 'RewardScreen', 'on the reward screen');
  const onReward = await timed(page, 1000);
  t.ok(sane(onReward), 'seconds grow on the reward screen', JSON.stringify(onReward));
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  t.ok((await state(page)).screen === 'VendorScreen', 'at the vendor');
  const atVendor = await timed(page, 1000);
  t.ok(sane(atVendor), 'seconds grow at the vendor', JSON.stringify(atVendor));
  await page.evaluate(() => window.keepfall.nextFloor()); await page.waitForTimeout(300);

  // Fight 3 and on: lose. Low health and no potions, attack only.
  const before = await stats(page);
  await page.evaluate(() => { const k = window.keepfall.run.knight; k.hp = 4; k.potions = 0; });
  let lostDamage = 0; let lostFights = 0;
  for (let n = 0; n < 6 && (await state(page)).screen !== 'EndScreen'; n++) {
    if (!(await walkToFight(page))) break;
    const r = await play(page, () => '1'); lostDamage += r.b.lost; lostFights++;
  }
  const end = await state(page);
  t.ok(end.screen === 'EndScreen', 'the run ended in a loss', `${lostFights} fights`);
  const runWallSec = (Date.now() - runWall) / 1000;
  const sum = await page.evaluate(() => window.keepfall.screen.sum);
  t.ok(sum.won === false && !sum.gaveUp && typeof sum.foeKind === 'string', 'lost summary names the enemy', JSON.stringify(sum));
  t.ok(sum.damageTaken === before.damageTaken + lostDamage && lostDamage > 0, 'lost fight damage is in the summary', `${before.damageTaken} + ${lostDamage} = ${sum.damageTaken}`);
  t.ok(sum.potionsUsed === before.potionsUsed, 'summary potions used', `${sum.potionsUsed}`);
  t.ok(sum.seed === runSeed, 'summary seed equals run.seed', `${sum.seed} ${runSeed}`);
  t.ok(sum.seconds > before.seconds && sum.seconds <= runWallSec + 0.1 && sum.seconds > runWallSec * 0.5, 'summary seconds against wall clock', `${sum.seconds.toFixed(2)} of ${runWallSec.toFixed(2)} s`);
  // The end screen adds no time and shows the numbers.
  await page.waitForTimeout(400);
  t.ok((await page.evaluate(() => window.keepfall.screen.sum.seconds)) === sum.seconds, 'no time added on the end screen');
  const loseText = await drawnText(page);
  t.ok(loseText.includes('You have fallen') && loseText.some((x) => x.includes('got the better of you')), 'lose screen wording', '');
  for (const want of ['Time', 'Potions used', 'Damage taken', 'Gold saved for the shop', `${sum.damageTaken}`, `Run seed ${sum.seed}`]) {
    t.ok(loseText.includes(want), `lose screen shows "${want}"`);
  }

  // Giving up: a new run, ended by the private endRun with the new flag.
  const save0 = await page.evaluate(() => ({ ...window.keepfall.save }));
  await page.evaluate(() => window.keepfall.startRun()); await page.waitForTimeout(500);
  const gold = await page.evaluate(() => window.keepfall.run.knight.gold);
  await page.evaluate(() => window.keepfall.endRun(false, undefined, true)); await page.waitForTimeout(100);
  const g = await page.evaluate(() => ({ sum: window.keepfall.screen.sum, save: window.keepfall.save, run: window.keepfall.run }));
  t.ok(g.sum.gaveUp === true && g.sum.won === false && g.sum.foeKind === undefined && g.sum.foeName === undefined, 'given-up summary has no enemy', JSON.stringify(g.sum));
  t.ok(g.save.runs === save0.runs + 1 && g.save.wins === save0.wins && g.save.gold === gold && g.run === null, 'a given-up run counts as a run and saves gold', JSON.stringify(g.save));
  t.ok(g.sum.seconds > 0.2, 'given-up summary has time', `${g.sum.seconds}`);
  const upText = await drawnText(page);
  t.ok(upText.includes('You turned back') && !upText.includes('You have fallen') && !upText.some((x) => x.includes('got the better')), 'given-up wording and no enemy line', JSON.stringify(upText.slice(0, 3)));

  // Screenshots with realistic numbers.
  if (process.env.SHOTS) {
    const base = { floorNum: 3, level: 6, kills: 14, goldEarned: 96, goldSaved: 131, seconds: 582, potionsUsed: 3, damageTaken: 187, seed: 3735928559 };
    const shots = {
      'end-win.png': { ...base, won: true },
      'end-lose-enemy.png': { ...base, won: false, floorNum: 2, level: 4, kills: 7, goldEarned: 41, goldSaved: 76, seconds: 318, potionsUsed: 2, damageTaken: 104, foeKind: 'lurker', foeName: 'Rafter Lurker' },
      'end-lose-boss.png': { ...base, won: false, seconds: 541, damageTaken: 212, foeKind: 'boss', foeName: 'Mogrum the Ork' },
      'end-gave-up.png': { ...base, won: false, gaveUp: true, floorNum: 2, level: 3, kills: 5, goldEarned: 28, goldSaved: 63, seconds: 204, potionsUsed: 1, damageTaken: 46 },
    };
    for (const [file, s] of Object.entries(shots)) {
      await page.evaluate(async (sum) => { const { EndScreen } = await import('/src/ui/endScreen.ts'); window.keepfall.screen = new EndScreen(window.keepfall, sum); }, s);
      await page.waitForTimeout(150);
      // The "Press Enter" line blinks. Wait until it shows, so the shot has every line.
      await page.waitForFunction(() => Math.sin(window.keepfall.time * 5) > 0.3);
      await page.locator('canvas').screenshot({ path: path_.join(process.env.SHOTS, file) });
      console.log('shot ' + file);
    }
  }

  await browser.close();
  t.done(errors);
})().catch((e) => { console.error(e); process.exit(1); });
