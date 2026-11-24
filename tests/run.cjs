// Plays one whole run, fighting everything. Usage: PORT=5173 node tests/run.cjs <seed>
const { open, state, path, step, fight } = require('./lib.cjs');
const seed = Number(process.argv[2] || 7);
(async () => {
  const { browser, page, errors } = await open(seed);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const log = []; let guard = 0;
  while (guard++ < 4000) {
    const s = await state(page);
    if (s.screen === 'MapScreen') {
      const visible = s.enemies.filter((e) => !e.hidden);
      let targets = visible.filter((e) => !e.dazed); if (targets.some((e) => e.kind !== 'boss')) targets = targets.filter((e) => e.kind !== 'boss');
      let keys = null;
      for (const t of targets) { const p = path(s, t.x, t.y, new Set(visible.filter((e) => e !== t).map((e) => `${e.x},${e.y}`))); if (p && (!keys || p.length < keys.length)) keys = p; }
      if (!keys && s.stairs) keys = path(s, s.stairs.x, s.stairs.y, new Set(visible.map((e) => `${e.x},${e.y}`)));
      if (!keys || !keys.length) { await page.waitForTimeout(100); continue; }
      await step(page, keys[0]);
    } else if (s.screen === 'BattleScreen') {
      const name = s.battle.enemy; const boss = name.includes('Ork'); const before = s.hp;
      const outcome = await fight(page, { potionAt: boss ? 28 : 14 });
      const a = await state(page); log.push(`F${s.floor} ${name}: ${outcome}, hp ${before} -> ${a.hp ?? '-'}`);
    } else if (s.screen === 'RewardScreen') { await page.waitForTimeout(500); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    } else if (s.screen === 'VendorScreen') {
      // Potions first when short, then whetstones. The last menu row climbs to the next floor.
      for (let n = 0; n < 6; n++) { const v = await state(page); await page.keyboard.press(v.potions < 3 ? '1' : '2'); await page.waitForTimeout(60); const w = await state(page); if (w.gold === v.gold) break; }
      await page.evaluate(() => window.keepfall.nextFloor()); await page.waitForTimeout(400);
    } else if (s.screen === 'EndScreen') {
      await page.waitForTimeout(700);
      log.push('END ' + JSON.stringify(await page.evaluate(() => window.keepfall.screen.sum))); break;
    } else await page.waitForTimeout(100);
  }
  const audio = await page.evaluate(() => { const s = window.keepfallSfx; return { state: s.ctx ? s.ctx.state : 'none', sounds: [...new Set(s.played)].sort().length }; });
  console.log(log.join('\n')); console.log('fights:', log.length - 1, 'audio:', JSON.stringify(audio)); console.log('errors:', JSON.stringify(errors));
  await browser.close();
  if (errors.length || !log.some((l) => l.startsWith('END'))) process.exit(2);
})().catch((e) => { console.error(e); process.exit(1); });
