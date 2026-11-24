// Regression test for fix 4 in PLAN.md "Bugs found and fixed": floor 3 enemies must not hit as hard as the boss.
//   - Every regular enemy kind on floor 3 has attack at or below 80% of the boss's attack.
//   - Floors 1 and 2 follow 1.0 and 1.6 times the base values (floor 1 is taken as the base).
//   - Growth never goes backwards: floor 3 attack is at least floor 2 attack, and health keeps growing.
// It checks rules and relations, not a copy of the numbers, and prints the current table for review.
// It also reads the enemies of a real floor 3 map, so the map uses the same capped stats.
// Run with the dev server up: PORT=5173 node tests/bugfix-balance.cjs
const { open, checks } = require('./lib.cjs');

const KINDS = ['rat', 'guard', 'wisp', 'hound', 'lurker'];

(async () => {
  const t = checks();
  const { browser, page, errors } = await open(31);
  const table = await page.evaluate(async (kinds) => {
    const E = await import('/src/entities/enemies.ts');
    const rows = {};
    for (const k of kinds) rows[k] = [1, 2, 3].map((f) => E.makeEnemyStats(k, f));
    return { rows, boss: E.makeEnemyStats('boss', 3), boss1: E.makeEnemyStats('boss', 1) };
  }, KINDS);

  const boss = table.boss;
  console.log(`boss ${boss.name}: hp ${boss.maxHp}, atk ${boss.atk}, 80% of boss atk = ${(0.8 * boss.atk).toFixed(1)}`);
  console.log('kind     floor1 hp/atk  floor2 hp/atk  floor3 hp/atk');
  for (const k of KINDS) {
    const r = table.rows[k];
    console.log(`${k.padEnd(8)} ${r.map((s) => `${String(s.maxHp).padStart(6)}/${String(s.atk).padEnd(6)}`).join(' ')}`);
  }

  t.ok(boss.boss && boss.kind === 'boss' && boss.atk > 0, 'the boss stats are built');
  t.ok(table.boss1.atk === boss.atk && table.boss1.maxHp === boss.maxHp, 'the boss has the same stats whatever floor number is passed');
  for (const k of KINDS) {
    const [f1, f2, f3] = table.rows[k];
    t.ok(!f3.boss && f3.atk <= 0.8 * boss.atk, `${k} floor 3 attack ${f3.atk} is at most 80% of the boss attack ${boss.atk}`);
    t.ok(f2.atk === Math.max(1, Math.round(f1.atk * 1.6)) && f2.maxHp === Math.round(f1.maxHp * 1.6),
      `${k} floor 2 is 1.6 times floor 1 (hp ${f1.maxHp} to ${f2.maxHp}, atk ${f1.atk} to ${f2.atk})`);
    t.ok(f3.atk >= f2.atk && f3.maxHp > f2.maxHp, `${k} floor 3 does not grow backwards (atk ${f2.atk} to ${f3.atk}, hp ${f2.maxHp} to ${f3.maxHp})`);
  }

  // The real floor 3 map: every regular enemy on it under the same cap.
  const onMap = await page.evaluate(() => { const g = window.keepfall; g.startRun(); g.nextFloor(); g.nextFloor();
    return { floor: g.run.floorNum, enemies: g.map.floor.enemies.map((e) => ({ kind: e.stats.kind, atk: e.stats.atk, boss: e.stats.boss })) }; });
  const mapBoss = onMap.enemies.find((e) => e.boss);
  const over = onMap.enemies.filter((e) => !e.boss && e.atk > 0.8 * mapBoss.atk);
  console.log('floor 3 map enemies', JSON.stringify(onMap.enemies));
  t.ok(onMap.floor === 3 && mapBoss && onMap.enemies.length >= 4, 'a real floor 3 map has the boss and his guards');
  t.ok(over.length === 0, 'every regular enemy on the floor 3 map has at most 80% of the boss attack', JSON.stringify(over));

  await browser.close();
  t.done(errors);
})().catch((e) => { console.error(e); process.exit(1); });
