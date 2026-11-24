// Regression tests for fix 3 in PLAN.md "Bugs found and fixed": hidden enemies on the map.
//   - A hidden enemy next to the standing knight (4 directions, distance 1) ambushes and gets the first turn.
//   - Two hidden enemies next to the same tile both ambush, one after the other, with no key press for the second.
//   - The knight never shares a tile with an enemy: moving into a hidden enemy's tile starts its ambush.
//   - After fleeing, the enemy is visible and dazed and does not start a new fight while the knight stands still.
//   - Visible enemies only fight when walked into.
// Each case runs on an open walled floor with enemies placed by the test (see arena() in bugfix-common.cjs).
// Run with the dev server up: PORT=5173 node tests/bugfix-map.cjs
const { open, state, checks } = require('./lib.cjs');
const { section, walk, arena, gameTime, waitScreen, drain, choose, leaveBattle } = require('./bugfix-common.cjs');

(async () => {
  const t = checks();
  const { browser, page, errors } = await open(21);
  const battle = () => page.evaluate(() => { const s = window.keepfall.screen; const b = s.battle;
    return b ? { ambush: b.ambush, kind: b.enemy.kind, log: s.log.slice(), id: s.mapEnemy.id, hiddenNow: s.mapEnemy.hidden } : null; });
  const mapInfo = () => page.evaluate(() => { const g = window.keepfall; const m = g.map;
    return { screen: g.screen.constructor.name, x: m.x, y: m.y, encounter: !!m.encounter,
      enemies: m.floor.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, hidden: e.hidden, dazed: e.dazed })) }; });
  const sharesTile = (m) => m.enemies.some((e) => e.x === m.x && e.y === m.y);
  let m; let s; let b;

  await section(t, 'walking up to a hidden enemy', async () => {
    // The knight walks right from (3,5). The hidden enemy at (6,5) must wait until the knight
    // stands next to it at (5,5). The one at (5,7) is never closer than two tiles, so it never jumps out.
    await arena(page, { kx: 3, ky: 5, enemies: [
      { kind: 'lurker', x: 6, y: 5, hidden: true },
      { kind: 'lurker', x: 5, y: 7, hidden: true },
    ] });
    await gameTime(page, 0.3);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter, 'no ambush while hidden enemies are three tiles away');
    await walk(page, 'd'); // to (4,5): both hidden enemies are still two or more tiles away
    await gameTime(page, 0.3);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter && m.x === 4, 'no ambush from two tiles away', JSON.stringify(m));
    await walk(page, 'd'); // to (5,5): (6,5) is now next to the knight
    s = await state(page);
    b = await battle();
    t.ok(s.screen === 'BattleScreen' && b && b.id === 9001 && b.ambush, 'the hidden enemy next to the knight ambushes', JSON.stringify(b && { id: b.id, ambush: b.ambush }));
    t.ok(b && !b.hiddenNow, 'the ambusher is revealed');
    await drain(page);
    b = await battle();
    t.ok(b && /^Ambush!/.test(b.log[0]) && /hits you|snaps at you|winds up/.test(b.log[1] || ''), 'the ambusher gets the first turn', JSON.stringify(b && b.log.slice(0, 2)));
  });

  await section(t, 'hidden enemies on the diagonals', async () => {
    // Hidden enemies on the diagonals (two steps away) never ambush.
    await arena(page, { kx: 5, ky: 5, enemies: [{ kind: 'lurker', x: 6, y: 6, hidden: true }, { kind: 'lurker', x: 4, y: 4, hidden: true }] });
    await gameTime(page, 0.5);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter && m.enemies.every((e) => e.hidden), 'hidden enemies on the diagonals do not ambush');
  });

  await section(t, 'two hidden neighbours', async () => {
    // Two hidden enemies next to the tile (5,5). The knight starts two tiles from both and steps onto it.
    // Before the fix only one of them jumped out, because the check ran only when a step ended.
    await arena(page, { kx: 4, ky: 5, enemies: [{ kind: 'lurker', x: 6, y: 5, hidden: true }, { kind: 'lurker', x: 5, y: 4, hidden: true }] });
    await gameTime(page, 0.2);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter, 'no ambush while both hidden enemies are two tiles away');
    await walk(page, 'd');
    await waitScreen(page, 'BattleScreen');
    b = await battle();
    const firstId = b.id;
    t.ok(b.ambush, 'the first of two hidden neighbours ambushes');
    // Win it at once: the enemy is left with 1 health and the knight attacks.
    t.ok(await drain(page) === 'menu', 'the first ambush reaches the menu');
    await page.evaluate(() => { window.keepfall.screen.battle.enemyHp = 1; });
    t.ok(await choose(page, '1') === 'over', 'the first ambusher is beaten');
    await leaveBattle(page);
    // From here on no key is pressed. The second ambush must start by itself.
    await waitScreen(page, 'BattleScreen', 3000);
    b = await battle();
    t.ok(b && b.ambush && b.id !== firstId && [9001, 9002].includes(b.id), 'the second hidden neighbour ambushes too, with no key press', JSON.stringify(b && { id: b.id, ambush: b.ambush }));
    if (b) {
      await drain(page);
      b = await battle();
      t.ok(/^Ambush!/.test(b.log[0]) && b.log.length >= 2, 'the second ambusher also gets the first turn', JSON.stringify(b.log.slice(0, 2)));
    }
    m = await mapInfo();
    t.ok(m.x === 5 && m.y === 5 && !sharesTile(m), 'the knight stayed on its tile and shares it with no enemy');
  });

  await section(t, 'moving into a hidden enemy', async () => {
    // Moving into a hidden enemy's tile. With the ambush check working the knight never gets the chance
    // by walking, so this calls the map's own move function directly (a private method, callable at runtime).
    // The move happens in the same page task as the set up, so the standing check gets no frame to act first.
    await arena(page, { kx: 5, ky: 5, tryMove: 'right', enemies: [{ kind: 'lurker', x: 6, y: 5, hidden: true }] });
    const moved = await page.evaluate(() => { const m = window.keepfall.map;
      return { x: m.x, y: m.y, moveT: m.moveT, enc: m.encounter && { ambush: m.encounter.ambush, id: m.encounter.enemy.id, hidden: m.encounter.enemy.hidden } }; });
    t.ok(moved.x === 5 && moved.y === 5 && moved.moveT === 1, 'moving into a hidden enemy does not move the knight onto it', JSON.stringify(moved));
    t.ok(moved.enc && moved.enc.ambush && moved.enc.id === 9001 && !moved.enc.hidden, 'moving into a hidden enemy starts its ambush', JSON.stringify(moved.enc));
    await waitScreen(page, 'BattleScreen');
  });

  await section(t, 'fleeing from an ambusher', async () => {
    // Fleeing. The Swift Buckle makes flight certain, so the test does not depend on a random roll.
    await arena(page, { kx: 4, ky: 5, trinkets: ['buckle'], enemies: [{ kind: 'lurker', x: 6, y: 5, hidden: true }] });
    await walk(page, 'd');
    await waitScreen(page, 'BattleScreen');
    t.ok(await drain(page) === 'menu', 'ambush before the flight reaches the menu');
    t.ok(await choose(page, '4') === 'over', 'the knight flees');
    await leaveBattle(page);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.enemies[0].hidden && m.enemies[0].dazed > 0, 'after fleeing the enemy is visible and dazed', JSON.stringify(m.enemies[0]));
    await gameTime(page, 0.6);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter, 'the dazed enemy next to the standing knight starts no fight');
    // Walking into it while dazed: it only blocks the way.
    await walk(page, 'd', { blocked: true });
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter && m.x === 5 && !sharesTile(m), 'walking into a dazed enemy is blocked and starts no fight', JSON.stringify(m));
    // Let the daze run out (shortened from 3 seconds to keep the test fast). Still no fight while standing.
    await page.evaluate(() => { window.keepfall.map.floor.enemies[0].dazed = 0.2; });
    await gameTime(page, 0.8);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter && m.enemies[0].dazed <= 0, 'once the daze is over, the visible enemy still starts no fight while the knight stands still', JSON.stringify(m.enemies[0]));
    await walk(page, 'd');
    s = await state(page);
    b = await battle();
    t.ok(s.screen === 'BattleScreen' && b && !b.ambush && b.id === 9001, 'walking into the visible enemy starts a normal fight', JSON.stringify(b && { ambush: b.ambush }));
  });

  await section(t, 'visible neighbours', async () => {
    // A visible enemy placed next to the knight from the start only fights when walked into.
    await arena(page, { kx: 5, ky: 5, enemies: [{ kind: 'guard', x: 6, y: 5 }, { kind: 'rat', x: 5, y: 6 }] });
    await gameTime(page, 0.8);
    m = await mapInfo();
    t.ok(m.screen === 'MapScreen' && !m.encounter, 'visible enemies next to the standing knight start no fight');
    await walk(page, 's');
    b = await battle();
    t.ok(b && !b.ambush && b.kind === 'rat', 'walking into a visible enemy starts a normal fight with it');
  });

  await browser.close();
  t.done(errors);
})().catch((e) => { console.error(e); process.exit(1); });
