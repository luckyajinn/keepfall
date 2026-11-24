// The battle screen: draws the fight and turns key presses into battle actions.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C, PAL, darker } from '../render/colors';
import { Ctx, H, W, bar, cursorSprite, fillRR, panel, text, textWidth } from '../render/draw';
import { drawSprite, fillPx, fromPx, snap } from '../render/pixel';
import { drawEnemy, drawKnight, spriteSize } from '../render/sprites';
import { TORCHES, alertArt, backdrop, dissolved, enemyFrame, footOffset, barrierArt, plusArt, shadowArt, sparkArt, torchArt } from './battleArt';
import type { MapEnemy } from '../entities/enemies';
import { attackPower, guardShare, maxHp } from '../entities/knight';
import { Anim, Battle, BattleAction, BattleEvent } from './battle';
import { SfxName, sfx } from '../audio/sfx';
import { hint } from '../ui/hints';

const EVENT_TIME = 1.05;
const MIN_EVENT_TIME = 0.18;
const ACTIONS: readonly BattleAction[] = ['attack', 'guard', 'potion', 'flee'];

const ANIM_SOUND: Partial<Record<Anim, SfxName>> = {
  enemyHit: 'hit',
  knightHit: 'hurt',
  guard: 'guard',
  heal: 'heal',
  windup: 'windup',
  flee: 'flee',
  enemyDown: 'down',
  knightDown: 'lose',
  reward: 'coin',
  levelUp: 'levelUp',
};

// Layout, in logical units (2 per art pixel). Every value is even, so it lands on the pixel grid.
/** Where the knight and the enemy stand: the centers of their boxes across the screen. */
const KNIGHT_X = 200;
const ENEMY_X = 600;
/** The ground line: the bottom of every fighter's box, so all feet are at one height. */
const GROUND = 376;
/** The panels at the bottom: the log on the left, the menu on the right. */
const LOG = { x: 16, y: 402, w: 492, h: 184 };
const MENU = { x: 516, y: 402, w: 268, h: 184 };
/** Log text: left edge, wrap width, first baseline, line height, the gap between entries, and the most lines that fit above the hint. */
const LOG_TEXT = { x: 32, w: 460, top: 428, line: 22, gap: 4, max: 6 };
const LOG_ENTRIES = 3;
/** Menu rows: the first row's top, row height and the highlight bar inside it. */
const MENU_ROWS = { y: 410, h: 42, bar: 36 };

// Motion, in seconds and art pixels. A blow lands IMPACT seconds into its event.
const IMPACT = 0.12;
/** The attacker holds its lunge until this time, then snaps back. */
const HOLD = 0.26;
const LUNGE = 36;
/** The shake of a fighter that was hit, one entry per 0.04 seconds after the blow. */
const SHAKE = [2, -2, 1, -1, 1, -1];
/** How long a damage number shows after the blow. */
const NUMBER_TIME = 0.8;
/** The eight neighbors, one art pixel away, for the outline around a damage number. */
const OUTLINE: [number, number][] = [
  [-2, -2], [0, -2], [2, -2], [-2, 0], [2, 0], [-2, 2], [0, 2], [2, 2],
];

/** The lunge of an attacker, in whole pixels: out quickly, a short hold, then straight back. */
function lungePx(t: number): number {
  if (t < IMPACT) return Math.round(LUNGE * (1 - (1 - t / IMPACT) ** 2));
  return t < HOLD ? LUNGE : 0;
}

/** The sideways shake of a fighter `a` seconds after it was hit, in whole pixels. */
function shakePx(a: number): number {
  if (a < 0) return 0;
  return SHAKE[Math.floor(a / 0.04)] ?? 0;
}

/** True on the frames where a fighter that was hit `a` seconds ago shows the solid flash color. */
function flashOn(a: number): boolean {
  return (a >= 0 && a < 0.06) || (a >= 0.1 && a < 0.14);
}

/** Breaks a line of log text into lines no wider than `w` in the 1 times font. */
function wrapLines(str: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && textWidth(test) > w) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

