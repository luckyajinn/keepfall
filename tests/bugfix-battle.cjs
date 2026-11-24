// Regression tests for three battle fixes from PLAN.md "Bugs found and fixed":
//   1. A potion at full health (or with none left) is refused: nothing changes, no turn passes.
//   2. The boss enrages exactly once, when his health first drops to half or below, also after Thorn Ring damage.
//   6. Battle events carry `blocked` and `source`, and a blocked hit plays the block sound, not hurt.
// The pure rules are checked on the Battle class inside the page. The menu, log, sounds and the dimmed
// Potion row are checked on the real battle screen.
// Run with the dev server up: PORT=5173 node tests/bugfix-battle.cjs
const { open, checks } = require('./lib.cjs');
const { section, arena, waitScreen, drain, choose, recordText, drawnTexts, soundMark, soundsSince, frames } = require('./bugfix-common.cjs');

(async () => {
  const t = checks();
  const { browser, page, errors } = await open(11);

  // ---------- 1. Potion rules on the Battle class ----------
  const potion = await page.evaluate(async () => {
    const B = await import('/src/battle/battle.ts');
    const K = await import('/src/entities/knight.ts');
    const E = await import('/src/entities/enemies.ts');
    const S = await import('/src/meta/save.ts');
    const R = await import('/src/rng.ts');
    const snap = (b, rng) => JSON.stringify({ k: b.knight, hp: b.enemyHp, c: b.charging, r: b.riposte, g: b.guarding, sh: b.sinceHeavy, o: b.outcome, rng: rng.s });
    const out = {};
    // Full health, potions in hand. A Rust Guard so the enemy turn counter (sinceHeavy) would show a passed turn.
    {
      const k = K.newKnight(S.emptySave()); const rng = new R.Rng(5);
      const b = new B.Battle(k, E.makeEnemyStats('guard', 1), false, rng); b.begin();
      const before = snap(b, rng);
      const ev = b.act('potion');
      out.fullEvents = ev.length; out.fullSame = snap(b, rng) === before; out.fullPotions = k.potions; out.startPotions = K.newKnight(S.emptySave()).potions;
    }
    // Below full health with no potions left.
    {
      const k = K.newKnight(S.emptySave()); k.hp -= 10; k.potions = 0; const rng = new R.Rng(5);
      const b = new B.Battle(k, E.makeEnemyStats('guard', 1), false, rng); b.begin();
      const before = snap(b, rng);
      out.noneEvents = b.act('potion').length; out.noneSame = snap(b, rng) === before;
    }
    // Below full health with potions: drinks, heals, and the enemy acts.
    {
      const k = K.newKnight(S.emptySave()); k.hp -= 10; const hp0 = k.hp; const p0 = k.potions; const rng = new R.Rng(5);
      const b = new B.Battle(k, E.makeEnemyStats('rat', 1), false, rng); b.begin();
      const s0 = rng.s;
      const ev = b.act('potion');
      out.lowPotions = [p0, k.potions]; out.lowAnims = ev.map((e) => e.anim); out.lowHeal = ev[0] && ev[0].amount;
      out.lowHp = [hp0, ev[0] && ev[0].knightHp]; out.lowRng = rng.s !== s0;
    }
    return out;
  });
  console.log('potion rules', JSON.stringify(potion));
  t.ok(potion.fullEvents === 0, 'potion at full health returns no events');
  t.ok(potion.fullSame, 'potion at full health changes nothing (knight, enemy, turn counters, random draws)');
  t.ok(potion.fullPotions === potion.startPotions, 'potion at full health uses no potion');
  t.ok(potion.noneEvents === 0 && potion.noneSame, 'potion with none left returns no events and changes nothing');
  t.ok(potion.lowPotions[1] === potion.lowPotions[0] - 1, 'potion below full health uses one potion', JSON.stringify(potion.lowPotions));
  t.ok(potion.lowAnims[0] === 'heal' && potion.lowHeal > 0 && potion.lowHp[1] > potion.lowHp[0], 'potion below full health heals');
  t.ok(potion.lowAnims.slice(1).includes('knightHit') && potion.lowRng, 'after the potion the enemy takes its turn');

  // ---------- 2. Boss enrage on the Battle class ----------
  const enrage = await page.evaluate(async () => {
    const B = await import('/src/battle/battle.ts');
    const K = await import('/src/entities/knight.ts');
    const E = await import('/src/entities/enemies.ts');
    const S = await import('/src/meta/save.ts');
    const R = await import('/src/rng.ts');
    const isRoar = (e) => /roars/.test(e.text);
    // A knight that can not die, so a fight can run to the end.
    const tough = (trinkets = []) => { const k = K.newKnight(S.emptySave()); k.trinkets = trinkets; k.hp = 100000; return k; };
    // Checks a whole event list: the first event that leaves the boss at or below half (and alive)
    // must be followed right away by the one and only roar.
    function audit(events, maxHp, startHp) {
      const roars = events.map((e, i) => (isRoar(e) ? i : -1)).filter((i) => i >= 0);
      let prev = startHp; let cross = -1;
      for (let i = 0; i < events.length; i++) {
        const hp = events[i].enemyHp;
        if (cross < 0 && prev > maxHp / 2 && hp <= maxHp / 2 && hp > 0) cross = i;
        prev = hp;
      }
      return { roars: roars.length, cross, roarAt: roars[0] ?? -1, crossEvent: cross >= 0 ? events[cross] : null };
    }
    const out = {};
    const boss = E.makeEnemyStats('boss', 3);
    out.bossHp = boss.maxHp;
    // A whole fight with Attack only, over several seeds.
    out.attackFights = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const b = new B.Battle(tough(), boss, false, new R.Rng(seed)); const events = b.begin();
      for (let n = 0; n < 400 && b.outcome === 'ongoing'; n++) events.push(...b.act('attack'));
      const a = audit(events, boss.maxHp, boss.maxHp);
      out.attackFights.push({ seed, outcome: b.outcome, enraged: b.enraged, ...a, crossAnim: a.crossEvent && a.crossEvent.anim });
    }
    // Thorn Ring takes him to half: boss at half + 1, the knight guards, the boss hits, the ring pricks for 2.
    {
      const b = new B.Battle(tough(['thorn']), boss, false, new R.Rng(9)); b.begin();
      b.enemyHp = Math.floor(boss.maxHp / 2) + 1;
      const startHp = b.enemyHp;
      const ev = b.act('guard');
      const a = audit(ev, boss.maxHp, startHp);
      out.thorn = { anims: ev.map((e) => e.anim), texts: ev.map((e) => e.text), enraged: b.enraged, ...a, crossSource: a.crossEvent && a.crossEvent.source };
    }
    // A whole fight with Guard only and the Thorn Ring, so all damage comes from the ring.
    {
      const b = new B.Battle(tough(['thorn']), boss, false, new R.Rng(10)); const events = b.begin();
      for (let n = 0; n < 2000 && b.outcome === 'ongoing'; n++) events.push(...b.act('guard'));
      const a = audit(events, boss.maxHp, boss.maxHp);
      out.thornFight = { outcome: b.outcome, enraged: b.enraged, ...a, crossSource: a.crossEvent && a.crossEvent.source };
    }
    // A killing blow from above half does not enrage (Attack and Thorn Ring).
    {
      const k = tough(); k.gear.sword = 100; // far more than 150 damage
      const b = new B.Battle(k, boss, false, new R.Rng(3)); b.begin();
      const ev = b.act('attack');
      out.killAttack = { outcome: b.outcome, enraged: b.enraged, roars: ev.filter(isRoar).length };
      const b2 = new B.Battle(tough(['thorn']), boss, false, new R.Rng(3)); b2.begin(); b2.enemyHp = 2;
      const ev2 = b2.act('guard');
      out.killThorn = { outcome: b2.outcome, enraged: b2.enraged, roars: ev2.filter(isRoar).length };
    }
    // Normal enemies never enrage, on any floor, from Attack or Thorn Ring.
    out.normal = [];
    for (const kind of ['rat', 'guard', 'wisp', 'hound', 'lurker']) {
      for (const floor of [1, 2, 3]) {
        for (const action of ['attack', 'guard']) {
          const stats = E.makeEnemyStats(kind, floor);
          const b = new B.Battle(tough(['thorn']), stats, false, new R.Rng(floor * 7)); const events = b.begin();
          for (let n = 0; n < 2000 && b.outcome === 'ongoing'; n++) events.push(...b.act(action));
          if (b.enraged || events.some(isRoar)) out.normal.push(`${kind} f${floor} ${action}`);
        }
      }
    }
    return out;
  });
  // crossEvent is only used for the checks below; leave it out of the printed summary.
  const brief = (o) => { const { crossEvent, ...rest } = o; return rest; };
  console.log('enrage', JSON.stringify({ ...enrage, attackFights: enrage.attackFights.map(brief), thorn: brief(enrage.thorn), thornFight: brief(enrage.thornFight) }));
  for (const f of enrage.attackFights) {
    t.ok(f.outcome === 'won' && f.enraged && f.roars === 1, `boss attack fight seed ${f.seed}: won, enraged, exactly one roar`, `roars ${f.roars}`);
    t.ok(f.cross >= 0 && f.roarAt === f.cross + 1 && f.crossAnim === 'enemyHit', `boss attack fight seed ${f.seed}: roar comes right after the hit that crossed half`, `cross ${f.cross} roar ${f.roarAt}`);
  }
  t.ok(enrage.thorn.enraged && enrage.thorn.roars === 1, 'Thorn Ring damage that takes the boss to half enrages him', JSON.stringify(enrage.thorn.anims));
  t.ok(enrage.thorn.crossSource === 'thorn' && enrage.thorn.roarAt === enrage.thorn.cross + 1, 'the roar comes right after the Thorn Ring event, in the same turn');
  t.ok(enrage.thornFight.outcome === 'won' && enrage.thornFight.roars === 1 && enrage.thornFight.crossSource === 'thorn'
    && enrage.thornFight.roarAt === enrage.thornFight.cross + 1, 'a guard only fight with the Thorn Ring: one roar, right after the ring took him to half', JSON.stringify(brief(enrage.thornFight)));
  t.ok(enrage.killAttack.outcome === 'won' && !enrage.killAttack.enraged && enrage.killAttack.roars === 0, 'a killing Attack does not enrage the boss');
  t.ok(enrage.killThorn.outcome === 'won' && !enrage.killThorn.enraged && enrage.killThorn.roars === 0, 'a killing Thorn Ring prick does not enrage the boss');
  t.ok(enrage.normal.length === 0, 'normal enemies never enrage (5 kinds, 3 floors, Attack and Thorn Ring)', enrage.normal.join(', '));

  // ---------- 6. Event flags on the Battle class ----------
  const flags = await page.evaluate(async () => {
    const B = await import('/src/battle/battle.ts');
    const K = await import('/src/entities/knight.ts');
    const E = await import('/src/entities/enemies.ts');
    const S = await import('/src/meta/save.ts');
    const R = await import('/src/rng.ts');
    const k = K.newKnight(S.emptySave()); k.trinkets = ['thorn']; k.hp = 1000;
    const b = new B.Battle(k, Object.assign(E.makeEnemyStats('rat', 1), { maxHp: 999 }), false, new R.Rng(4)); b.enemyHp = 999; b.begin();
    const g = b.act('guard'); const a = b.act('attack');
    const hit = (list) => list.find((e) => e.anim === 'knightHit');
    const thorn = (list) => list.find((e) => e.source === 'thorn');
    return { guardHit: hit(g), attackHit: hit(a), thornG: thorn(g), thornA: thorn(a), strike: a[0] };
  });
  console.log('flags', JSON.stringify(flags));
  t.ok(flags.guardHit && flags.guardHit.blocked === true, 'a hit taken while guarding has blocked: true');
  t.ok(flags.attackHit && !flags.attackHit.blocked, 'a hit taken without guarding is not blocked');
  t.ok(flags.thornG && flags.thornG.anim === 'enemyHit' && flags.thornG.amount === 2 && flags.thornA, 'the Thorn Ring event has source: thorn');
  t.ok(flags.strike && flags.strike.anim === 'enemyHit' && flags.strike.source === undefined, 'a sword strike has no source');

  // ---------- 1 and 6 on the real battle screen ----------
  await section(t, 'battle screen', async () => {
    await recordText(page);
    const C = await page.evaluate(async () => (await import('/src/render/colors.ts')).C);
    const norm = (c) => c.toLowerCase();
    // A Cellar Rat with a lot of health, so the fight lasts long enough for every check.
    await arena(page, { kx: 5, ky: 5, enemies: [{ kind: 'rat', x: 6, y: 5, stats: { maxHp: 999 } }] });
    await page.evaluate(() => window.keepfall.startBattle(window.keepfall.map.floor.enemies[0], false));
    await waitScreen(page, 'BattleScreen');
    t.ok(await drain(page) === 'menu', 'the battle menu opens');

    const rowColor = (list, label) => { const r = list.filter((x) => x.s === label).pop(); return r ? norm(r.color) : null; };
    let drawn = await drawnTexts(page);
    t.ok(rowColor(drawn, '3  Potion') === norm(C.inkFaint), 'Potion row is dimmed at full health', rowColor(drawn, '3  Potion'));
    t.ok(rowColor(drawn, '2  Guard') === norm(C.ink), 'Guard row is not dimmed (the color check can tell the two apart)', rowColor(drawn, '2  Guard'));
    // The same on the canvas itself: count the pixels of each text color inside each row label's box.
    const inks = (label) => page.evaluate(([label, ink, faint]) => {
      const r = window.keepfallText.filter((x) => x.s === label).pop(); if (!r) return null;
      const d = document.getElementById('game').getContext('2d').getImageData(r.x, r.y, r.w, r.h).data;
      const hex = (i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      let n = { ink: 0, faint: 0 }; for (let i = 0; i < d.length; i += 4) { const c = hex(i); if (c === ink) n.ink++; else if (c === faint) n.faint++; }
      return n;
    }, [label, norm(C.ink), norm(C.inkFaint)]);
    const potionPx = await inks('3  Potion'); const guardPx = await inks('2  Guard');
    t.ok(potionPx && potionPx.faint >= 20 && potionPx.ink === 0, 'on the canvas the Potion label is drawn in the dim color only', JSON.stringify(potionPx));
    t.ok(guardPx && guardPx.ink >= 20 && guardPx.faint === 0, 'on the canvas the Guard label is drawn in the normal color', JSON.stringify(guardPx));

    const before = await page.evaluate(() => { const g = window.keepfall; const k = g.run.knight; return { hp: k.hp, potions: k.potions, enemyHp: g.screen.battle.enemyHp, rng: g.rng.s }; });
    await soundMark(page);
    const r1 = await choose(page, '3');
    const after = await page.evaluate(() => { const g = window.keepfall; const k = g.run.knight; return { hp: k.hp, potions: k.potions, enemyHp: g.screen.battle.enemyHp, rng: g.rng.s, last: g.screen.log[g.screen.log.length - 1] }; });
    const s1 = await soundsSince(page);
    t.ok(r1 === 'menu', 'after Potion at full health the menu stays open');
    t.ok(after.last === 'You are already at full health.', 'the log says "You are already at full health."', JSON.stringify(after.last));
    t.ok(s1.includes('deny') && !s1.includes('heal') && !s1.includes('hurt'), 'the deny sound plays and nothing else happens', JSON.stringify(s1));
    t.ok(after.hp === before.hp && after.potions === before.potions && after.enemyHp === before.enemyHp && after.rng === before.rng,
      'no potion used, no turn passed, no random draw', JSON.stringify({ before, after }));

    // 6 on screen: Guard, the rat hits the raised shield.
    await soundMark(page);
    t.ok(await choose(page, '2') === 'menu', 'Guard is chosen and the turn plays out');
    const s2 = await soundsSince(page);
    t.ok(s2.includes('block') && !s2.includes('hurt'), 'a blocked hit plays block and not hurt', JSON.stringify(s2));
    // Unguarded: Attack, then the rat hits the knight.
    await soundMark(page);
    t.ok(await choose(page, '1') === 'menu', 'Attack is chosen and the turn plays out');
    const s3 = await soundsSince(page);
    t.ok(s3.includes('hurt') && !s3.includes('block'), 'an unguarded hit plays hurt and not block', JSON.stringify(s3));

    // 1 below full health: the row is lit, a potion is drunk, it heals and the enemy acts.
    const low = await page.evaluate(() => { const k = window.keepfall.run.knight; k.hp = 5; return { hp: k.hp, potions: k.potions }; });
    await frames(page, 2);
    drawn = await drawnTexts(page);
    t.ok(rowColor(drawn, '3  Potion') !== norm(C.inkFaint), 'Potion row is not dimmed below full health', rowColor(drawn, '3  Potion'));
    await soundMark(page);
    const logLen = await page.evaluate(() => window.keepfall.screen.log.length);
    t.ok(await choose(page, '3') === 'menu', 'Potion below full health is chosen and the turn plays out');
    const drank = await page.evaluate((n) => { const g = window.keepfall; const k = g.run.knight; return { hp: k.hp, potions: k.potions, lines: g.screen.log.slice(n) }; }, logLen);
    const s4 = await soundsSince(page);
    console.log('drink', JSON.stringify(drank), JSON.stringify(s4));
    t.ok(drank.potions === low.potions - 1, 'one potion is used');
    t.ok(/^You drink a potion and heal \d+\./.test(drank.lines[0] || '') && s4.includes('heal'), 'the knight drinks and heals');
    t.ok(drank.lines.slice(1).some((l) => /hits you/.test(l)) && s4.includes('hurt'), 'the enemy acts after the potion');
  });

  await browser.close();
  t.done(errors);
})().catch((e) => { console.error(e); process.exit(1); });
