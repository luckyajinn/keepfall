// Checks the touch controls: when they show, the layout on phones and tablets, and play with the buttons only.
// Usage: PORT=5173 node tests/touch.cjs [folder for screenshots]
const { open, state, path, checks } = require('./lib.cjs');
const t = checks();
const shots = process.argv[2] || '';
const allErrors = [];

const PHONE_UP = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const PHONE_SIDE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const TABLET = { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

const wait = (page, ms) => page.waitForTimeout(ms);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

// Real touch events through the browser, so the page gets pointer events with pointerType "touch".
async function fingers(page) {
  const cdp = await page.context().newCDPSession(page);
  const down = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...down.values()] });
  return {
    async start(id, x, y) { down.set(id, { id, x, y }); await send('touchStart'); },
    async move(id, x, y) { down.set(id, { id, x, y }); await send('touchMove'); },
    // touchEnd lists the points that lift.
    async end(id) { const p = down.get(id); down.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [p] }); },
    async cancel() { down.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); },
    async tap(x, y) { down.set(99, { id: 99, x, y }); await send('touchStart'); await wait(page, 50); await this.end(99); },
  };
}

// Where to put a finger for each control, in page coordinates.
const spots = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; };
  const p = r(document.querySelector('.tc-pad'));
  const out = { pad: p, up: { x: p.x, y: p.y - p.h * 0.33 }, down: { x: p.x, y: p.y + p.h * 0.33 }, left: { x: p.x - p.w * 0.33, y: p.y }, right: { x: p.x + p.w * 0.33, y: p.y } };
  for (const b of document.querySelectorAll('.tc-btn')) out[b.dataset.action] = r(b);
  return out;
});

// Rectangles of the game and every control, and whether the page can scroll.
const layout = (page) => page.evaluate(() => {
  const rect = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const tc = document.getElementById('touch-controls');
  const se = document.scrollingElement;
  return {
    shown: getComputedStyle(tc).display !== 'none', layout: tc.dataset.layout, canvas: rect(document.getElementById('game')),
    controls: [document.querySelector('.tc-pad'), ...document.querySelectorAll('.tc-btn')].map((el) => ({ name: el.dataset.action || 'pad', ...rect(el) })),
    vw: innerWidth, vh: innerHeight, scrollW: se.scrollWidth, scrollH: se.scrollHeight, scrollX, scrollY,
  };
});

const hints = (page) => page.evaluate(async () => {
  const h = await import('/src/ui/hints.ts');
  const ids = ['menuPick', 'menuBuy', 'battleMenu', 'battleNext', 'back', 'toVendor', 'toShop', 'mapMove', 'helpMove', 'helpSound'];
  return { touch: h.controls.touch, text: Object.fromEntries(ids.map((id) => [id, h.hint(id)])) };
});
const setTouchHints = (page, on) => page.evaluate(async (v) => { (await import('/src/ui/hints.ts')).controls.touch = v; }, on);

// Logs every action the game input gets, so button presses can be checked even where they do nothing on screen.
const spy = (page) => page.evaluate(() => {
  const inp = window.keepfall.input; window.acts = [];
  const press = inp.press.bind(inp); inp.press = (a) => { window.acts.push(a); press(a); };
});
const acts = (page) => page.evaluate(() => window.acts.splice(0));
const heldDir = (page) => page.evaluate(() => window.keepfall.input.heldDir());

function checkLayout(L, label) {
  t.ok(L.shown, `${label}: controls shown`, L.layout);
  const inside = (r) => r.l >= -0.5 && r.t >= -0.5 && r.r <= L.vw + 0.5 && r.b <= L.vh + 0.5;
  t.ok(inside(L.canvas), `${label}: game fits the screen`, JSON.stringify(L.canvas));
  for (const c of L.controls) {
    const overlap = c.l < L.canvas.r && c.r > L.canvas.l && c.t < L.canvas.b && c.b > L.canvas.t;
    t.ok(inside(c) && !overlap, `${label}: ${c.name} on screen and off the game`, `${Math.round(c.l)},${Math.round(c.t)} ${Math.round(c.w)}x${Math.round(c.h)}`);
    t.ok(c.w >= 48 && c.h >= 48, `${label}: ${c.name} at least 48 px`);
  }
  t.ok(L.scrollW <= L.vw && L.scrollH <= L.vh && L.scrollX === 0 && L.scrollY === 0, `${label}: no page scroll`, `${L.scrollW}x${L.scrollH}`);
}