export class BattleScreen implements Screen {
  readonly battle: Battle;
  private queue: BattleEvent[] = [];
  private current: BattleEvent | null = null;
  private eventT = 0;
  private log: string[] = [];
  private menuIndex = 0;
  private shownKnightHp: number;
  private shownEnemyHp: number;
  private enemyGone = false;
  private knightGone = false;

  constructor(
    private readonly game: Game,
    private readonly mapEnemy: MapEnemy,
    ambush: boolean,
  ) {
    const run = game.run!;
    this.shownKnightHp = run.knight.hp;
    this.battle = new Battle(run.knight, mapEnemy.stats, ambush, game.rng);
    this.shownEnemyHp = this.battle.enemyHp;
    this.push(this.battle.begin());
  }

  private push(events: BattleEvent[]): void {
    this.queue.push(...events);
    if (!this.current) this.next();
  }

  private next(): void {
    // Finish the event that was showing.
    if (this.current) {
      if (this.current.anim === 'enemyDown') this.enemyGone = true;
      if (this.current.anim === 'knightDown' || this.current.anim === 'flee') this.knightGone = true;
    }
    this.current = this.queue.shift() ?? null;
    this.eventT = 0;
    if (this.current) {
      this.log.push(this.current.text);
      const sound = this.current.blocked ? 'block' : ANIM_SOUND[this.current.anim];
      if (sound) sfx.play(sound);
    }
  }

  /** True when all events have played and the player can pick an action. */
  private get inMenu(): boolean {
    return !this.current && this.battle.outcome === 'ongoing';
  }

  update(dt: number, pressed: Action[]): void {
    const k = this.game.run!.knight;
    const targetK = this.current ? this.current.knightHp : k.hp;
    const targetE = this.current ? this.current.enemyHp : this.battle.enemyHp;
    this.shownKnightHp += (targetK - this.shownKnightHp) * Math.min(1, dt * 10);
    this.shownEnemyHp += (targetE - this.shownEnemyHp) * Math.min(1, dt * 10);

    if (this.current) {
      this.eventT += dt;
      const confirm = pressed.includes('confirm');
      const isLast = this.queue.length === 0;
      const over = this.battle.outcome !== 'ongoing';
      if (isLast && over) {
        // The fight is over. Wait for the player before leaving.
        if (confirm && this.eventT > 0.35) {
          this.game.endBattle(this.battle, this.mapEnemy);
        }
        return;
      }
      if (this.eventT >= EVENT_TIME || (confirm && this.eventT >= MIN_EVENT_TIME)) this.next();
      return;
    }

    if (!this.inMenu) return;
    for (const a of pressed) {
      if (a === 'up') {
        this.menuIndex = (this.menuIndex + ACTIONS.length - 1) % ACTIONS.length;
        sfx.play('move');
      } else if (a === 'down') {
        this.menuIndex = (this.menuIndex + 1) % ACTIONS.length;
        sfx.play('move');
      }
      else if (a === 'confirm') {
        this.choose(ACTIONS[this.menuIndex]);
        return;
      } else if (a === '1' || a === '2' || a === '3' || a === '4') {
        this.menuIndex = Number(a) - 1;
        this.choose(ACTIONS[this.menuIndex]);
        return;
      }
    }
  }

  private choose(action: BattleAction): void {
    const k = this.game.run!.knight;
    if (action === 'potion' && k.potions <= 0) {
      this.log.push('You have no potions left.');
      sfx.play('deny');
      return;
    }
    if (action === 'potion' && k.hp >= maxHp(k)) {
      this.log.push('You are already at full health.');
      sfx.play('deny');
      return;
    }
    this.push(this.battle.act(action));
  }

  // Drawing

