// The floor map: the knight walks around, enemies patrol, and fights start from here.
import type { Action, Dir } from '../input';
import { DIR_VEC } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, TextOpts, W, fillRR, hash2, text, textWidth } from '../render/draw';
import { PX, drawSprite, fillPx, onGrid, snap, withAlpha } from '../render/pixel';
import { Cell, FloorArt, PILLAR_RISE, STAIRS_FRAME, TILE_PX, TORCH_FRAME, buildFloorArt, floorArtOwner, tileArt } from '../render/tiles';
import { drawEnemy, drawKnight } from '../render/sprites';
import { drawHud, HUD_H } from '../ui/hud';
import type { MapEnemy } from '../entities/enemies';
import { Floor, tileAt } from './floor';
import { COLS, FINAL_FLOOR, ROWS, TILE, Tile } from './tiles';
import { sfx } from '../audio/sfx';
import { hint } from '../ui/hints';
import { PauseScreen } from '../ui/pauseScreen';

const KNIGHT_STEP = 0.13;
const ENEMY_STEP = 0.32;
const ENEMY_PAUSE = 0.5;
const ENCOUNTER_TIME = 0.7;

// Light, in tiles: full light within FULL of the knight or a torch, none past REACH. DARKEST is
// the light level of a tile out of reach of both (see LIGHT_LEVELS in render/tiles.ts).
const KNIGHT_FULL = 3;
const KNIGHT_REACH = 10;
const TORCH_FULL = 1.5;
const TORCH_REACH = 4.5;
const DARKEST = 2;
/** Width in pixels of the dithered band at the edge of the light. */
const SEAM_PX = 4;
/** Ground shadows sit under the feet: 7 pixels below the middle of the tile, at 75%. */
const SHADOW_Y = 14;
const SHADOW_ALPHA = 0.75;
/** Hints wider than this go on two lines. */
const BANNER_TEXT_W = 720;

export class MapScreen implements Screen {
  x: number;
  y: number;
  private fromX: number;
  private fromY: number;
  private moveT = 1;
  private dir: Dir = 'down';
  private age = 0;
  private encounter: { enemy: MapEnemy; ambush: boolean; t: number } | null = null;
  /** Escape was pressed during a step. The pause menu opens when the step ends. */
  private pauseAsked = false;

  constructor(
    private readonly game: Game,
    readonly floor: Floor,
  ) {
    this.x = this.fromX = floor.start.x;
    this.y = this.fromY = floor.start.y;
    this.dir = 'right';
  }

