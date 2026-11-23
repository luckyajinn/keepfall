// The floor map: the knight walks around, enemies patrol, and fights start from here.
import type { Action, Dir } from '../input';
import { DIR_VEC } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, fillRR, hash2, text } from '../render/draw';
import { drawEnemy, drawKnight } from '../render/sprites';
import { drawHud, HUD_H } from '../ui/hud';
import type { MapEnemy } from '../entities/enemies';
import { Floor, tileAt } from './floor';
import { COLS, FINAL_FLOOR, ROWS, TILE, Tile } from './tiles';
import { sfx } from '../audio/sfx';

const KNIGHT_STEP = 0.13;
const ENEMY_STEP = 0.32;
const ENEMY_PAUSE = 0.5;
const ENCOUNTER_TIME = 0.7;

export class MapScreen implements Screen {
  x: number;
  y: number;
  private fromX: number;
  private fromY: number;
  private moveT = 1;
  private dir: Dir = 'down';
  private age = 0;
  private encounter: { enemy: MapEnemy; ambush: boolean; t: number } | null = null;

  constructor(
    private readonly game: Game,
    readonly floor: Floor,
  ) {
    this.x = this.fromX = floor.start.x;
    this.y = this.fromY = floor.start.y;
    this.dir = 'right';
  }

  update(dt: number, _pressed: Action[]): void {
    this.age += dt;
    if (this.encounter) {
      this.encounter.t += dt;
      if (this.encounter.t >= ENCOUNTER_TIME) {
        const { enemy, ambush } = this.encounter;
        this.encounter = null;
        this.game.startBattle(enemy, ambush);
      }
      return;
    }

    this.updateEnemies(dt);
    if (this.encounter) return;

    if (this.moveT < 1) {
      this.moveT += dt / KNIGHT_STEP;
      if (this.moveT >= 1) {
        this.moveT = 1;
        if (this.arrived()) return;
      }
    }
    if (this.moveT >= 1) {
      // Checked every frame the knight stands still, so a second ambusher
      // next to the same tile still jumps out when the map comes back after a fight.
      if (this.checkAmbush()) return;
      const dir = this.game.input.heldDir();
      if (dir) this.tryMove(dir);
    }
  }

  private enemyAt(x: number, y: number): MapEnemy | undefined {
    return this.floor.enemies.find((e) => e.x === x && e.y === y);
  }

  private tryMove(dir: Dir): void {
    this.dir = dir;
    const v = DIR_VEC[dir];
    const nx = this.x + v.x;
    const ny = this.y + v.y;
    if (tileAt(this.floor, nx, ny) === Tile.Wall) return;
    const enemy = this.enemyAt(nx, ny);
    if (enemy) {
      // Touching an enemy starts a fight. A dazed one just blocks the way for a moment.
      // A hidden one is never walked onto: stepping into it springs its ambush.
      if (enemy.hidden) this.ambush(enemy);
      else if (enemy.dazed <= 0) this.startEncounter(enemy, false);
      return;
    }
    this.fromX = this.x;
    this.fromY = this.y;
    this.x = nx;
    this.y = ny;
    this.moveT = 0;
    sfx.play('step');
  }

  /** Runs when the knight finishes a step. Returns true if something took over the screen. */
  private arrived(): boolean {
    if (tileAt(this.floor, this.x, this.y) === Tile.Stairs) {
      this.game.floorCleared();
      return true;
    }
    return false;
  }

  /** A hidden enemy next to the standing knight jumps out, one at a time. Returns true if one did. */
  private checkAmbush(): boolean {
    const ambusher = this.floor.enemies.find((e) => e.hidden && Math.abs(e.x - this.x) + Math.abs(e.y - this.y) === 1);
    if (!ambusher) return false;
    this.ambush(ambusher);
    return true;
  }

  private ambush(enemy: MapEnemy): void {
    enemy.hidden = false;
    this.startEncounter(enemy, true);
  }

  private startEncounter(enemy: MapEnemy, ambush: boolean): void {
    this.encounter = { enemy, ambush, t: 0 };
    sfx.play(ambush ? 'ambush' : 'encounter');
  }