  private drawBackdrop(ctx: Ctx, high: boolean): void {
    const t = this.game.time;
    drawSprite(ctx, backdrop(high ? 'high' : 'hall'), 0, 0);
    // The flames, out of step with each other. The light they cast is part of the backdrop.
    const art = torchArt()[high ? 'high' : 'hall'];
    TORCHES[high ? 'high' : 'hall'].forEach((spot, i) => {
      const f = art.flames[(Math.floor(t / 0.13) + i * 2) % art.flames.length];
      drawSprite(ctx, f, fromPx(spot.x - Math.floor(f.w / 2)), fromPx(spot.y - f.h + 2));
    });
    fillPx(ctx, 0, LOG.y - 2, W, H - LOG.y + 2, C.bgDeep);
  }

  /** A ground shadow under the feet at x: a 50% core and a 25% rim around it, which do not overlap. */
  private drawShadow(ctx: Ctx, x: number, boss: boolean): void {
    const s = shadowArt()[boss ? 'boss' : 'normal'];
    const y = GROUND - 4;
    drawSprite(ctx, s.rim, snap(x), y, { center: true, alpha: 0.25 });
    drawSprite(ctx, s.core, snap(x), y, { center: true, alpha: 0.5 });
  }

  /**
   * A damage or heal number in the 2 times font with a 1 pixel dark outline, so it reads over a
   * sprite. It pops up, then rises in whole pixel steps; in its last frames it turns a tone darker,
   * then it is gone. No see-through steps, so the outline never shows through the digits.
   */
  private drawNumber(ctx: Ctx, str: string, x: number, y: number, a: number, color: string): void {
    if (a < 0 || a >= NUMBER_TIME) return;
    let dy: number;
    if (a < 0.04) dy = 2;
    else if (a < 0.08) dy = -3;
    else if (a < 0.12) dy = -1;
    else dy = -1 - Math.min(8, Math.floor((a - 0.12) / 0.07));
    const c = a < NUMBER_TIME - 0.12 ? color : darker(color);
    const o = { size: 34, bold: true, align: 'center' as const, baseline: 'middle' as const };
    const ny = y + fromPx(dy);
    for (const [ox, oy] of OUTLINE) text(ctx, str, x + ox, ny + oy, { ...o, color: C.outline });
    text(ctx, str, x, ny, { ...o, color: c, shadow: true });
  }