// Walks one tile with the pad: hold until the step starts, then lift.
async function padStep(page, f, sp, dir) {
  const before = await state(page);
  await f.start(1, sp[dir].x, sp[dir].y);
  await page.waitForFunction(([x, y]) => { const g = window.keepfall; return g.screen !== g.map || g.map.x !== x || g.map.y !== y || g.map.encounter; }, [before.x, before.y], { timeout: 3000 }).catch(() => {});
  await f.end(1);
  await page.waitForFunction(() => { const g = window.keepfall; return !g.map || g.screen !== g.map || (g.map.moveT >= 1 && !g.map.encounter); }, null, { timeout: 5000 });
}

// Plays a fight with the pad and OK only. Guards wind ups, drinks when low, else attacks.
async function padFight(page, f, sp) {
  let outcome = 'ongoing';
  for (let i = 0; i < 600; i++) {
    const s = await state(page);
    if (s.screen !== 'BattleScreen') return outcome;
    outcome = s.battle.outcome;
    if (s.battle.inMenu) {
      const want = s.battle.charging ? 1 : s.potions > 0 && s.hp <= 14 ? 2 : 0;
      for (let n = 0; n < 4; n++) {
        const at = await page.evaluate(() => window.keepfall.screen.menuIndex);
        if (at === want) break;
        await f.tap(sp.down.x, sp.down.y); await wait(page, 40);
      }
    }
    await f.tap(sp.confirm.x, sp.confirm.y); await wait(page, 70);
  }
  throw new Error('battle did not end');
}

