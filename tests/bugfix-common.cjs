// Helpers shared by the tests/bugfix-*.cjs regression tests. Not a test on its own.
// They build on tests/lib.cjs and drive the game through window.keepfall (dev mode only).
// None of them sleep for a fixed time: they wait on game state or on animation frames.

// Starts a run on an open, walled 25 by 17 floor with no stairs, so a test can place the knight
// and its own enemies without the random layout getting in the way.
// opts: { kx, ky, trinkets, knightHp, tryMove, enemies: [{ kind, x, y, hidden, floorNum, stats }] }
// After the module import, everything happens in one synchronous block, so no game frame runs
// between the start of the run and the new layout (a random hidden enemy next to the start can not
// jump out first).
async function arena(page, opts) {
  return page.evaluate(async (o) => {
    const E = await import('/src/entities/enemies.ts');
    const g = window.keepfall;
    g.startRun();
    const map = g.map;
    const f = map.floor;
    for (let y = 0; y < 17; y++) for (let x = 0; x < 25; x++) {
      f.tiles[y * 25 + x] = x === 0 || y === 0 || x === 24 || y === 16 ? 0 : 1;
    }
    f.stairs = null;
    f.enemies = (o.enemies || []).map((e, i) => ({
      id: 9001 + i,
      stats: Object.assign(E.makeEnemyStats(e.kind, e.floorNum || 1), e.stats || {}),
      x: e.x, y: e.y, fromX: e.x, fromY: e.y, moveT: 1,
      hidden: !!e.hidden, patrol: null, wait: 0, dazed: 0,
    }));
    map.x = map.fromX = o.kx;
    map.y = map.fromY = o.ky;
    map.moveT = 1;
    if (o.trinkets) g.run.knight.trinkets = o.trinkets.slice();
    if (o.knightHp !== undefined) g.run.knight.hp = o.knightHp;
    // Optional: call the map's own (private) move function in the same task, before any frame runs.
    if (o.tryMove) map.tryMove(o.tryMove);
    return f.enemies.map((e) => e.id);
  }, opts);
}

// Waits for the next n animation frames in the page, so the game loop has run at least n updates.
async function frames(page, n = 2) {
  await page.evaluate((count) => new Promise((resolve) => {
    let left = count;
    const tick = () => { if (--left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), n);
}

// Waits until the game clock has moved on by `secs` seconds of game time.
async function gameTime(page, secs) {
  const t0 = await page.evaluate(() => window.keepfall.time);
  await page.waitForFunction((t) => window.keepfall.time >= t, t0 + secs, { timeout: 10000 });
}

// One step on the map. lib.cjs step() holds the key for a fixed 40 ms from Node; on a loaded machine a
// frame can take longer than a whole 0.13 s step, so that can give no step or two steps. This sends the
// keydown and keyup inside the page (real KeyboardEvents on window, the same listener and key map the game
// uses) and releases the key in the first animation frame after the step began or a fight started.
// With { blocked: true } the step is expected not to happen: the key is released after 4 game updates.
const KEY_CODES = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD' };
async function walk(page, key, opts = {}) {
  const ok = await page.evaluate(async ([code, blocked]) => {
    const g = window.keepfall;
    const send = (type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    const began = () => { const m = g.map; return !m || g.screen !== m || m.moveT < 1 || !!m.encounter; };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    send('keydown');
    let seen = false;
    for (let i = 0; i < 300 && !seen; i++) { await frame(); seen = blocked ? i >= 3 : began(); }
    send('keyup');
    return seen;
  }, [KEY_CODES[key], !!opts.blocked]);
  if (!ok) throw new Error(`walk ${key}: the step did not begin`);
  await page.waitForFunction(() => { const g = window.keepfall; const m = g.map;
    return !m || g.screen !== m || (m.moveT >= 1 && !m.encounter); }, null, { timeout: 5000 });
}

// Returns true once the named screen is showing, or false after `timeout` ms.
async function waitScreen(page, name, timeout = 5000) {
  return page.waitForFunction((n) => window.keepfall.screen.constructor.name === n, name, { timeout }).then(() => true, () => false);
}

// Runs one test scenario. If it throws (for example a wait that never ends because a fix broke),
// it counts as one FAIL with the error, and the next scenario still runs.
async function section(t, name, fn) {
  try { await fn(); } catch (e) { t.ok(false, `${name}: did not finish`, String(e && e.message || e).split('\n')[0]); }
}

// Plays out the queued battle events without key presses, by moving each event's timer to its end.
// Stops when the battle menu is open, when the fight is over (last event waiting for Enter),
// or when the screen changed. Returns 'menu', 'over' or 'gone' ('none' if no battle is showing).
// It never presses a key, so it can not pick a menu row by accident.
async function drain(page) {
  return page.evaluate(async () => {
    const s = window.keepfall.screen;
    if (!s.battle) return 'none';
    for (let i = 0; i < 2000; i++) {
      if (window.keepfall.screen !== s) return 'gone';
      if (s.inMenu) return 'menu';
      if (s.current && s.queue.length === 0 && s.battle.outcome !== 'ongoing') return 'over';
      if (s.current) s.eventT = 5;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return 'stuck';
  });
}

// Presses a menu key ('1' to '4') and plays out what follows. Only call it while the menu is open.
// A key that is refused (for example Potion at full health) leaves the menu open and adds a log line.
async function choose(page, key) {
  const before = await page.evaluate(() => window.keepfall.screen.log.length);
  await page.keyboard.press(key);
  const moved = await page.waitForFunction((n) => !window.keepfall.screen.inMenu || window.keepfall.screen.log.length > n, before, { timeout: 2000 })
    .then(() => true, () => false);
  if (!moved) return 'ignored'; // the key changed nothing at all
  return drain(page);
}

// Leaves a finished battle with Enter (the menu is closed then, so Enter can not pick an action).
async function leaveBattle(page) {
  const r = await drain(page);
  if (r !== 'over') throw new Error('leaveBattle: battle is not over (' + r + ')');
  await page.evaluate(() => { window.keepfall.screen.eventT = 5; });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.keepfall.screen.constructor.name !== 'BattleScreen', null, { timeout: 3000 });
}

// The game draws text with its own pixel font (src/render/font.ts), not with fillText. In dev mode
// window.keepfallText lists every string drawn in the last frame as { s, color, x, y, w, h }:
// the color it was drawn in and its box in canvas pixels. main.ts empties it at the start of each frame.
// recordText only checks that the hook is there. drawnTexts waits nFrames frames, then reads the last one.
async function recordText(page) {
  const ok = await page.evaluate(() => Array.isArray(window.keepfallText));
  if (!ok) throw new Error('recordText: window.keepfallText is missing (is this a dev server?)');
}

async function drawnTexts(page, nFrames = 3) {
  await frames(page, nFrames);
  return page.evaluate(() => window.keepfallText.map((x) => ({ ...x })));
}

// Starts a fresh list of the sounds played from now on. soundsSince(page) reads it.
// (keepfallSfx.played drops old names past 200, so positions in it are not stable.)
const soundMark = (page) => page.evaluate(() => {
  const sfx = window.keepfallSfx;
  if (!sfx.__kfWrapped) {
    const orig = sfx.play;
    sfx.play = function (name) { if (window.__kfSounds) window.__kfSounds.push(name); return orig.call(this, name); };
    sfx.__kfWrapped = true;
  }
  window.__kfSounds = [];
});
const soundsSince = (page) => page.evaluate(() => window.__kfSounds.slice());

module.exports = { section, walk, arena, frames, gameTime, waitScreen, drain, choose, leaveBattle, recordText, drawnTexts, soundMark, soundsSince };
