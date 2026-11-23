// The battle screen: draws the fight and turns key presses into battle actions.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, bar, drawMenu, ellipse, fillRR, panel, text, wrapText } from '../render/draw';
import { drawEnemy, drawKnight } from '../render/sprites';
import type { MapEnemy } from '../entities/enemies';
import { attackPower, guardShare, maxHp } from '../entities/knight';
import { Battle, BattleAction, BattleEvent } from './battle';

const EVENT_TIME = 1.05;
const MIN_EVENT_TIME = 0.18;
const ACTIONS: readonly BattleAction[] = ['attack', 'guard', 'potion', 'flee'];

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
  private age = 0;

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
    if (this.current) this.log.push(this.current.text);
  }

  /** True when all events have played and the player can pick an action. */
  private get inMenu(): boolean {
    return !this.current && this.battle.outcome === 'ongoing';
  }

  update(dt: number, pressed: Action[]): void {
    this.age += dt;
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
          this.game.endBattle(this.battle.outcome, this.mapEnemy);
        }
        return;
      }
      if (this.eventT >= EVENT_TIME || (confirm && this.eventT >= MIN_EVENT_TIME)) this.next();
      return;
    }

    if (!this.inMenu) return;
    for (const a of pressed) {
      if (a === 'up') this.menuIndex = (this.menuIndex + ACTIONS.length - 1) % ACTIONS.length;
      else if (a === 'down') this.menuIndex = (this.menuIndex + 1) % ACTIONS.length;
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
      return;
    }
    this.push(this.battle.act(action));
  }

  // Drawing

  private drawBackdrop(ctx: Ctx): void {
    const t = this.game.time;
    const g = ctx.createLinearGradient(0, 0, 0, 340);
    g.addColorStop(0, '#231814');
    g.addColorStop(1, '#3a2a21');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 340);
    // Brick lines on the back wall.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let row = 0; row < 8; row++) {
      const y = 70 + row * 34;
      ctx.fillRect(0, y, W, 2);
      for (let col = 0; col < 9; col++) {
        ctx.fillRect(col * 100 + (row % 2 ? 50 : 0), y, 2, 34);
      }
    }
    // Two torches.
    for (const tx of [120, 680]) {
      const flick = 1 + Math.sin(t * 9 + tx) * 0.07;
      const glow = ctx.createRadialGradient(tx, 150, 4, tx, 150, 190 * flick);
      glow.addColorStop(0, 'rgba(255, 179, 92, 0.34)');
      glow.addColorStop(1, 'rgba(255, 179, 92, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(tx - 200, -50, 400, 400);
      fillRR(ctx, tx - 4, 152, 8, 30, 2, '#5b4030');
      ellipse(ctx, tx, 142, 10 * flick, 17 * flick, C.ember);
      ellipse(ctx, tx, 146, 5, 9, '#ffd98a');
    }
    // Floor.
    const fg = ctx.createLinearGradient(0, 330, 0, 430);
    fg.addColorStop(0, '#6b5848');
    fg.addColorStop(1, '#4a3c32');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 330, W, 100);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let i = 0; i < 4; i++) ctx.fillRect(0, 352 + i * 24, W, 2);
    ctx.fillStyle = C.bgDeep;
    ctx.fillRect(0, 430, W, H - 430);
  }

  render(ctx: Ctx): void {
    const run = this.game.run!;
    const k = run.knight;
    const e = this.battle.enemy;
    const t = this.game.time;
    const cur = this.current;
    const p = cur ? Math.min(1, this.eventT / 0.35) : 0;
    const swing = Math.sin(p * Math.PI);

    this.drawBackdrop(ctx);

    // Where the two fighters stand, with offsets from the current animation.
    let kx = 215;
    let ky = 300;
    let ex = 585;
    let ey = e.boss ? 262 : 300;
    let knightAlpha = this.knightGone ? 0 : 1;
    let enemyAlpha = this.enemyGone ? 0 : 1;
    let enemyScale = 1;
    if (cur) {
      if (cur.anim === 'enemyHit' && cur.text.startsWith('Your Thorn') === false) kx += swing * 70;
      if (cur.anim === 'enemyHit') ex += Math.sin(this.eventT * 60) * 5 * (1 - p);
      if (cur.anim === 'knightHit') {
        ex -= swing * 70;
        kx += Math.sin(this.eventT * 60) * 5 * (1 - p);
      }
      if (cur.anim === 'windup') enemyScale = 1 + Math.sin(Math.min(1, this.eventT / 0.5) * Math.PI) * 0.12;
      if (cur.anim === 'enemyDown') {
        enemyAlpha = 1 - Math.min(1, this.eventT / 0.6);
        ey += Math.min(1, this.eventT / 0.6) * 20;
      }
      if (cur.anim === 'knightDown') {
        knightAlpha = 1 - Math.min(1, this.eventT / 0.8) * 0.75;
        ky += Math.min(1, this.eventT / 0.8) * 14;
      }
      if (cur.anim === 'flee') {
        kx -= Math.min(1, this.eventT / 0.5) * 320;
      }
    }
    if (this.knightGone && this.battle.outcome === 'lost') knightAlpha = 0.25;

    // Enemy
    const enemySize = (e.boss ? 250 : 150) * enemyScale;
    if (enemyAlpha > 0) {
      ctx.globalAlpha = enemyAlpha;
      drawEnemy(ctx, e.kind, ex, ey, enemySize, t, true);
      ctx.globalAlpha = 1;
    }
    // Knight
    if (knightAlpha > 0) {
      ctx.globalAlpha = knightAlpha;
      drawKnight(ctx, kx, ky, 150, 'right', t, false);
      ctx.globalAlpha = 1;
    }

    // Effects for the current event.
    if (cur) {
      if (cur.anim === 'guard') {
        ctx.beginPath();
        ctx.arc(kx + 30, ky, 80, -1.1, 1.1);
        ctx.strokeStyle = `rgba(121, 176, 166, ${0.9 * (1 - Math.min(1, this.eventT / 0.9))})`;
        ctx.lineWidth = 8;
        ctx.stroke();
      }
      if (cur.amount !== undefined && this.eventT < 0.9) {
        const rise = this.eventT * 50;
        const alpha = 1 - Math.max(0, (this.eventT - 0.5) / 0.4);
        ctx.globalAlpha = alpha;
        if (cur.anim === 'enemyHit') {
          text(ctx, `-${cur.amount}`, ex, ey - (e.boss ? 150 : 90) - rise, { size: 34, bold: true, align: 'center', color: C.gold, shadow: true });
        } else if (cur.anim === 'knightHit') {
          text(ctx, `-${cur.amount}`, 215, 210 - rise, { size: 34, bold: true, align: 'center', color: C.ember, shadow: true });
        } else if (cur.anim === 'heal') {
          text(ctx, `+${cur.amount}`, 215, 210 - rise, { size: 34, bold: true, align: 'center', color: C.moss, shadow: true });
        }
        ctx.globalAlpha = 1;
      }
    }

    // Warnings above the fighters.
    if (this.battle.charging && !this.enemyGone && this.battle.outcome === 'ongoing') {
      const pulse = 0.7 + Math.sin(t * 8) * 0.3;
      ctx.globalAlpha = pulse;
      text(ctx, 'Heavy blow coming!', ex, e.boss ? 108 : 190, { size: 18, bold: true, align: 'center', color: C.ember, shadow: true });
      ctx.globalAlpha = 1;
    }
    if (this.battle.riposte && this.battle.outcome === 'ongoing') {
      text(ctx, 'Strike back ready', 215, 196, { size: 15, bold: true, align: 'center', color: C.xp, shadow: true });
    }

    // Name plates
    panel(ctx, 20, 16, 300, 64);
    text(ctx, `Knight`, 36, 42, { size: 18, bold: true });
    text(ctx, `Level ${k.level}`, 304, 42, { size: 14, color: C.inkDim, align: 'right' });
    const kMax = maxHp(k);
    bar(ctx, 36, 52, 268, 16, this.shownKnightHp / kMax, this.shownKnightHp / kMax <= 0.3 ? C.ember : C.red);
    text(ctx, `${Math.round(this.shownKnightHp)} / ${kMax}`, 170, 60.5, { size: 12, bold: true, align: 'center', baseline: 'middle', shadow: true });

    panel(ctx, W - 320, 16, 300, 64);
    text(ctx, e.name, W - 304, 42, { size: 18, bold: true, color: e.boss ? C.ember : C.ink });
    if (this.battle.enraged) text(ctx, 'Enraged', W - 36, 42, { size: 14, color: C.ember, align: 'right', bold: true });
    bar(ctx, W - 304, 52, 268, 16, this.shownEnemyHp / e.maxHp, e.boss ? C.moss : C.ember);
    text(ctx, `${Math.round(this.shownEnemyHp)} / ${e.maxHp}`, W - 170, 60.5, { size: 12, bold: true, align: 'center', baseline: 'middle', shadow: true });

    // Log
    panel(ctx, 20, 440, 480, 144);
    const lines = this.log.slice(-3);
    let ly = 472;
    lines.forEach((line, i) => {
      const latest = i === lines.length - 1;
      ly = wrapText(ctx, line, 40, ly, 440, latest ? 24 : 20, {
        size: latest ? 18 : 14,
        color: latest ? C.ink : C.inkFaint,
      });
      ly += 6;
    });
    const over = this.battle.outcome !== 'ongoing';
    if (cur && over && this.queue.length === 0) {
      if (Math.sin(t * 5) > -0.3) text(ctx, 'Press Enter to go on', 484, 572, { size: 13, color: C.gold, align: 'right' });
    }

    // Menu
    panel(ctx, 515, 440, 265, 144);
    const active = this.inMenu;
    const rows = [
      { label: '1  Attack', right: `${attackPower(k)} dmg${this.battle.riposte ? ' x1.5' : ''}` },
      { label: '2  Guard', right: `block ${Math.round(guardShare(k) * 100)}%` },
      { label: '3  Potion', right: `x ${k.potions}`, dim: k.potions <= 0 },
      { label: '4  Flee', right: this.battle.canFlee() ? '' : 'no way out', dim: !this.battle.canFlee() },
    ];
    ctx.globalAlpha = active ? 1 : 0.45;
    drawMenu(ctx, rows, active ? this.menuIndex : -1, 525, 450, 245, 32, 16);
    ctx.globalAlpha = 1;
    if (active && this.age % 1 < 2) {
      text(ctx, 'W and S to choose, Enter to pick', 484, 572, { size: 13, color: C.inkFaint, align: 'right' });
    }
  }
}