  render(ctx: Ctx): void {
    const e = this.battle.enemy;
    const t = this.game.time;
    const cur = this.current;
    const et = this.eventT;
    const kSize = spriteSize('knight', 'large');
    const eSize = spriteSize(e.kind, 'large');
    const knightTop = GROUND - kSize.h;
    const enemyTop = GROUND - eSize.h;

    this.drawBackdrop(ctx, e.boss);

    // Where the two fighters stand, with offsets from the current event, in whole pixels.
    let kx = KNIGHT_X;
    let ky = GROUND - kSize.h / 2;
    let ex = ENEMY_X;
    const ey = GROUND - eSize.h / 2;
    let knightAlpha = this.knightGone ? 0 : 1;
    let enemyAlpha = this.enemyGone ? 0 : 1;
    let knightTint: string | undefined;
    let enemyTint: string | undefined;
    let knightDir: 'left' | 'right' = 'right';
    let knightMoving = false;
    let dissolve = 0;
    // When the blow of the current event lands, or -1 when it is not a blow.
    let impact = -1;
    if (cur) {
      if (cur.anim === 'enemyHit') {
        const thorn = cur.source === 'thorn';
        impact = thorn ? 0 : IMPACT;
        if (!thorn) kx += fromPx(lungePx(et));
        ex += fromPx(shakePx(et - impact));
        if (flashOn(et - impact)) enemyTint = PAL.parch2;
      }
      if (cur.anim === 'knightHit') {
        impact = IMPACT;
        ex -= fromPx(lungePx(et));
        // A blow the guard caught shakes the knight by one pixel at most.
        const sh = shakePx(et - impact);
        kx += fromPx(cur.blocked ? Math.sign(sh) * Math.min(1, Math.abs(sh)) : sh);
        if (flashOn(et - impact)) knightTint = cur.blocked ? PAL.teal2 : PAL.red2;
      }
      // The wind up, and the boss's roar: the enemy flashes ember every other tenth of a second.
      if (cur.anim === 'windup' && et < 0.5 && Math.floor(et * 10) % 2 === 0) enemyTint = PAL.ember2;
      if (cur.anim === 'enemyDown') {
        if (et < 0.08) enemyTint = PAL.parch2;
        else dissolve = 1 + Math.floor((et - 0.08) / 0.13);
        if (dissolve > 3) enemyAlpha = 0;
      }
      if (cur.anim === 'knightDown') {
        const f = Math.min(1, et / 0.8);
        knightAlpha = 1 - Math.floor(f * 3) * 0.25;
        ky += fromPx(Math.floor(f * 4));
      }
      if (cur.anim === 'flee') {
        kx -= snap(Math.min(1, et / 0.5) * 340);
        knightDir = 'left';
        knightMoving = true;
      }
    }
    if (this.knightGone && this.battle.outcome === 'lost') {
      knightAlpha = 0.25;
      ky += fromPx(4);
    }

    // Shadows first, then the fighters standing on them.
    const enemyFeet = fromPx(-footOffset(e.kind));
    const knightFeet = fromPx(footOffset('knight')) * (knightDir === 'left' ? -1 : 1);
    // A fading fighter loses its shadow, so a see-through sprite never lies over a see-through shadow.
    if (enemyAlpha >= 1 && dissolve < 2) this.drawShadow(ctx, ex + enemyFeet, e.boss);
    if (knightAlpha >= 1) this.drawShadow(ctx, kx + knightFeet, false);
    if (enemyAlpha > 0) {
      if (dissolve > 0) drawSprite(ctx, dissolved(enemyFrame(e.kind, t), dissolve), snap(ex), snap(ey), { center: true, flip: true });
      else drawEnemy(ctx, e.kind, snap(ex), snap(ey), 'large', t, true, { alpha: enemyAlpha, tint: enemyTint });
    }
    if (knightAlpha > 0) {
      drawKnight(ctx, snap(kx), snap(ky), 'large', knightDir, t, knightMoving, { alpha: knightAlpha, tint: knightTint });
    }

    // Effects for the current event.
    if (cur) this.drawEffects(ctx, cur, kx, knightTop, enemyTop, impact);

    // Warnings above the fighters. They sit between the plates and the sprites' boxes.
    const pulse = Math.floor(t * 4) % 2;
    if (this.battle.charging && !this.enemyGone && this.battle.outcome === 'ongoing') {
      const mark = alertArt()[pulse];
      drawSprite(ctx, mark, ENEMY_X, enemyTop - 22, { center: true });
      text(ctx, 'Heavy blow coming!', ENEMY_X, enemyTop - 54, { size: 16, align: 'center', baseline: 'middle', color: pulse ? PAL.ember2 : PAL.ember1, shadow: true });
    }
    if (this.battle.riposte && this.battle.outcome === 'ongoing') {
      text(ctx, 'Strike back ready', KNIGHT_X, knightTop - 14, { size: 16, align: 'center', baseline: 'middle', color: C.xp, shadow: true });
    }

    this.drawPlates(ctx);
    this.drawLog(ctx);
    this.drawActions(ctx);
  }

