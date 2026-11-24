// Checks the pause menu on the map. Usage: PORT=5173 node tests/pause.cjs
const { open, state, fight, checks } = require('./lib.cjs');
const fs = require('fs');
const os = require('os');
const pathJoin = require('path').join;

// Screenshots go to SHOTS, or a temp folder, so a test run leaves nothing in the repo.
const SHOTS = process.env.SHOTS || pathJoin(os.tmpdir(), 'keepfall-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (name) => pathJoin(SHOTS, name);

const COLS = 25;
const VEC = { d: [1, 0], a: [-1, 0], s: [0, 1], w: [0, -1] };
const ACTION = { d: 'right', a: 'left', s: 'down', w: 'up' };

const t = checks();
const allErrors = [];

// Waits for n frames of the game loop.
const frames = (page, n) =>
  page.evaluate((n) => new Promise((done) => { let i = 0; const f = () => (++i >= n ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// Records every screen seen on any frame, so a pause that opened and closed again is still caught.
const watchScreens = (page) =>
  page.evaluate(() => { window.__seen = []; const f = () => { const n = window.keepfall.screen.constructor.name;
    if (window.__seen[window.__seen.length - 1] !== n) window.__seen.push(n); requestAnimationFrame(f); }; requestAnimationFrame(f); });
const seen = (page) => page.evaluate(() => window.__seen.slice());

// The positions of all enemies plus the knight and the run, to compare before and after.
const snapshot = (page) =>
  page.evaluate(() => { const g = window.keepfall; const m = g.map;
    return JSON.stringify({ x: m.x, y: m.y, moveT: m.moveT, age: m.age, enc: !!m.encounter,
      enemies: m.floor.enemies.map((e) => [e.id, e.x, e.y, e.moveT, e.wait, e.dazed, e.hidden, e.patrol && e.patrol.toB]),
      run: { ...g.run, knight: g.run.knight } }); });

const patrols = (page) => page.evaluate(() => window.keepfall.map.floor.enemies.filter((e) => e.patrol).map((e) => `${e.x},${e.y}`).join(' '));
const sfxCount = (page, name) => page.evaluate((n) => window.keepfallSfx.played.filter((p) => p === n).length, name);
const pauseIndex = (page) => page.evaluate(() => window.keepfall.screen.state.index);
const confirming = (page) => page.evaluate(() => window.keepfall.screen.confirming);

// A direction whose next tile is open floor, holds no enemy and is not next to a hidden one.
function freeDir(s) {
  for (const k of ['d', 'a', 's', 'w']) {
    const nx = s.x + VEC[k][0], ny = s.y + VEC[k][1];
    if (s.tiles[ny * COLS + nx] !== 1) continue;
    if (s.enemies.some((e) => (e.x === nx && e.y === ny) || (e.hidden && Math.abs(e.x - nx) + Math.abs(e.y - ny) <= 1))) continue;
    return k;
  }
  return null;
}

// Starts a run and starts recording the screens seen.
async function startRun(seed) {
  const o = await open(seed);
  allErrors.push(o.errors);
  await o.page.keyboard.press('Enter');
  await o.page.waitForFunction(() => window.keepfall.screen === window.keepfall.map);
  await watchScreens(o.page);
  return o;
}

// Opens the pause from a standing knight. Returns the screen name.
async function pause(page) {
  await page.keyboard.press('Escape');
  await frames(page, 2);
  return (await state(page)).screen;
}

(async () => {
  // 1. Opening, freezing and resuming.
  {
    const { browser, page } = await startRun(7);
    await page.evaluate(() => { window.__map = window.keepfall.map; });
    t.ok((await pause(page)) === 'PauseScreen', 'Escape on the map opens the pause');
    t.ok(await page.evaluate(() => window.keepfall.map === window.__map && window.keepfall.screen.map === window.__map), 'the pause holds the run map');
    const before = await snapshot(page);
    const sfxBefore = await page.evaluate(() => window.keepfallSfx.played.length);
    await page.keyboard.down('d');
    await page.waitForTimeout(2000);
    t.ok((await snapshot(page)) === before, 'nothing moves in 2 seconds of pause, with D held');
    await page.keyboard.up('d');
    t.ok((await page.evaluate(() => window.keepfallSfx.played.length)) === sfxBefore, 'no sound played while paused');
    t.ok((await state(page)).screen === 'PauseScreen', 'still paused after 2 seconds');

    const { x, y } = await state(page);
    await page.keyboard.press('Escape');
    await frames(page, 3);
    let s = await state(page);
    t.ok(s.screen === 'MapScreen' && (await page.evaluate(() => window.keepfall.screen === window.__map)), 'Escape resumes to the same map');
    t.ok(s.x === x && s.y === y, 'the knight is where it was after Escape');
    await page.waitForTimeout(300);
    s = await state(page);
    t.ok(s.screen === 'MapScreen' && s.x === x && s.y === y, 'the Escape that closed the menu did nothing else');

    t.ok((await pause(page)) === 'PauseScreen', 'the pause opens again');
    t.ok((await pauseIndex(page)) === 0, 'a new pause starts on Resume');
    await page.keyboard.press('Enter');
    await frames(page, 3);
    s = await state(page);
    t.ok(s.screen === 'MapScreen' && (await page.evaluate(() => window.keepfall.screen === window.__map)) && s.x === x && s.y === y, 'Resume returns to the same map with the knight in place');
    await page.waitForTimeout(300);
    s = await state(page);
    t.ok(s.screen === 'MapScreen' && s.x === x && s.y === y, 'the Enter that picked Resume did nothing else');

    // Sample often, since a short patrol can be back on the same tile a second later.
    const seenPatrols = new Set();
    for (let i = 0; i < 15; i++) { seenPatrols.add(await patrols(page)); await page.waitForTimeout(100); }
    t.ok(seenPatrols.size > 1 || (await page.evaluate(() => !!window.keepfall.map.encounter || window.keepfall.screen !== window.keepfall.map)), 'patrols move again after resume', [...seenPatrols].join(' | '));

    // A held direction may move the knight after resume.
    await page.evaluate(() => { const m = window.keepfall.map; m.floor.enemies = m.floor.enemies.filter((e) => !e.patrol); });
    s = await state(page);
    const k = freeDir(s);
    t.ok((await pause(page)) === 'PauseScreen', 'paused again before holding a direction');
    await page.keyboard.down(k);
    await page.waitForTimeout(200);
    t.ok(((await state(page)).x === s.x) && ((await state(page)).y === s.y), 'a held direction does not move the knight while paused');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.keyboard.up(k);
    await page.waitForFunction(() => window.keepfall.map.moveT >= 1);
    const a = await state(page);
    t.ok(a.x === s.x + VEC[k][0] && a.y === s.y + VEC[k][1], 'a direction still held after resume moves the knight', `${k}: ${s.x},${s.y} -> ${a.x},${a.y}`);
    t.ok(!(await seen(page)).includes('BattleScreen'), 'no fight started in this part');
    await browser.close();
  }

  // 2. Sound row, How to play and Give up.
  {
    const { browser, page } = await startRun(7);
    await page.evaluate(() => { const m = window.keepfall.map; m.floor.enemies = m.floor.enemies.filter((e) => !e.patrol); });
    await pause(page);
    await page.keyboard.press('s');
    const muted0 = await page.evaluate(() => window.keepfallSfx.muted);
    await page.keyboard.press('Enter');
    await frames(page, 2);
    const muted1 = await page.evaluate(() => window.keepfallSfx.muted);
    t.ok(muted1 === !muted0 && (await state(page)).screen === 'PauseScreen', 'the sound row toggles mute and stays paused', `${muted0} -> ${muted1}`);
    t.ok((await page.evaluate(() => localStorage.getItem('keepfall.muted'))) === (muted1 ? '1' : '0'), 'the mute choice is saved');
    await page.screenshot({ path: shot('pause-sound-off.png') });
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok((await page.evaluate(() => window.keepfallSfx.muted)) === muted0, 'the sound row toggles back');

    const before = await snapshot(page);
    await page.evaluate(() => { window.__pause = window.keepfall.screen; });
    await page.keyboard.press('s');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok((await state(page)).screen === 'HelpScreen', 'How to play opens the help screen');
    await page.screenshot({ path: shot('pause-help.png') });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok(await page.evaluate(() => window.keepfall.screen === window.__pause), 'Enter on help returns to the same pause');
    t.ok((await pauseIndex(page)) === 2, 'the pause still has How to play selected');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    await page.keyboard.press('Escape');
    await frames(page, 2);
    t.ok(await page.evaluate(() => window.keepfall.screen === window.__pause), 'Escape on help returns to the pause');
    t.ok((await snapshot(page)) === before, 'the run is untouched after the help screen');

    // Give up needs two picks, and moving away cancels the first.
    await page.keyboard.press('s');
    await frames(page, 2);
    t.ok((await pauseIndex(page)) === 3 && !(await confirming(page)), 'on the give up row, not yet asked');
    const deny0 = await sfxCount(page, 'deny');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok((await state(page)).screen === 'PauseScreen' && (await confirming(page)), 'the first pick only asks again');
    t.ok((await sfxCount(page, 'deny')) === deny0 + 1, 'the first pick plays the deny sound');
    await page.screenshot({ path: shot('pause-give-up.png') });
    await page.keyboard.press('w');
    await frames(page, 2);
    t.ok(!(await confirming(page)), 'moving away cancels the first pick');
    await page.keyboard.press('s');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok((await confirming(page)), 'asked again after coming back');
    await page.keyboard.press('Escape');
    await frames(page, 2);
    t.ok((await state(page)).screen === 'MapScreen', 'Escape resumes from the asking state');
    await pause(page);
    await page.keyboard.press('w');
    await frames(page, 2);
    t.ok((await pauseIndex(page)) === 3 && !(await confirming(page)), 'resuming cancelled the first pick');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    await page.evaluate(() => { window.keepfall.run.knight.gold += 23; });
    const save0 = await page.evaluate(() => ({ ...window.keepfall.save, gold: window.keepfall.run.knight.gold }));
    await page.keyboard.press('Enter');
    await frames(page, 2);
    const end = await page.evaluate(() => { const g = window.keepfall; return { screen: g.screen.constructor.name, run: g.run, map: g.map, sum: g.screen.sum,
      save: g.save, stored: JSON.parse(localStorage.getItem('keepfall.save.v1')) }; });
    t.ok(end.screen === 'EndScreen' && end.run === null && end.map === null, 'the second pick ends the run');
    t.ok(end.sum && end.sum.won === false, 'the run counts as lost');
    t.ok(end.save.runs === save0.runs + 1 && end.stored.runs === save0.runs + 1, 'save.runs went up by one', `${save0.runs} -> ${end.stored.runs}`);
    t.ok(end.save.wins === save0.wins && end.stored.wins === save0.wins, 'no win counted');
    t.ok(end.stored.gold === save0.gold, 'the gold in hand is saved', `${end.stored.gold}`);
    await browser.close();
  }

  // 3. The title's How to play still goes back to the title.
  {
    const o = await open(7);
    allErrors.push(o.errors);
    const page = o.page;
    await page.keyboard.press('s');
    await page.keyboard.press('s');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok((await state(page)).screen === 'HelpScreen', 'the title opens How to play');
    await page.screenshot({ path: shot('title-help.png') });
    await page.keyboard.press('Enter');
    await frames(page, 2);
    t.ok((await state(page)).screen === 'StartScreen', 'Enter on help goes back to the title');
    await page.keyboard.press('s');
    await page.keyboard.press('s');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    await page.keyboard.press('Escape');
    await frames(page, 2);
    t.ok((await state(page)).screen === 'StartScreen', 'Escape on help goes back to the title');
    await o.browser.close();
  }

  // 4. Escape during a step, during an intro, in battle, on the reward screen and at the vendor.
  {
    const { browser, page } = await startRun(7);
    await page.evaluate(() => { const m = window.keepfall.map; m.floor.enemies = m.floor.enemies.filter((e) => !e.patrol); });
    let s = await state(page);
    let k = freeDir(s);
    // Press a direction, then Escape while the step is going. Done inside the page so the timing is exact.
    const mid = await page.evaluate((act) => new Promise((done) => { const g = window.keepfall; g.input.press(act);
      requestAnimationFrame(() => requestAnimationFrame(() => { g.input.release(act); const m = g.map; const moveT = m.moveT; g.input.press('cancel');
        requestAnimationFrame(() => requestAnimationFrame(() => done({ moveT, screen: g.screen.constructor.name }))); })); }), ACTION[k]);
    t.ok(mid.moveT > 0 && mid.moveT < 1, 'Escape was pressed in the middle of a step', `moveT ${mid.moveT.toFixed(2)}`);
    t.ok(mid.screen === 'MapScreen', 'the pause does not open in the middle of a step');
    await page.waitForFunction(() => window.keepfall.screen !== window.keepfall.map);
    let a = await state(page);
    t.ok(a.screen === 'PauseScreen' && a.x === s.x + VEC[k][0] && a.y === s.y + VEC[k][1] && (await page.evaluate(() => window.keepfall.map.moveT)) === 1, 'it opens once the step ends, with the knight on the new tile');
    await page.keyboard.press('Escape');
    await frames(page, 3);

    // A step that lands next to a hidden enemy: the ambush wins and the Escape is dropped.
    s = await state(page);
    k = null;
    for (const key of ['d', 'a', 's', 'w']) {
      const nx = s.x + VEC[key][0], ny = s.y + VEC[key][1], hx = nx + VEC[key][0], hy = ny + VEC[key][1];
      if (s.tiles[ny * COLS + nx] === 1 && s.tiles[hy * COLS + hx] === 1 && !s.enemies.some((e) => (e.x === nx && e.y === ny) || (e.x === hx && e.y === hy))) { k = key; break; }
    }
    await page.evaluate(({ hx, hy }) => { const m = window.keepfall.map; const e = m.floor.enemies.find((o) => o.hidden);
      for (const o of m.floor.enemies) if (o !== e && o.hidden) o.hidden = false;
      e.x = e.fromX = hx; e.y = e.fromY = hy; }, { hx: s.x + 2 * VEC[k][0], hy: s.y + 2 * VEC[k][1] });
    await watchScreens(page);
    const amb0 = await sfxCount(page, 'ambush');
    await page.evaluate((act) => new Promise((done) => { const g = window.keepfall; g.input.press(act);
      requestAnimationFrame(() => requestAnimationFrame(() => { g.input.release(act); g.input.press('cancel'); done(); })); }), ACTION[k]);
    await page.waitForFunction(() => window.keepfall.map.encounter || window.keepfall.screen !== window.keepfall.map);
    // Escape again during the intro.
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); }
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'BattleScreen', null, { timeout: 5000 });
    t.ok((await page.evaluate(() => window.keepfall.screen.battle.ambush)) && (await sfxCount(page, 'ambush')) === amb0 + 1, 'a step next to a hidden enemy still ambushes once');
    t.ok(!(await seen(page)).includes('PauseScreen'), 'no pause opened during the step, the intro or the ambush', JSON.stringify(await seen(page)));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    t.ok((await state(page)).screen === 'BattleScreen', 'Escape in a battle does not open the pause');
    await page.evaluate(() => { window.keepfall.run.knight.hp = 999; });
    const out = await fight(page);
    await page.waitForTimeout(500);
    t.ok((await state(page)).screen === 'MapScreen' && !(await seen(page)).includes('PauseScreen'), 'no pause opens after the battle', `${out} ${JSON.stringify(await seen(page))}`);

    // Escape during an intro from walking into a visible enemy.
    s = await state(page);
    await watchScreens(page);
    await page.evaluate(() => { const m = window.keepfall.map; const e = m.floor.enemies.find((o) => !o.hidden); m.startEncounter(e, false); });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'BattleScreen', null, { timeout: 5000 });
    await fight(page);
    await page.waitForTimeout(500);
    t.ok(!(await seen(page)).includes('PauseScreen') && (await state(page)).screen === 'MapScreen', 'Escape during an intro is dropped and opens nothing later', JSON.stringify(await seen(page)));

    // Reward screen and vendor.
    await page.evaluate(() => window.keepfall.floorCleared());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    t.ok((await state(page)).screen === 'RewardScreen', 'Escape on the reward screen does not open the pause');
    await page.keyboard.press('Enter');
    await frames(page, 2);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    t.ok((await state(page)).screen === 'VendorScreen', 'Escape at the vendor does not open the pause');
    await watchScreens(page);
    await page.evaluate(() => window.keepfall.nextFloor());
    await page.waitForTimeout(500);
    a = await state(page);
    t.ok(a.screen === 'MapScreen' && a.floor === 2 && !(await seen(page)).includes('PauseScreen'), 'no pause carried over to the next floor');
    t.ok((await pause(page)) === 'PauseScreen', 'the pause opens on floor 2');
    await browser.close();
  }

  // 5. A hidden enemy moved next to the knight while paused ambushes after resume, once.
  {
    const { browser, page } = await startRun(7);
    await page.evaluate(() => { const m = window.keepfall.map; m.floor.enemies = m.floor.enemies.filter((e) => !e.patrol); });
    t.ok((await pause(page)) === 'PauseScreen', 'paused before the ambush check');
    const s = await state(page);
    const k = freeDir(s);
    await page.evaluate(({ hx, hy }) => { const m = window.keepfall.map; const e = m.floor.enemies.find((o) => o.hidden);
      for (const o of m.floor.enemies) if (o !== e && o.hidden) o.hidden = false;
      e.x = e.fromX = hx; e.y = e.fromY = hy; }, { hx: s.x + VEC[k][0], hy: s.y + VEC[k][1] });
    const amb0 = await sfxCount(page, 'ambush');
    await page.waitForTimeout(500);
    t.ok((await state(page)).screen === 'PauseScreen' && (await sfxCount(page, 'ambush')) === amb0, 'no ambush while paused');
    await page.screenshot({ path: shot('pause-menu.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'BattleScreen', null, { timeout: 5000 });
    t.ok((await sfxCount(page, 'ambush')) === amb0 + 1 && (await page.evaluate(() => window.keepfall.screen.battle.ambush)), 'the ambush fires after resume');
    await page.evaluate(() => { window.keepfall.run.knight.hp = 999; });
    await fight(page);
    await page.waitForTimeout(800);
    t.ok((await state(page)).screen === 'MapScreen' && (await sfxCount(page, 'ambush')) === amb0 + 1, 'the ambush fired exactly once');
    await browser.close();
  }

  t.done(allErrors.flat());
})().catch((e) => { console.error(e); process.exit(1); });
