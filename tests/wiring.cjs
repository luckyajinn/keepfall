// Checks the places where separate features meet:
// giving up from the pause menu, the run clock while paused, and replaying a run's seed.
// Run it with: PORT=5173 node tests/wiring.cjs
const { open, state, checks } = require('./lib.cjs');

const floorOf = (page) => page.evaluate(() => {
  const f = window.keepfall.map.floor;
  return JSON.stringify({ tiles: Array.from(f.tiles), start: f.start, stairs: f.stairs,
    enemies: f.enemies.map((e) => [e.stats.kind, e.x, e.y, e.hidden, e.patrol && [e.patrol.ax, e.patrol.ay, e.patrol.bx, e.patrol.by]]) });
});
const seconds = (page) => page.evaluate(() => window.keepfall.run.stats.seconds);
const screenName = (page) => page.evaluate(() => window.keepfall.screen.constructor.name);

(async () => {
  const t = checks();
  const allErrors = [];

  // 1. The run clock stops in the pause menu and in help opened from it.
  {
    const { browser, page, errors } = await open(33);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.keepfall.map && window.keepfall.screen === window.keepfall.map);
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'PauseScreen');
    const a = await seconds(page);
    await page.waitForTimeout(1000);
    const b = await seconds(page);
    t.ok(b === a, 'no time is added while paused', `${a.toFixed(2)} -> ${b.toFixed(2)}`);
    await page.keyboard.press('3'); // How to play
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'HelpScreen');
    await page.waitForTimeout(600);
    const c = await seconds(page);
    t.ok(c === a, 'no time is added in help opened from the pause menu', `${c.toFixed(2)}`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'PauseScreen');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.keepfall.screen === window.keepfall.map);
    await page.waitForTimeout(500);
    const d = await seconds(page);
    t.ok(d > a + 0.3, 'the clock runs again after resume', `${d.toFixed(2)}`);

    // 2. Giving up from the pause menu shows the given up end screen, saves gold and counts a run.
    await page.evaluate(() => { window.keepfall.run.knight.gold += 40; });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'PauseScreen');
    await page.evaluate(() => {
      window.__texts = [];
      const proto = CanvasRenderingContext2D.prototype; const orig = proto.fillText;
      proto.fillText = function (str, ...rest) { window.__texts.push(String(str)); return orig.call(this, str, ...rest); };
    });
    await page.keyboard.press('4'); await page.waitForTimeout(80);
    t.ok((await screenName(page)) === 'PauseScreen', 'the first pick of give up only asks again');
    await page.keyboard.press('4');
    await page.waitForFunction(() => window.keepfall.screen.constructor.name === 'EndScreen');
    await page.evaluate(() => { window.__texts = []; }); await page.waitForTimeout(200);
    const end = await page.evaluate(() => ({ sum: window.keepfall.screen.sum, save: window.keepfall.save, texts: window.__texts.join(' | ') }));
    t.ok(end.sum.gaveUp === true && end.sum.won === false && !end.sum.foeKind, 'the summary says the run was given up, with no enemy');
    t.ok(end.texts.includes('You turned back') && !end.texts.includes('You have fallen'), 'the end screen uses the given up wording');
    t.ok(end.save.gold === 40 && end.save.runs === 1 && end.save.wins === 0, 'gold is saved and the run counts, with no win', JSON.stringify({ gold: end.save.gold, runs: end.save.runs, wins: end.save.wins }));
    t.ok(end.texts.includes(`Run seed ${end.sum.seed}`), 'the end screen shows the run seed', String(end.sum.seed));
    allErrors.push(...errors); await browser.close();
  }

  // 3. The first run of a visit uses the address seed, so a shown run seed can be replayed.
  let shown = null; let floorsA = [];
  {
    const { browser, page, errors } = await open(4242);
    await page.evaluate(() => window.keepfall.startRun());
    t.ok((await page.evaluate(() => window.keepfall.run.seed)) === 4242, 'the first run uses the seed from the address');
    await page.evaluate(() => window.keepfall.giveUp());
    await page.evaluate(() => window.keepfall.startRun()); // a second run in the same visit
    shown = await page.evaluate(() => window.keepfall.run.seed);
    t.ok(shown !== 4242 && Number.isInteger(shown) && shown >= 0 && shown <= 0xffffffff, 'a second run in the same visit draws its own seed', String(shown));
    for (let i = 0; i < 3; i++) { floorsA.push(await floorOf(page)); if (i < 2) await page.evaluate(() => { for (let n = 0; n < 7; n++) window.keepfall.rng.next(); window.keepfall.nextFloor(); }); }
    allErrors.push(...errors); await browser.close();
  }
  {
    const { browser, page, errors } = await open(shown);
    await page.evaluate(() => window.keepfall.startRun());
    const floorsB = [];
    for (let i = 0; i < 3; i++) { floorsB.push(await floorOf(page)); if (i < 2) await page.evaluate(() => window.keepfall.nextFloor()); }
    t.ok(floorsB[0] === floorsA[0] && floorsB[1] === floorsA[1] && floorsB[2] === floorsA[2], 'putting a shown run seed in the address gives the same three floors');
    allErrors.push(...errors); await browser.close();
  }

  t.done(allErrors);
})().catch((e) => { console.error(e); process.exit(1); });