  private drawEffects(ctx: Ctx, cur: BattleEvent, kx: number, knightTop: number, enemyTop: number, impact: number): void {
    const e = this.battle.enemy;
    const et = this.eventT;
    const numberY = (top: number, boss: boolean): number => top + (boss ? 40 : 24);
    // The barrier in front of the knight, for Guard and for a blow that the guard caught.
    const barrierAt = cur.anim === 'guard' ? 0 : cur.anim === 'knightHit' && cur.blocked ? impact : -1;
    if (barrierAt >= 0 && et >= barrierAt) {
      const a = et - barrierAt;
      const life = cur.anim === 'guard' ? 0.9 : 0.4;
      if (a < life) {
        const frames = barrierArt();
        const f = a < 0.06 ? frames[0] : frames[1 + (Math.floor(a / 0.12) % 2)];
        const fade = a < life - 0.15 ? 1 : a < life - 0.08 ? 0.5 : 0.25;
        drawSprite(ctx, f, kx + 64, GROUND - 70, { center: true, alpha: fade });
        const tw = sparkArt().teal;
        if (cur.anim === 'guard' && a > 0.06) {
          drawSprite(ctx, tw[Math.floor(a / 0.08) % 3], kx + 70, GROUND - 120, { center: true, alpha: fade });
          drawSprite(ctx, tw[(Math.floor(a / 0.08) + 1) % 3], kx + 70, GROUND - 20, { center: true, alpha: fade });
        }
      }
    }
    if (cur.anim === 'heal' || cur.anim === 'levelUp') {
      const heal = cur.anim === 'heal';
      // Plus signs (or gold twinkles) rise off the knight, each starting a little later.
      const spots: [number, number][] = [
        [-62, 0],
        [-42, 0.16],
        [50, 0.08],
        [70, 0.24],
      ];
      spots.forEach(([dx, start], i) => {
        const a = et - start;
        if (a < 0 || a > 0.7) return;
        const rise = fromPx(Math.floor(a / 0.03));
        const y = GROUND - 30 - (i % 2) * 16 - rise;
        const fade = a < 0.55 ? 1 : a < 0.63 ? 0.5 : 0.25;
        if (heal) drawSprite(ctx, plusArt(), KNIGHT_X + dx, y, { center: true, alpha: fade });
        else drawSprite(ctx, sparkArt().gold[Math.floor(a / 0.08) % 3], KNIGHT_X + dx, y, { center: true, alpha: fade });
      });
      // Twinkles on the knight's body.
      const tw = heal ? sparkArt().heal : sparkArt().gold;
      const glints: [number, number][] = [
        [-32, 76],
        [22, 58],
        [-6, 98],
      ];
      glints.forEach(([dx, dy], i) => {
        const a = et - i * 0.1;
        if (a < 0 || a > 0.6) return;
        const f = tw[[0, 1, 2, 1, 0][Math.floor(a / 0.06) % 5]];
        drawSprite(ctx, f, KNIGHT_X + dx, knightTop + dy, { center: true });
      });
    }
    // Damage and heal numbers.
    if (cur.amount !== undefined) {
      if (cur.anim === 'enemyHit') this.drawNumber(ctx, `-${cur.amount}`, ENEMY_X, numberY(enemyTop, e.boss), et - impact, PAL.gold1);
      else if (cur.anim === 'knightHit') this.drawNumber(ctx, `-${cur.amount}`, KNIGHT_X, numberY(knightTop, false), et - impact, cur.blocked ? PAL.teal2 : PAL.red2);
      else if (cur.anim === 'heal') this.drawNumber(ctx, `+${cur.amount}`, KNIGHT_X, numberY(knightTop, false), et, PAL.moss2);
    }
  }

  /** The two name plates: name and tag on top, then the health bar with the numbers beside it. */
  private drawPlates(ctx: Ctx): void {
    const k = this.game.run!.knight;
    const e = this.battle.enemy;
    const kMax = maxHp(k);
    const plate = (x: number, name: string, nameColor: string, tag: string, tagColor: string, hp: number, max: number, color: string): void => {
      const w = 308;
      panel(ctx, x, 12, w, 58);
      text(ctx, name, x + 14, 24, { size: 16, bold: true, baseline: 'top', color: nameColor });
      if (tag) text(ctx, tag, x + w - 14, 24, { size: 16, baseline: 'top', align: 'right', color: tagColor });
      bar(ctx, x + 14, 46, 192, 14, hp / max, color);
      text(ctx, `${Math.round(hp)} / ${max}`, x + w - 14, 53, { size: 16, baseline: 'middle', align: 'right', color: C.ink });
    };
    const kHp = this.shownKnightHp;
    plate(16, 'Knight', C.ink, `Level ${k.level}`, C.inkDim, kHp, kMax, kHp / kMax <= 0.3 ? C.ember : C.red);
    plate(W - 324, e.name, e.boss ? C.ember : C.ink, this.battle.enraged ? 'Enraged' : '', C.ember, this.shownEnemyHp, e.maxHp, e.boss ? C.moss : C.ember);
  }

