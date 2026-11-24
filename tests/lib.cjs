// Shared helpers for driving KeepFall in headless Chromium.
// Set PORT to the dev server port. Example: PORT=5173 node tests/run.cjs 7
const { chromium } = require('playwright');
const PORT = process.env.PORT || 5173;

// Opens the game with a fixed seed. `extra` is passed to the browser context (for example { hasTouch: true }).
async function open(seed, extra = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=${seed}`);
  await page.waitForFunction(() => window.keepfall);
  return { browser, page, errors };
}

// A snapshot of the game. window.keepfall is the Game object (dev mode only).
const state = (page) => page.evaluate(() => {
  const g = window.keepfall; const name = g.screen.constructor.name; const out = { screen: name };
  if (g.run) { const k = g.run.knight; Object.assign(out, { floor: g.run.floorNum, hp: k.hp, level: k.level, gold: k.gold, potions: k.potions, gear: k.gear, trinkets: k.trinkets }); }
  if (g.map) { const f = g.map.floor; Object.assign(out, { x: g.map.x, y: g.map.y, stairs: f.stairs, tiles: Array.from(f.tiles),
    enemies: f.enemies.map((e) => ({ id: e.id, kind: e.stats.kind, x: e.x, y: e.y, hidden: e.hidden, dazed: e.dazed > 0 })) }); }
  if (name === 'BattleScreen') { const b = g.screen.battle; out.battle = { outcome: b.outcome, charging: b.charging, enraged: b.enraged, enemyHp: b.enemyHp, inMenu: g.screen.inMenu, enemy: b.enemy.name }; }
  return out;
});

const COLS = 25, ROWS = 17;
// Shortest path over floor tiles as a list of w/a/s/d keys. `blocked` is a Set of "x,y" to stay off.
function path(s, tx, ty, blocked) {
  const start = s.y * COLS + s.x, goal = ty * COLS + tx; const prev = new Map([[start, -1]]); const q = [start];
  while (q.length) { const c = q.shift(); if (c === goal) break; const cx = c % COLS, cy = Math.floor(c / COLS);
    for (const [dx, dy, key] of [[1,0,'d'],[-1,0,'a'],[0,1,'s'],[0,-1,'w']]) { const nx = cx + dx, ny = cy + dy, n = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || s.tiles[n] === 0 || prev.has(n)) continue;
      if (n !== goal && blocked.has(`${nx},${ny}`)) continue; prev.set(n, { from: c, key }); q.push(n); } }
  if (!prev.has(goal)) return null; const keys = []; let c = goal;
  while (prev.get(c) !== -1) { keys.unshift(prev.get(c).key); c = prev.get(c).from; } return keys;
}

// One step on the map. Waits until the step (and any encounter intro) is over.
async function step(page, key) {
  await page.keyboard.down(key); await page.waitForTimeout(40); await page.keyboard.up(key);
  await page.waitForFunction(() => { const g = window.keepfall; return !g.map || g.screen !== g.map || (g.map.moveT >= 1 && !g.map.encounter); }, null, { timeout: 5000 });
  return state(page);
}

// Plays a battle to its end: guards heavy blows, drinks a potion when low, else attacks.
// plan.pick(state) can return the menu key to press. plan.onMenu(state) runs before each choice.
async function fight(page, plan = {}) {
  let outcome = 'ongoing';
  for (let i = 0; i < 800; i++) {
    const s = await state(page); if (s.screen !== 'BattleScreen') return outcome; outcome = s.battle.outcome;
    if (s.battle.inMenu) { if (plan.onMenu) await plan.onMenu(s);
      let key = '1'; if (plan.pick) key = plan.pick(s); else if (s.battle.charging) key = '2'; else if (s.potions > 0 && s.hp <= (plan.potionAt || 14)) key = '3';
      await page.keyboard.press(key); } else await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  throw new Error('battle did not end');
}

// A tiny check counter for test files: const t = checks(); t.ok(cond, 'what'); t.done(errors);
function checks() {
  let pass = 0, fail = 0;
  return {
    ok(cond, label, detail = '') { if (cond) pass++; else fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' ' + detail : ''}`); },
    done(errors = []) { if (errors.length) { fail++; console.log('FAIL page errors ' + JSON.stringify(errors)); } console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); },
  };
}

module.exports = { open, state, path, step, fight, checks, PORT };
