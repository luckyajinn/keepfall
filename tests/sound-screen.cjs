// Checks the sound check screen and the volume setting. Usage: PORT=5173 node tests/sound-screen.cjs
// Set SHOTS to a folder to also save screenshots of the title and sound screens.
const path = require('path');
const { open, state, checks } = require('./lib.cjs');
const SHOTS = process.env.SHOTS;

const t = checks();

async function key(page, k, n = 1) {
  for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(40); }
}
const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }) : null);
// The sound screen's list state, the stored volume and the live gain.
const snd = (page) => page.evaluate(() => {
  const g = window.keepfall; const s = window.keepfallSfx;
  const st = g.screen.state || {};
  return { screen: g.screen.constructor.name, index: st.index, top: st.top, shown: g.screen.shown, volume: s.volume, muted: s.muted,
    stored: localStorage.getItem('keepfall.volume'), gain: s.master ? s.master.gain.value : null, last: s.played[s.played.length - 1] };
});
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-6;

(async () => {
  const allErrors = [];
  let { browser, page, errors } = await open(1);
  // A full save, so the title screen shows its widest lines.
  await page.evaluate(() => localStorage.setItem('keepfall.save.v1', JSON.stringify({ version: 1, gold: 12345, upgrades: {}, runs: 99, wins: 99, bestFloor: 3 })));
  await page.reload(); await page.waitForFunction(() => window.keepfall); await page.waitForTimeout(200);
  await shot(page, 'title.png');

  // The sound list, read from the game's own module.
  const names = await page.evaluate(async () => { const m = await import('/src/audio/sfx.ts'); return { list: [...m.SFX_NAMES], same: m.sfx === window.keepfallSfx, def: m.DEFAULT_VOLUME }; });
  t.ok(names.same, 'the imported sound module is the one the game uses');
  t.ok(names.list.length === 20 && new Set(names.list).size === 20, 'SFX_NAMES has 20 different names', JSON.stringify(names.list));
  t.ok(names.def === 1, 'the default volume is 1');

  // Title menu: the 4th row is Sound.
  await key(page, 's', 3);
  t.ok((await page.evaluate(() => window.keepfall.screen.state.index)) === 3, 'the title menu has a 4th row');
  await key(page, 'Enter');
  let s = await snd(page);
  t.ok(s.screen === 'SoundScreen', 'the Sound row opens the sound screen', s.screen);
  t.ok(s.index === 0 && s.top === 0 && s.shown > 0 && s.shown < 21, 'the list starts at the top', JSON.stringify(s));
  t.ok(near(s.volume, 1) && near(s.gain, 0.35), 'volume 1 gives the old master gain of 0.35', `volume ${s.volume} gain ${s.gain}`);
  await shot(page, 'sound-top.png');

  // Play every sound, moving down the list one row at a time.
  let allPlayed = true; let allVisible = true;
  for (let i = 0; i < names.list.length; i++) {
    s = await snd(page);
    if (s.index !== i) { allPlayed = false; console.log(`  row ${i}: index is ${s.index}`); }
    if (!(s.index >= s.top && s.index < s.top + s.shown)) { allVisible = false; console.log(`  row ${i} not shown, top ${s.top}`); }
    await key(page, 'Enter');
    s = await snd(page);
    if (s.last !== names.list[i]) { allPlayed = false; console.log(`  row ${i}: played ${s.last}, wanted ${names.list[i]}`); }
    if (i === 10) await shot(page, 'sound-middle.png');
    await key(page, 's');
  }
  t.ok(allPlayed, 'Enter on each row plays that sound and played ends with its name');
  s = await snd(page);
  t.ok(s.index === 20 && s.index >= s.top && s.index < s.top + s.shown && s.top === 21 - s.shown, 'the Back row is last and on screen', JSON.stringify(s));
  await shot(page, 'sound-bottom.png');
  // Down from Back wraps to the top. Up from the top wraps to Back.
  await key(page, 's'); s = await snd(page);
  t.ok(s.index === 0 && s.top === 0, 'down from Back goes to the first row and scrolls up', JSON.stringify(s));
  await key(page, 'w'); s = await snd(page);
  t.ok(s.index === 20 && s.top === 21 - s.shown, 'up from the first row goes to Back and scrolls down', JSON.stringify(s));
  for (let i = 0; i < 21; i++) {
    await key(page, 'w'); s = await snd(page);
    if (!(s.index >= s.top && s.index < s.top + s.shown && s.top >= 0 && s.top <= 21 - s.shown)) { allVisible = false; console.log(`  up: ${JSON.stringify(s)}`); }
  }
  t.ok(allVisible, 'the selected row stays on screen moving down and up through the whole list');

  // Volume down to 0 and up to 1, with clamping, storage and the live gain.
  await key(page, 'a'); s = await snd(page);
  t.ok(near(s.volume, 0.9) && s.stored === '0.9' && near(s.gain, 0.35 * 0.9) && s.last === 'pick', 'A lowers the volume one step, saves it, changes the gain and plays a sound', JSON.stringify(s));
  await key(page, 'a', 12); s = await snd(page);
  t.ok(s.volume === 0 && s.stored === '0' && s.gain === 0 && s.last === 'deny', 'the volume stops at 0', JSON.stringify(s));
  await shot(page, 'sound-volume0.png');
  await key(page, 'd'); s = await snd(page);
  t.ok(near(s.volume, 0.1) && s.stored === '0.1' && s.last === 'pick', 'D raises the volume one step', JSON.stringify(s));
  await key(page, 'd', 12); s = await snd(page);
  t.ok(s.volume === 1 && s.stored === '1' && near(s.gain, 0.35) && s.last === 'deny', 'the volume stops at 1', JSON.stringify(s));
  await key(page, 'a', 3); s = await snd(page);
  t.ok(s.volume === 0.7 && s.stored === '0.7' && near(s.gain, 0.35 * 0.7), 'three steps down gives 0.7', JSON.stringify(s));

  // Mute on this screen.
  await key(page, 'm'); s = await snd(page);
  t.ok(s.screen === 'SoundScreen' && s.muted && s.volume === 0.7 && s.stored === '0.7', 'M mutes on the sound screen and keeps the volume', JSON.stringify(s));
  t.ok((await page.evaluate(() => localStorage.getItem('keepfall.muted'))) === '1', 'the mute is saved');
  await shot(page, 'sound-muted.png');
  await key(page, 'a'); s = await snd(page);
  t.ok(s.volume === 0.6 && s.stored === '0.6' && s.muted, 'the volume can still be changed while muted', JSON.stringify(s));
  await key(page, 'd'); await key(page, 'm'); s = await snd(page);
  t.ok(!s.muted && s.volume === 0.7 && s.stored === '0.7' && near(s.gain, 0.35 * 0.7), 'M turns sound back on at the same volume', JSON.stringify(s));

  // Escape goes back to the title.
  await key(page, 'Escape'); s = await snd(page);
  t.ok(s.screen === 'StartScreen', 'Escape returns to the title', s.screen);

  // The volume survives a reload, and the gain starts at it.
  await page.reload(); await page.waitForFunction(() => window.keepfall); await page.waitForTimeout(100);
  s = await snd(page);
  t.ok(s.volume === 0.7, 'the volume survives a reload', String(s.volume));
  await key(page, '4'); s = await snd(page);
  t.ok(s.screen === 'SoundScreen' && near(s.gain, 0.35 * 0.7), 'after a reload the gain starts at the saved volume', JSON.stringify(s));
  // The Back row returns to the title too.
  await key(page, 'w'); await key(page, 'Enter'); s = await snd(page);
  t.ok(s.screen === 'StartScreen', 'the Back row returns to the title', s.screen);

  // Bad stored values fall back to the default. Good ones are kept, rounded to a step.
  for (const [raw, want] of [['abc', 1], ['5', 1], ['-0.1', 1], ['', 1], ['NaN', 1], ['Infinity', 1], ['0.75', 0.8], ['0', 0]]) {
    await page.evaluate((v) => localStorage.setItem('keepfall.volume', v), raw);
    await page.reload(); await page.waitForFunction(() => window.keepfall); await page.waitForTimeout(50);
    const v = await page.evaluate(() => window.keepfallSfx.volume);
    t.ok(v === want, `stored volume ${JSON.stringify(raw)} loads as ${want}`, String(v));
  }
  allErrors.push(...errors);
  await browser.close();

  // Storage that throws must not break the game or the volume.
  ({ browser, page, errors } = await open(1));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await page.reload(); await page.waitForFunction(() => window.keepfall); await page.waitForTimeout(100);
  await key(page, '4'); await key(page, 'a'); s = await page.evaluate(() => ({ v: window.keepfallSfx.volume, scr: window.keepfall.screen.constructor.name }));
  t.ok(s.scr === 'SoundScreen' && s.v === 0.9, 'with blocked storage the screen opens and the volume still changes', JSON.stringify(s));
  allErrors.push(...errors);
  await browser.close();

  // The other three title rows still do what they did.
  for (const [moves, want] of [[0, 'MapScreen'], [1, 'ShopScreen'], [2, 'HelpScreen']]) {
    ({ browser, page, errors } = await open(1));
    await key(page, 's', moves); await key(page, 'Enter');
    const scr = (await state(page)).screen;
    t.ok(scr === want, `title row ${moves + 1} opens ${want}`, scr);
    allErrors.push(...errors);
    await browser.close();
  }
  t.done(allErrors);
})().catch((e) => { console.error(e); process.exit(1); });