  /**
   * The log: the last three lines, newest at the bottom and brightest, each wrapped to the panel.
   * The panel holds LOG_TEXT.max lines above the hint. The longest lines the rules write take two
   * lines each, so three entries always fit; if they ever did not, the oldest would be left out.
   */
  private drawLog(ctx: Ctx): void {
    const t = this.game.time;
    panel(ctx, LOG.x, LOG.y, LOG.w, LOG.h);
    const entries: string[][] = [];
    let total = 0;
    for (let i = this.log.length - 1; i >= 0 && entries.length < LOG_ENTRIES; i--) {
      const lines = wrapLines(this.log[i], LOG_TEXT.w);
      if (entries.length && total + lines.length > LOG_TEXT.max) break;
      entries.unshift(lines.slice(0, LOG_TEXT.max));
      total += Math.min(lines.length, LOG_TEXT.max);
    }
    const colors = [C.inkFaint, C.inkDim, C.ink];
    let y = LOG_TEXT.top;
    entries.forEach((lines, i) => {
      const color = colors[colors.length - entries.length + i];
      for (const line of lines) {
        text(ctx, line, LOG_TEXT.x, y, { size: 16, color });
        y += LOG_TEXT.line;
      }
      y += LOG_TEXT.gap;
    });
    const hintX = LOG.x + LOG.w - 16;
    const hintY = LOG.y + LOG.h - 10;
    const over = this.battle.outcome !== 'ongoing';
    if (this.current && over && this.queue.length === 0) {
      if (Math.sin(t * 5) > -0.3) text(ctx, hint('battleNext'), hintX, hintY, { size: 16, color: C.gold, align: 'right' });
    } else if (this.inMenu) {
      text(ctx, hint('battleMenu'), hintX, hintY, { size: 16, color: C.inkFaint, align: 'right' });
    }
  }

  /**
   * The action menu. While events play it is shown without the cursor and in muted colors.
   * A row that can not be picked is drawn in the faint color, both its label and its value.
   */
  private drawActions(ctx: Ctx): void {
    const k = this.game.run!.knight;
    panel(ctx, MENU.x, MENU.y, MENU.w, MENU.h);
    const active = this.inMenu;
    const rows = [
      { label: '1  Attack', right: `${attackPower(k)} dmg${this.battle.riposte ? ' x1.5' : ''}`, dim: false },
      { label: '2  Guard', right: `block ${Math.round(guardShare(k) * 100)}%`, dim: false },
      { label: '3  Potion', right: `x ${k.potions}`, dim: k.potions <= 0 || k.hp >= maxHp(k) },
      { label: '4  Flee', right: this.battle.canFlee() ? '' : 'no way out', dim: !this.battle.canFlee() },
    ];
    const x = MENU.x + 8;
    const w = MENU.w - 16;
    rows.forEach((row, i) => {
      const ry = MENU_ROWS.y + i * MENU_ROWS.h;
      const mid = ry + MENU_ROWS.bar / 2;
      const selected = active && i === this.menuIndex;
      if (selected) {
        fillRR(ctx, x, ry, w, MENU_ROWS.bar, 1, C.panelLight);
        drawSprite(ctx, cursorSprite(), x + 12, mid, { center: true });
      }
      const color = row.dim ? C.inkFaint : !active ? C.inkDim : selected ? C.gold : C.ink;
      const valueColor = row.dim ? C.inkFaint : !active ? C.inkFaint : selected ? C.gold : C.inkDim;
      text(ctx, row.label, x + 28, mid, { size: 16, color, baseline: 'middle', bold: selected });
      if (row.right) text(ctx, row.right, x + w - 12, mid, { size: 16, color: valueColor, baseline: 'middle', align: 'right' });
    });
  }
}