(async () => {
  // Desktop, no touch: no buttons. The game's 400 by 300 pixel grid is shown at the largest whole
  // number scale that fits (2 times in 800x600 and 1280x720, 3 times in 1920x1080), since that keeps
  // within 80% of the best fit. Before the pixel art change 1280x720 filled the height at 960x720.
  for (const vp of [{ width: 800, height: 600, w: 800, h: 600 }, { width: 1280, height: 720, w: 800, h: 600 }, { width: 1920, height: 1080, w: 1200, h: 900 }]) {
    const { browser, page, errors } = await open(3, { viewport: { width: vp.width, height: vp.height } });
    const L = await layout(page);
    t.ok(!L.shown, `desktop ${vp.width}x${vp.height}: controls hidden`);
    t.ok(L.canvas.w === vp.w && L.canvas.h === vp.h && L.canvas.l === (vp.width - vp.w) / 2, `desktop ${vp.width}x${vp.height}: canvas ${vp.w}x${vp.h}, a whole number scale`, JSON.stringify(L.canvas));
    const grid = await page.evaluate(() => { const c = document.getElementById('game'); return { w: c.width, h: c.height, r: getComputedStyle(c).imageRendering }; });
    t.ok(grid.w === 400 && grid.h === 300 && grid.r === 'pixelated', `desktop ${vp.width}x${vp.height}: a 400x300 canvas scaled up with pixelated`, JSON.stringify(grid));
    const H0 = await hints(page);
    t.ok(!H0.touch && H0.text.menuPick === 'W and S to choose. Enter to pick.', 'desktop: hints name keys', H0.text.menuPick);
    if (vp.width === 800) {
      await shot(page, 'desktop-title');
      await page.keyboard.press('Enter'); await wait(page, 300);
      t.ok((await state(page)).screen === 'MapScreen', 'desktop: Enter starts a run');
      await wait(page, 700); await shot(page, 'desktop-map');
      // The first real touch shows the controls, even where the main pointer is a mouse.
      await page.evaluate(() => document.getElementById('game').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })));
      await wait(page, 100);
      const L2 = await layout(page);
      t.ok(L2.shown && (await hints(page)).touch, 'desktop: a first touch shows the controls and switches hints');
      checkLayout(L2, 'desktop after touch');
    }
    allErrors.push(...errors); await browser.close();
  }

  // Layout and screenshots in each touch size.
  for (const [name, opts] of [['phone-upright', PHONE_UP], ['phone-sideways', PHONE_SIDE], ['tablet', TABLET]]) {
    const { browser, page, errors } = await open(7, opts);
    checkLayout(await layout(page), name);
    const f = await fingers(page);
    // Try to drag the page around on the game. It must not move.
    const c = (await layout(page)).canvas;
    await f.start(5, c.l + c.w / 2, c.t + c.h / 2);
    for (let i = 1; i <= 8; i++) await f.move(5, c.l + c.w / 2, c.t + c.h / 2 - i * 30);
    await f.end(5); await wait(page, 200);
    const L = await layout(page);
    t.ok(L.scrollX === 0 && L.scrollY === 0, `${name}: a drag does not scroll the page`);
    await shot(page, `${name}-title`);
    const sp = await spots(page);
    await f.tap(sp.confirm.x, sp.confirm.y); await wait(page, 300);
    t.ok((await state(page)).screen === 'MapScreen', `${name}: OK on the title starts a run`);
    await wait(page, 700); await shot(page, `${name}-map`);
    await page.evaluate(() => { const g = window.keepfall; g.startBattle(g.map.floor.enemies.find((e) => !e.hidden), false); });
    await wait(page, 1500); await shot(page, `${name}-battle`);
    await page.evaluate(() => window.keepfall.showVendor());
    await wait(page, 200); await shot(page, `${name}-vendor`);
    allErrors.push(...errors); await browser.close();
  }

  // Play with the buttons on an upright phone.
  const { browser, page, errors } = await open(33, PHONE_UP); // Seed 33 starts with a long clear row to walk along.
  const f = await fingers(page);
  const sp = await spots(page);
  await spy(page);
  const H1 = await hints(page);
  t.ok(H1.touch && H1.text.menuPick === 'Arrows to choose. OK to pick.' && H1.text.battleNext === 'Tap OK to go on', 'hints use touch wording', JSON.stringify(H1.text));
  await setTouchHints(page, false);
  t.ok((await hints(page)).text.battleNext === 'Press Enter to go on', 'hints use key wording when touch is off');
  await setTouchHints(page, true);

  await f.tap(sp.confirm.x, sp.confirm.y); await wait(page, 300);
  t.ok((await state(page)).screen === 'MapScreen', 'OK on the title starts a run');
  t.ok((await acts(page)).join() === 'confirm', 'OK sends confirm');

  // Find the longest clear line from the start, then hold that way.
  let s = await state(page);
  const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const clear = (dir) => { let n = 0; const [dx, dy] = V[dir];
    for (let i = 1; i < 25; i++) { const x = s.x + dx * i, y = s.y + dy * i; if (s.tiles[y * 25 + x] !== 1 || s.enemies.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) break; n = i; } return n; };
  const dirs = Object.keys(V).sort((a, b) => clear(b) - clear(a));
  const walk = dirs[0];
  t.ok(clear(walk) >= 3, `there is room to walk ${walk}`, `${clear(walk)} tiles`);
  await f.start(1, sp[walk].x, sp[walk].y);
  t.ok((await heldDir(page)) === walk, `holding ${walk} holds the direction`);
  await page.waitForFunction(([x, y]) => Math.abs(window.keepfall.map.x - x) + Math.abs(window.keepfall.map.y - y) >= 3, [s.x, s.y], { timeout: 3000 }).catch(() => {});
  await f.end(1);
  t.ok((await heldDir(page)) === null, 'lifting the finger releases the direction');
  await wait(page, 500);
  const s2 = await state(page); await wait(page, 400); const s3 = await state(page);
  const walked = Math.abs(s2.x - s.x) + Math.abs(s2.y - s.y);
  t.ok(walked >= 3 && s3.x === s2.x && s3.y === s2.y && s3.screen === 'MapScreen', 'holding walks several tiles and lifting stops', `${walked} tiles`);

  // Slide from one direction to another without lifting.
  await f.start(1, sp.up.x, sp.up.y);
  const a = await heldDir(page);
  await f.move(1, sp.pad.x + sp.pad.w * 0.1, sp.pad.y - sp.pad.h * 0.1);
  await f.move(1, sp.right.x, sp.right.y);
  const b = await heldDir(page);
  await f.move(1, sp.down.x, sp.down.y);
  const c = await heldDir(page);
  await f.end(1);
  t.ok(a === 'up' && b === 'right' && c === 'down' && (await heldDir(page)) === null, 'sliding switches direction', `${a} ${b} ${c}`);

  // A cancelled touch, a finger that leaves the pad, and a lost capture all release.
  await f.start(1, sp.left.x, sp.left.y);
  const held = await heldDir(page);
  await f.cancel();
  t.ok(held === 'left' && (await heldDir(page)) === null, 'a cancelled touch releases');
  t.ok(await page.evaluate(() => !document.querySelector('.tc-pad .on')), 'the pad shows nothing pressed after a cancel');
  await f.start(1, sp.down.x, sp.down.y);
  await f.move(1, sp.pad.x, sp.pad.y + sp.pad.h * 0.45);
  const still = await heldDir(page);
  await f.move(1, sp.pad.x + sp.pad.w * 0.3, sp.pad.y + sp.pad.h * 0.7);
  await f.move(1, sp.pad.x + sp.pad.w, sp.pad.y - sp.pad.h);
  const off = await heldDir(page);
  await f.move(1, sp.left.x, sp.left.y);
  const back = await heldDir(page);
  await f.end(1);
  t.ok(still === 'down' && off === null && back === 'left' && (await heldDir(page)) === null, 'leaving the pad releases, coming back holds again', `${still} ${off} ${back}`);
  await page.evaluate(() => { window.lastPadPointer = -1; document.querySelector('.tc-pad').addEventListener('pointerdown', (e) => { window.lastPadPointer = e.pointerId; }); });
  await f.start(1, sp.up.x, sp.up.y);
  await f.move(1, sp.up.x - 2, sp.up.y);
  const held2 = await heldDir(page);
  const captured = await page.evaluate(() => document.querySelector('.tc-pad').hasPointerCapture(window.lastPadPointer));
  await page.evaluate(() => document.querySelector('.tc-pad').releasePointerCapture(window.lastPadPointer));
  // The browser sends lostpointercapture just before the next pointer event, so move the finger a little.
  await f.move(1, sp.up.x + 2, sp.up.y);
  const lost = await heldDir(page);
  await f.end(1);
  t.ok(held2 === 'up' && captured && lost === null, 'a lost capture releases', `${held2} ${captured} ${lost}`);
  await wait(page, 400); await acts(page);

  // Two fingers: hold a direction and tap OK at the same time.
  await f.start(1, sp.left.x, sp.left.y);
  await f.start(2, sp.confirm.x, sp.confirm.y);
  const both = await page.evaluate(() => ({ dir: window.keepfall.input.heldDir(), ok: !!document.querySelector('.tc-ok.on'), pad: !!document.querySelector('.tc-pad .on') }));
  await f.end(2);
  const after = await heldDir(page);
  await f.end(1);
  const got = await acts(page);
  t.ok(both.dir === 'left' && both.ok && both.pad && after === 'left' && got.includes('confirm') && (await heldDir(page)) === null, 'two fingers at once work', JSON.stringify({ both, after, got }));
  await wait(page, 500);

  // Back and Sound.
  const muted = await page.evaluate(() => window.keepfallSfx.muted);
  await f.tap(sp.cancel.x, sp.cancel.y); await wait(page, 60);
  await f.tap(sp.mute.x, sp.mute.y); await wait(page, 60);
  const muted2 = await page.evaluate(() => window.keepfallSfx.muted);
  await f.tap(sp.mute.x, sp.mute.y); await wait(page, 60);
  const got2 = await acts(page);
  t.ok(got2.join() === 'cancel,mute,mute' && muted2 === !muted, 'Back sends cancel and Sound sends mute', got2.join());
  const audio = await page.evaluate(() => window.keepfallSfx.ctx ? window.keepfallSfx.ctx.state : 'none');
  t.ok(audio !== 'none', 'sound was unlocked by the taps', audio);

  // Back on the map opens the pause menu. Back again resumes the run.
  const paused = await page.evaluate(() => window.keepfall.screen.constructor.name);
  await f.tap(sp.cancel.x, sp.cancel.y); await wait(page, 100);
  const resumed = await page.evaluate(() => window.keepfall.screen === window.keepfall.map);
  t.ok(paused === 'PauseScreen' && resumed, 'Back on the map opens the pause menu and Back again resumes', paused);
  await acts(page);

  // Walk to the nearest enemy with the pad, then fight with the pad and OK only.
  const keyDir = { w: 'up', s: 'down', a: 'left', d: 'right' };
  let fought = null;
  for (let i = 0; i < 200 && !fought; i++) {
    s = await state(page);
    if (s.screen === 'BattleScreen') { fought = await padFight(page, f, sp); break; }
    const vis = s.enemies.filter((e) => !e.hidden && !e.dazed);
    let keys = null;
    for (const e of vis) { const p = path(s, e.x, e.y, new Set(vis.filter((o) => o !== e).map((o) => `${o.x},${o.y}`))); if (p && (!keys || p.length < keys.length)) keys = p; }
    if (!keys) { await wait(page, 100); continue; }
    await padStep(page, f, sp, keyDir[keys[0]]);
    await page.waitForFunction(() => { const g = window.keepfall; return g.screen === g.map || g.screen.constructor.name === 'BattleScreen'; }, null, { timeout: 3000 });
    if ((await state(page)).screen === 'MapScreen' && (await page.evaluate(() => !!window.keepfall.map.encounter))) await wait(page, 900);
  }
  const s4 = await state(page);
  t.ok(fought === 'won' && s4.screen === 'MapScreen', 'a whole battle played with the buttons only', `${fought} ${s4.screen}`);

  // A physical key still works after touching.
  await page.waitForFunction(() => window.keepfall.map.moveT >= 1, null, { timeout: 3000 });
  s = await state(page);
  const kdir = ['right', 'left', 'down', 'up'].find((d) => { const [dx, dy] = V[d]; const x = s.x + dx, y = s.y + dy; return s.tiles[y * 25 + x] === 1 && !s.enemies.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1); });
  const code = { right: 'KeyD', left: 'KeyA', down: 'KeyS', up: 'KeyW' }[kdir];
  await page.keyboard.down(code);
  const kh = await heldDir(page);
  await page.waitForFunction(([x, y]) => window.keepfall.map.x !== x || window.keepfall.map.y !== y, [s.x, s.y], { timeout: 2000 }).catch(() => {});
  await page.keyboard.up(code);
  const s5 = await state(page);
  t.ok(kh === kdir && (s5.x !== s.x || s5.y !== s.y) && (await heldDir(page)) === null, 'a physical key still moves the knight', `${kh} ${kdir}`);
  await page.keyboard.press('KeyM');
  t.ok((await acts(page)).includes('mute'), 'a physical key still sends its action');
  await page.keyboard.press('KeyM');

  allErrors.push(...errors); await browser.close();
  t.done(allErrors);
})().catch((e) => { console.error(e); process.exit(1); });