  private updateEnemies(dt: number): void {
    for (const e of this.floor.enemies) {
      if (e.dazed > 0) {
        e.dazed -= dt;
        continue;
      }
      if (e.hidden || !e.patrol) continue;
      if (e.moveT < 1) {
        e.moveT = Math.min(1, e.moveT + dt / ENEMY_STEP);
        continue;
      }
      e.wait -= dt;
      if (e.wait > 0) continue;
      const p = e.patrol;
      const tx = p.toB ? p.bx : p.ax;
      const ty = p.toB ? p.by : p.ay;
      if (e.x === tx && e.y === ty) {
        p.toB = !p.toB;
        e.wait = ENEMY_PAUSE;
        continue;
      }
      const nx = e.x + Math.sign(tx - e.x);
      const ny = e.y + Math.sign(ty - e.y);
      if (nx === this.x && ny === this.y) {
        // The patrol walked into the knight. That counts as a touch.
        this.startEncounter(e, false);
        return;
      }
      if (this.floor.enemies.some((o) => o !== e && o.x === nx && o.y === ny)) {
        e.wait = ENEMY_PAUSE;
        continue;
      }
      e.fromX = e.x;
      e.fromY = e.y;
      e.x = nx;
      e.y = ny;
      e.moveT = 0;
      e.wait = 0.12;
    }
  }

  // Drawing

  private px(tx: number): number {
    return tx * TILE + TILE / 2;
  }

  private py(ty: number): number {
    return HUD_H + ty * TILE + TILE / 2;
  }