  update(dt: number, pressed: Action[]): void {
    this.age += dt;
    // Escape asks for the pause menu. It opens once the knight stands still. The request is only
    // kept while a step is still going, so an encounter, an ambush or the stairs drop it.
    const askPause = this.pauseAsked || pressed.includes('cancel');
    this.pauseAsked = false;
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
      if (askPause) {
        this.game.screen = new PauseScreen(this.game, this);
        return;
      }
      const dir = this.game.input.heldDir();
      if (dir) this.tryMove(dir);
    } else {
      this.pauseAsked = askPause;
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
  //
  // The still tiles of the floor are laid out once (buildFloorArt in render/tiles.ts) at five
  // light levels. Each frame copies every tile from the level its light calls for, then draws the
  // stairs and torches, the characters back to front, and the overlays. Light is worked out per
  // tile: the torches' share once per floor, the knight's share each frame from where he is drawn.
  // The stairs, the torches and every character are drawn after the light, so they always read.

  private art: FloorArt | null = null;
  /** The tiles the art was built from, to notice a floor whose tiles were changed (tests do this). The art is also rebuilt if another map screen took over the shared canvases. */
  private artTiles = new Uint8Array(COLS * ROWS);
  private torches: { x: number; y: number }[] = [];
  private pillars: { x: number; y: number }[] = [];
  /** How bright each tile is from the torches alone, 0 to 1. */
  private torchLight = new Float32Array(COLS * ROWS);
  /** The light level of each tile this frame. */
  private light = new Uint8Array(COLS * ROWS);

  private px(tx: number): number {
    return tx * TILE + TILE / 2;
  }

  private py(ty: number): number {
    return HUD_H + ty * TILE + TILE / 2;
  }

  /** Builds the floor's tile art and torch light, once per floor (or again if its tiles changed). */
  private ensureArt(): FloorArt {
    const f = this.floor;
    if (this.art && floorArtOwner() === this && f.tiles.every((v, i) => v === this.artTiles[i])) return this.art;
    this.artTiles.set(f.tiles);
    const isWall = (x: number, y: number) => tileAt(f, x, y) === Tile.Wall;
    this.art = buildFloorArt(COLS, ROWS, isWall, (x, y) => hash2(x + f.num * 31, y), this);
    this.pillars = [];
    for (let i = 0; i < this.art.cells.length; i++) {
      if (this.art.cells[i] === Cell.Pillar) this.pillars.push({ x: i % COLS, y: Math.floor(i / COLS) });
    }
    // Torches on some wall faces, at the same spots as always.
    this.torches = [];
    for (let y = 0; y < ROWS - 1; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isWall(x, y) || isWall(x, y + 1)) continue;
        if (hash2(x * 7 + f.num, y * 13) < 0.82) continue;
        this.torches.push({ x, y });
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let best = 0;
        for (const t of this.torches) {
          // The flame hangs low on the face, so measure from near the bottom of its tile.
          const d = Math.hypot(x - t.x, (y - t.y - 0.4) * 1.1);
          best = Math.max(best, lightFall(d, TORCH_FULL, TORCH_REACH));
        }
        this.torchLight[y * COLS + x] = best;
      }
    }
    return this.art;
  }

  /** Works out the light level of every tile for a knight drawn at tile position (kx, ky). */
  private updateLight(kx: number, ky: number): void {
    const cells = this.art!.cells;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const b = Math.max(this.torchLight[i], lightFall(Math.hypot(x - kx, y - ky), KNIGHT_FULL, KNIGHT_REACH));
        // Whole ramp steps only (the even levels). The half levels are used for the edges.
        // The tops of walls are never lit fully: they stay a dark mass, so the light does not
        // show up as blocks in the solid rock between rooms.
        const level = 2 * Math.round((1 - b) * DARKEST);
        this.light[i] = cells[i] === Cell.Top ? Math.max(2, level) : level;
      }
    }
  }

  private drawTiles(ctx: Ctx, kx: number, ky: number): void {
    const art = this.ensureArt();
    this.updateLight(kx, ky);
    const light = this.light;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? -1 : light[y * COLS + x]);
    onGrid(ctx, (toX, toY) => {
      const ox = toX(0);
      const oy = toY(HUD_H);
      const copy = (level: number, sx: number, sy: number, w: number, h: number) =>
        ctx.drawImage(art.levels[level], sx, sy, w, h, ox + sx, oy + sy, w, h);
      // One copy per run of tiles in a row that share a light level.
      for (let y = 0; y < ROWS; y++) {
        let x = 0;
        while (x < COLS) {
          const level = light[y * COLS + x];
          let n = 1;
          while (x + n < COLS && light[y * COLS + x + n] === level) n++;
          copy(level, x * TILE_PX, y * TILE_PX, n * TILE_PX, TILE_PX);
          x += n;
        }
      }
      // Where a tile is a step darker than the one beside it, the edge of the light is a
      // dithered band (the half level between the two) along the darker tile's side.
      const S = SEAM_PX;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const level = light[y * COLS + x];
          if (level === 0) continue;
          const half = level - 1;
          const sx = x * TILE_PX;
          const sy = y * TILE_PX;
          if (at(x - 1, y) === level - 2) copy(half, sx, sy, S, TILE_PX);
          if (at(x + 1, y) === level - 2) copy(half, sx + TILE_PX - S, sy, S, TILE_PX);
          if (at(x, y - 1) === level - 2) copy(half, sx, sy, TILE_PX, S);
          if (at(x, y + 1) === level - 2) copy(half, sx, sy + TILE_PX - S, TILE_PX, S);
        }
      }
    });
    const t = this.game.time;
    if (this.floor.stairs) this.drawStairs(ctx, this.floor.stairs.x * TILE, HUD_H + this.floor.stairs.y * TILE, t);
    for (const torch of this.torches) {
      if (this.art!.cells[torch.y * COLS + torch.x] !== Cell.Pillar) this.drawTorch(ctx, torch.x, torch.y, t);
    }
  }

  private drawTorch(ctx: Ctx, x: number, y: number, t: number): void {
    const frames = tileArt().torch;
    // Each torch flickers on its own beat.
    const frame = Math.floor(t / TORCH_FRAME + x * 2 + y) % frames.length;
    drawSprite(ctx, frames[frame], x * TILE, HUD_H + y * TILE);
  }

  private drawStairs(ctx: Ctx, sx: number, sy: number, t: number): void {
    const frames = tileArt().stairs;
    drawSprite(ctx, frames[Math.floor(t / STAIRS_FRAME) % frames.length], sx, sy);
  }

  render(ctx: Ctx): void {
    const run = this.game.run;
    if (!run) return;
    const t = this.game.time;
    // The knight's drawn position, on the pixel grid.
    const kx = snap(this.px(this.fromX + (this.x - this.fromX) * this.moveT));
    const ky = snap(this.py(this.fromY + (this.y - this.fromY) * this.moveT));
    ctx.fillStyle = C.bgDeep;
    ctx.fillRect(0, HUD_H, W, H - HUD_H);
    this.drawTiles(ctx, (kx - TILE / 2) / TILE, (ky - HUD_H - TILE / 2) / TILE);

    // The characters, back to front by the row their feet are on.
    const ta = tileArt();
    const drawn: { y: number; draw: () => void }[] = [];
    for (const e of this.floor.enemies) {
      if (e.hidden) continue;
      const ex = snap(this.px(e.fromX + (e.x - e.fromX) * e.moveT));
      const ey = snap(this.py(e.fromY + (e.y - e.fromY) * e.moveT));
      const faceLeft = e.x < e.fromX || (e.moveT >= 1 && this.x < e.x);
      const fx = { alpha: e.dazed > 0 ? 0.5 : 1 };
      drawn.push({
        y: ey,
        draw: () => {
          if (e.stats.boss) {
            // The boss's 32 pixel box stands on its tile and reaches up into the tile above.
            drawSprite(ctx, ta.shadowBig, ex, ey + SHADOW_Y, { center: true, alpha: SHADOW_ALPHA * fx.alpha });
            drawEnemy(ctx, e.stats.kind, ex, ey - TILE / 2, 'small', t, faceLeft, fx);
          } else {
            drawSprite(ctx, ta.shadow, ex, ey + SHADOW_Y, { center: true, alpha: SHADOW_ALPHA * fx.alpha });
            drawEnemy(ctx, e.stats.kind, ex, ey, 'small', t + e.id, faceLeft, fx);
          }
        },
      });
    }
    // Pillars stand among the characters, so one in front covers whoever is behind it.
    for (const p of this.pillars) {
      drawn.push({
        y: this.py(p.y),
        draw: () => {
          drawSprite(ctx, ta.pillar[this.light[p.y * COLS + p.x]], p.x * TILE, HUD_H + p.y * TILE - PILLAR_RISE * PX);
          if (this.torches.some((o) => o.x === p.x && o.y === p.y)) this.drawTorch(ctx, p.x, p.y, t);
        },
      });
    }
    drawn.push({
      y: ky + 1,
      draw: () => {
        drawSprite(ctx, ta.shadow, kx, ky + SHADOW_Y, { center: true, alpha: SHADOW_ALPHA });
        drawKnight(ctx, kx, ky, 'small', this.dir, t, this.moveT < 1);
      },
    });
    drawn.sort((a, b) => a.y - b.y);
    for (const d of drawn) d.draw();

    drawHud(ctx, run.knight, run.floorNum);

    // Floor title and first hints. They fade out in 25% steps.
    if (this.age < 3.2 && !this.encounter) {
      withAlpha(ctx, (3.2 - this.age) / 0.8, () => {
        const title = run.floorNum >= FINAL_FLOOR ? 'Floor 3: The High Hall' : `Floor ${run.floorNum}`;
        text(ctx, title, W / 2, HUD_H + 60, { size: 34, bold: true, align: 'center', color: C.gold, shadow: true });
      });
    }
    if (run.floorNum === 1 && this.age < 9 && !this.encounter) {
      withAlpha(ctx, 9 - this.age, () => this.drawBanner(ctx, hint('mapMove')));
    } else if (run.floorNum >= FINAL_FLOOR && this.age < 9 && !this.encounter) {
      withAlpha(ctx, 9 - this.age, () => this.drawBanner(ctx, 'No stairs here. Beat the Ork to take the keep.'));
    }

    // The moment before a fight.
    if (this.encounter) {
      const p = this.encounter.t / ENCOUNTER_TIME;
      const e = this.encounter.enemy;
      const ex = this.px(e.x);
      // Just above the enemy's head: the boss's box is two tiles tall.
      const ey = this.py(e.y) - (e.stats.boss ? 52 : 20);
      // The mark hops up 4 pixels and back, in whole pixels.
      const hop = snap(Math.sin(Math.min(1, p * 3) * Math.PI) * 8);
      text(ctx, '!', ex, ey - hop, {
        size: 26,
        bold: true,
        align: 'center',
        color: this.encounter.ambush ? C.ember : C.gold,
        shadow: true,
      });
      if (this.encounter.ambush) {
        text(ctx, 'Ambush!', W / 2, H / 2, { size: 54, bold: true, align: 'center', color: C.ember, shadow: true });
      }
      // Dark bars close in from the top and bottom, in steps of 4 pixels.
      const cover = Math.max(0, (p - 0.35) / 0.65);
      const bar = Math.min(H / 2, Math.round(((H / 2) * cover) / 8) * 8);
      if (bar > 0) {
        fillPx(ctx, 0, 0, W, bar, C.bgDeep);
        fillPx(ctx, 0, H - bar, W, bar, C.bgDeep);
      }
    }
  }

  /** A hint along the bottom of the map: a dark see-through box (75%) in a thin gold frame, with one or two centered lines. */
  private drawBanner(ctx: Ctx, str: string): void {
    const o = { size: 14, align: 'center' as const, baseline: 'middle' as const };
    const lines = splitLines(str, BANNER_TEXT_W, o);
    const lineH = 22;
    const w = snap(Math.max(...lines.map((l) => textWidth(l, o))) + 28);
    const h = lines.length * lineH + 12;
    const x = snap(W / 2 - w / 2);
    const y = H - 8 - h;
    withAlpha(ctx, 0.75, () => fillRR(ctx, x, y, w, h, 1, C.bgDeep));
    // A 1 pixel dark gold frame with chamfered corners.
    fillPx(ctx, x + 2, y, w - 4, 2, C.goldDark);
    fillPx(ctx, x + 2, y + h - 2, w - 4, 2, C.goldDark);
    fillPx(ctx, x, y + 2, 2, h - 4, C.goldDark);
    fillPx(ctx, x + w - 2, y + 2, 2, h - 4, C.goldDark);
    lines.forEach((line, i) => text(ctx, line, W / 2, y + 6 + lineH / 2 + i * lineH, o));
  }
}

/** Light in the open, from 1 within `full` tiles down to 0 at `reach` tiles. */
function lightFall(d: number, full: number, reach: number): number {
  return Math.max(0, Math.min(1, (reach - d) / (reach - full)));
}

/** Splits a hint into lines no wider than maxW logical units, balanced so two lines come out about even. */
function splitLines(str: string, maxW: number, o: TextOpts): string[] {
  if (textWidth(str, o) <= maxW) return [str];
  const words = str.split(' ');
  let best: string[] = [str];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wMax = Math.max(textWidth(a, o), textWidth(b, o));
    if (wMax < bestW) {
      bestW = wMax;
      best = [a, b];
    }
  }
  return best;
}
