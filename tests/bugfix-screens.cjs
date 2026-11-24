// Regression tests for three fixes from PLAN.md "Bugs found and fixed":
//   7. Sound unlocks on the first key press, click or tap, including a tap on a touch only device.
//   8. The lose screen knows the enemy that beat the knight (keepfall.screen.sum.foeKind and foeName).
//   9. The title screen shows "Best floor N" only once bestFloor is above 0, and loadSave only accepts
//      a stored save with version 1.
// Text on the title screen is read by wrapping fillText, not by pixel position, since the menu is changing.
// The end screen is checked through its summary fields, not its layout, for the same reason.
// Run with the dev server up: PORT=5173 node tests/bugfix-screens.cjs
const { open, checks } = require('./lib.cjs');
const { section, arena, waitScreen, drain, choose, leaveBattle, recordText, drawnTexts, frames } = require('./bugfix-common.cjs');

const KEY = 'keepfall.save.v1';
const audioCtx = (page) => page.evaluate(() => { const c = window.keepfallSfx.ctx; return c ? c.constructor.name : null; });

(async () => {
  const t = checks();
  const allErrors = [];

  // ---------- 7. Sound unlock ----------
  // Headless Chromium does not enforce the browser rule that sound may only start after the player
  // touches the page, so these checks only prove the wiring: the right event creates the audio context.
  // They can not prove that a real phone lets the sound play.
  await section(t, 'sound on a touch device', async () => {
    const { browser, page, errors } = await open(41, { hasTouch: true });
    try {
      await frames(page, 5);
      t.ok(await audioCtx(page) === null, 'touch device: no audio context before any input');
      // Count calls to sfx.unlock and note which input events reached the page.
      await page.evaluate(() => {
        const sfx = window.keepfallSfx; window.__kfUnlocks = 0; window.__kfEvents = [];
        const orig = sfx.unlock; sfx.unlock = function () { window.__kfUnlocks++; return orig.call(this); };
        for (const n of ['keydown', 'pointerdown', 'pointerup', 'touchend']) window.addEventListener(n, (e) => window.__kfEvents.push(e.type + (e.pointerType ? ':' + e.pointerType : '')));
      });
      await page.touchscreen.tap(400, 300);
      await page.waitForFunction(() => window.keepfallSfx.ctx !== null, null, { timeout: 3000 }).catch(() => {});
      t.ok(await audioCtx(page) !== null, 'touch device: a tap with no key press creates the audio context', String(await audioCtx(page)));
      const tap = await page.evaluate(() => ({ unlocks: window.__kfUnlocks, events: window.__kfEvents.slice() }));
      // On a phone only the lift of the finger counts, so the unlock must run again then, not only on touch down.
      t.ok(tap.unlocks >= 2, 'touch device: the unlock runs on touch down and again when the finger lifts', JSON.stringify(tap));
      await page.keyboard.press('Shift');
      await frames(page, 2);
      const later = await page.evaluate(() => window.__kfUnlocks);
      t.ok(later === tap.unlocks, 'after the tap counted, the unlock listeners are gone (a key press does not call it again)', `${tap.unlocks} then ${later}`);
      t.ok(await page.evaluate(() => window.keepfall.screen.constructor.name) === 'StartScreen', 'the tap did not act as a key press on the title screen');
    } finally {
      allErrors.push(...errors);
      await browser.close();
    }
  });
  await section(t, 'sound on a key press', async () => {
    const { browser, page, errors } = await open(42);
    try {
      await frames(page, 5);
      t.ok(await audioCtx(page) === null, 'keyboard: no audio context before any input');
      await page.keyboard.press('Shift'); // a key the game does not use, so nothing else happens
      await page.waitForFunction(() => window.keepfallSfx.ctx !== null, null, { timeout: 3000 }).catch(() => {});
      t.ok(await audioCtx(page) !== null, 'keyboard: a key press creates the audio context', String(await audioCtx(page)));
    } finally {
      allErrors.push(...errors);
      await browser.close();
    }
  });

  const { browser, page, errors } = await open(43);

  // ---------- 8. Lose screen summary ----------
  // The knight is left with 1 health and guards. Any hit takes at least 1, so the enemy wins the turn.
  async function loseTo(setup) {
    await page.evaluate(setup);
    await waitScreen(page, 'BattleScreen');
    const r = await drain(page);
    if (r === 'menu') await choose(page, '2');
    await leaveBattle(page);
    await waitScreen(page, 'EndScreen');
    return page.evaluate(() => window.keepfall.screen.sum);
  }
  await section(t, 'lose to a visible hound', async () => {
    await arena(page, { kx: 5, ky: 5, knightHp: 1, enemies: [{ kind: 'hound', x: 6, y: 5 }] });
    const sum = await loseTo(() => { const g = window.keepfall; g.startBattle(g.map.floor.enemies[0], false); });
    const hound = await page.evaluate(async () => (await import('/src/entities/enemies.ts')).makeEnemyStats('hound', 1));
    t.ok(sum.won === false && sum.foeKind === 'hound' && sum.foeName === hound.name, 'lost to a Gate Hound: the summary names it', JSON.stringify(sum));
  });
  await section(t, 'lose to an ambushing lurker', async () => {
    // A hidden one that ambushes, to cover the other way into a fight.
    await arena(page, { kx: 5, ky: 5, knightHp: 1, enemies: [{ kind: 'lurker', x: 6, y: 5, hidden: true }] });
    const sum = await loseTo(() => {});
    t.ok(sum.won === false && sum.foeKind === 'lurker' && /Lurker/.test(sum.foeName || ''), 'lost to an ambushing Rafter Lurker: the summary names it', JSON.stringify(sum));
  });
  await section(t, 'lose to the boss', async () => {
    // The boss, on the real floor 3.
    const bossName = await page.evaluate(async () => (await import('/src/entities/enemies.ts')).makeEnemyStats('boss', 3).name);
    const sum = await loseTo(() => { const g = window.keepfall; g.startRun(); g.nextFloor(); g.nextFloor(); g.run.knight.hp = 1;
      g.startBattle(g.map.floor.enemies.find((e) => e.stats.boss), false); });
    t.ok(sum.won === false && sum.foeKind === 'boss' && sum.foeName === bossName && sum.floorNum === 3, 'lost to the boss: the summary names the boss', JSON.stringify(sum));
  });
  await section(t, 'win against the boss', async () => {
    // A win: the boss is left with 1 health and the knight attacks first.
    await page.evaluate(() => { const g = window.keepfall; g.startRun(); g.nextFloor(); g.nextFloor();
      g.startBattle(g.map.floor.enemies.find((e) => e.stats.boss), false); });
    await waitScreen(page, 'BattleScreen');
    await drain(page);
    await page.evaluate(() => { window.keepfall.screen.battle.enemyHp = 1; });
    await choose(page, '1');
    await leaveBattle(page);
    await waitScreen(page, 'EndScreen');
    const sum = await page.evaluate(() => window.keepfall.screen.sum);
    t.ok(sum.won === true && sum.foeKind === undefined && sum.foeName === undefined, 'a win has no foeKind and no foeName', JSON.stringify(sum));
  });

  // ---------- 9. Best floor on the title screen ----------
  await section(t, 'best floor on the title', async () => {
    const titleTexts = async () => { await waitScreen(page, 'StartScreen'); await recordText(page); return [...new Set((await drawnTexts(page)).map((x) => x.s))]; };
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    await page.reload(); await page.waitForFunction(() => window.keepfall);
    let texts = await titleTexts();
    t.ok(texts.some((s) => /Runs 0/.test(s)), 'title screen draws the runs line (so the text record works)');
    t.ok(!texts.some((s) => /Best floor/.test(s)), 'with no save, the title screen shows no "Best floor"', JSON.stringify(texts.filter((s) => /Runs/.test(s))));
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, gold: 7, runs: 3, wins: 0, bestFloor: 0, upgrades: {} })), KEY);
    await page.reload(); await page.waitForFunction(() => window.keepfall);
    texts = await titleTexts();
    t.ok(texts.some((s) => /Runs 3/.test(s)) && !texts.some((s) => /Best floor/.test(s)), 'with bestFloor 0 in the save, no "Best floor"');
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, gold: 7, runs: 3, wins: 0, bestFloor: 2, upgrades: {} })), KEY);
    await page.reload(); await page.waitForFunction(() => window.keepfall);
    texts = await titleTexts();
    t.ok(texts.some((s) => /Best floor 2\b/.test(s)), 'with bestFloor 2 in the save, the title screen shows "Best floor 2"', JSON.stringify(texts.filter((s) => /Runs/.test(s))));
    // After a run that reaches floor 3, the title updates without a reload.
    await page.evaluate(() => { window.keepfall.save.bestFloor = 3; });
    texts = await titleTexts();
    t.ok(texts.some((s) => /Best floor 3\b/.test(s)), 'the title screen follows save.bestFloor', JSON.stringify(texts.filter((s) => /Runs/.test(s))));
  });

  // ---------- 9. loadSave and the save version ----------
  const cases = await page.evaluate(async (k) => {
    const S = await import('/src/meta/save.ts');
    const empty = JSON.stringify(S.emptySave());
    const good = { version: 1, gold: 50, runs: 4, wins: 1, bestFloor: 2, upgrades: { vigor: 1, might: 2, belt: 0, sword: 1, shield: 0, armor: 3 } };
    const raw = {
      'version 1': JSON.stringify(good),
      'version 2': JSON.stringify({ ...good, version: 2 }),
      'version "1" as text': JSON.stringify({ ...good, version: '1' }),
      'no version': JSON.stringify({ ...good, version: undefined }),
      'broken JSON': '{"version": 1, "gold": 5',
      'JSON null': 'null',
      'nothing stored': null,
    };
    const out = {};
    for (const [name, value] of Object.entries(raw)) {
      if (value === null) localStorage.removeItem(k); else localStorage.setItem(k, value);
      try { const s = S.loadSave(); out[name] = { empty: JSON.stringify(s) === empty, save: s }; }
      catch (e) { out[name] = { threw: String(e) }; }
    }
    return { out, good };
  }, KEY);
  const g = cases.out['version 1'];
  t.ok(g.save && g.save.version === 1 && g.save.gold === 50 && g.save.bestFloor === 2 && g.save.runs === 4 && g.save.upgrades.armor === 3,
    'loadSave keeps a stored save with version 1', JSON.stringify(g.save));
  for (const name of ['version 2', 'version "1" as text', 'no version', 'broken JSON', 'JSON null', 'nothing stored']) {
    t.ok(cases.out[name].empty === true, `loadSave gives an empty save for ${name}`, JSON.stringify(cases.out[name]));
  }
  // The game itself, loading each bad save at start up, with no page error.
  for (const [name, value] of [['version 2', JSON.stringify({ ...cases.good, version: 2 })], ['broken JSON', '{"version": 1, "gold"'], ['JSON null', 'null']]) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value]);
    await page.reload(); await page.waitForFunction(() => window.keepfall);
    await frames(page, 3);
    const s = await page.evaluate(() => ({ gold: window.keepfall.save.gold, runs: window.keepfall.save.runs, screen: window.keepfall.screen.constructor.name }));
    t.ok(s.gold === 0 && s.runs === 0 && s.screen === 'StartScreen', `the game starts with an empty save from ${name}`, JSON.stringify(s));
  }
  await page.evaluate((k) => localStorage.removeItem(k), KEY);

  allErrors.push(...errors);
  await browser.close();
  t.done(allErrors);
})().catch((e) => { console.error(e); process.exit(1); });