  private drawTiles(ctx: Ctx): void {
    const f = this.floor;
    const t = this.game.time;
    ctx.fillStyle = C.wall;
    ctx.fillRect(0, HUD_H, W, H - HUD_H);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = tileAt(f, x, y);
        const sx = x * TILE;
        const sy = HUD_H + y * TILE;
        const h = hash2(x + f.num * 31, y);
        if (tile === Tile.Wall) {
          if (tileAt(f, x, y + 1) !== Tile.Wall) {
            // The front face of a wall, seen from above.
            ctx.fillStyle = C.wallFace;
            ctx.fillRect(sx, sy + 8, TILE, TILE - 8);
            ctx.fillStyle = '#54402f';
            ctx.fillRect(sx, sy + 8, TILE, 3);
            ctx.fillStyle = C.wallFaceLine;
            ctx.fillRect(sx, sy + 19, TILE, 1.5);
            ctx.fillRect(sx + (h > 0.5 ? 10 : 20), sy + 11, 1.5, 8);
            ctx.fillRect(sx + (h > 0.5 ? 22 : 6), sy + 20.5, 1.5, 11.5);
          }
          continue;
        }
        ctx.fillStyle = h > 0.5 ? C.floorA : C.floorB;
        ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
        ctx.fillRect(sx + TILE - 1, sy, 1, TILE);
        if (h > 0.88) {
          ctx.fillStyle = C.floorCrack;
          ctx.fillRect(sx + 8, sy + 12, 9, 1.5);
          ctx.fillRect(sx + 16, sy + 13, 1.5, 7);
        }
        if (tileAt(f, x, y - 1) === Tile.Wall) {
          const g = ctx.createLinearGradient(0, sy, 0, sy + 12);
          g.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(sx, sy, TILE, 12);
        }
        if (tile === Tile.Stairs) this.drawStairs(ctx, sx, sy, t);
      }
    }
    // Torches on some wall faces.
    for (let y = 0; y < ROWS - 1; y++) {
      for (let x = 0; x < COLS; x++) {
        if (tileAt(f, x, y) !== Tile.Wall || tileAt(f, x, y + 1) === Tile.Wall) continue;
        if (hash2(x * 7 + f.num, y * 13) < 0.82) continue;
        const cx = x * TILE + TILE / 2;
        const cy = HUD_H + y * TILE + 17;
        const flick = 1 + Math.sin(t * 9 + x * 3) * 0.08 + Math.sin(t * 23 + y) * 0.04;
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 70 * flick);
        g.addColorStop(0, 'rgba(255, 179, 92, 0.30)');
        g.addColorStop(1, 'rgba(255, 179, 92, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 80, cy - 80, 160, 160);
        ctx.fillStyle = '#5b4030';
        ctx.fillRect(cx - 1.5, cy, 3, 9);
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, 3.5 * flick, 5.5 * flick, 0, 0, Math.PI * 2);
        ctx.fillStyle = C.ember;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy - 1, 1.8, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd98a';
        ctx.fill();
      }
    }
  }

  private drawStairs(ctx: Ctx, sx: number, sy: number, t: number): void {
    ctx.fillStyle = '#2a1d17';
    ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
    const shades = ['#8a6a3c', '#a78045', '#c4974d', '#e0b057'];
    shades.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(sx + 4 + i * 2, sy + 22 - i * 6, TILE - 8 - i * 4, 5);
    });
    ctx.strokeStyle = `rgba(242, 184, 75, ${0.55 + Math.sin(t * 3) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
  }

  render(ctx: Ctx): void {
    const run = this.game.run;
    if (!run) return;
    const t = this.game.time;
    this.drawTiles(ctx);

    // Enemies, drawn back to front.
    const enemies = this.floor.enemies.filter((e) => !e.hidden).sort((a, b) => a.y - b.y);
    for (const e of enemies) {
      const ex = this.px(e.fromX + (e.x - e.fromX) * e.moveT);
      const ey = this.py(e.fromY + (e.y - e.fromY) * e.moveT);
      const faceLeft = e.x < e.fromX || (e.moveT >= 1 && this.x < e.x);
      ctx.globalAlpha = e.dazed > 0 ? 0.45 : 1;
      if (e.stats.boss) {
        drawEnemy(ctx, e.stats.kind, ex, ey - 14, 68, t, faceLeft);
      } else {
        drawEnemy(ctx, e.stats.kind, ex, ey - 2, 30, t + e.id, faceLeft);
      }
      ctx.globalAlpha = 1;
    }

    // The knight.
    const kx = this.px(this.fromX + (this.x - this.fromX) * this.moveT);
    const ky = this.py(this.fromY + (this.y - this.fromY) * this.moveT);
    drawKnight(ctx, kx, ky - 3, 30, this.dir, t, this.moveT < 1);

    // Soft darkness away from the knight.
    const g = ctx.createRadialGradient(kx, ky, 90, kx, ky, 460);
    g.addColorStop(0, 'rgba(12, 7, 5, 0)');
    g.addColorStop(1, 'rgba(12, 7, 5, 0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, HUD_H, W, H - HUD_H);

    drawHud(ctx, run.knight, run.floorNum);

    // Floor title and first hints.
    if (this.age < 3.2 && !this.encounter) {
      const alpha = Math.min(1, (3.2 - this.age) / 0.8);
      ctx.globalAlpha = alpha;
      const title = run.floorNum >= FINAL_FLOOR ? 'Floor 3: The High Hall' : `Floor ${run.floorNum}`;
      text(ctx, title, W / 2, HUD_H + 60, { size: 34, bold: true, align: 'center', color: C.gold, shadow: true });
      ctx.globalAlpha = 1;
    }
    if (run.floorNum === 1 && this.age < 9 && !this.encounter) {
      const alpha = Math.min(1, (9 - this.age) / 1);
      ctx.globalAlpha = alpha * 0.92;
      fillRR(ctx, W / 2 - 300, H - 44, 600, 32, 8, 'rgba(20, 13, 10, 0.85)');
      text(ctx, 'Move with W A S D. Walk into an enemy to fight it, or go around. Find the stairs.', W / 2, H - 27, {
        size: 14,
        align: 'center',
        baseline: 'middle',
      });
      ctx.globalAlpha = 1;
    } else if (run.floorNum >= FINAL_FLOOR && this.age < 9 && !this.encounter) {
      const alpha = Math.min(1, (9 - this.age) / 1);
      ctx.globalAlpha = alpha * 0.92;
      fillRR(ctx, W / 2 - 220, H - 44, 440, 32, 8, 'rgba(20, 13, 10, 0.85)');
      text(ctx, 'No stairs here. Beat the Ork to take the keep.', W / 2, H - 27, { size: 14, align: 'center', baseline: 'middle' });
      ctx.globalAlpha = 1;
    }

    // The moment before a fight.
    if (this.encounter) {
      const p = this.encounter.t / ENCOUNTER_TIME;
      const e = this.encounter.enemy;
      const ex = this.px(e.x);
      const ey = this.py(e.y) - (e.stats.boss ? 54 : 24);
      text(ctx, '!', ex, ey - Math.sin(Math.min(1, p * 3) * Math.PI) * 6, {
        size: 26,
        bold: true,
        align: 'center',
        color: this.encounter.ambush ? C.ember : C.gold,
        shadow: true,
      });
      if (this.encounter.ambush) {
        text(ctx, 'Ambush!', W / 2, H / 2, { size: 54, bold: true, align: 'center', color: C.ember, shadow: true });
      }
      // Dark bars close in from the top and bottom.
      const cover = Math.max(0, (p - 0.35) / 0.65);
      ctx.fillStyle = C.bgDeep;
      ctx.fillRect(0, 0, W, (H / 2) * cover);
      ctx.fillRect(0, H - (H / 2) * cover, W, (H / 2) * cover);
    }
  }
}
