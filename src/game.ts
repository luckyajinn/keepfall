// Run state and switching between screens.
import type { Action } from './input';
import { Input } from './input';
import { Rng } from './rng';
import type { Ctx } from './render/draw';
import { Knight, newKnight } from './entities/knight';
import type { MapEnemy } from './entities/enemies';
import type { Outcome } from './battle/battle';
import { BattleScreen } from './battle/battleScreen';
import { generateFloor } from './map/floor';
import { MapScreen } from './map/mapScreen';
import { FINAL_FLOOR } from './map/tiles';
import { giveFloorReward } from './items/rewards';
import { VendorCounts, newVendorCounts } from './items/vendor';
import { SaveData, loadSave, writeSave } from './meta/save';
import { EndScreen, HelpScreen, RewardScreen, ShopScreen, StartScreen, VendorScreen } from './ui/screens';
import { sfx } from './audio/sfx';
import { C } from './render/colors';
import { H, W, fillRR, text } from './render/draw';

export interface Screen {
  update(dt: number, pressed: Action[]): void;
  render(ctx: Ctx): void;
}

export interface RunState {
  knight: Knight;
  floorNum: number;
  /** Each floor is built from this and its floor number, so fights and rewards can't change the maps. */
  seed: number;
  kills: number;
  startGold: number;
  /** Gold spent at the vendor, so the end screen can show gold earned. */
  spent: number;
  vendorCounts: VendorCounts;
}

export class Game {
  readonly input: Input;
  readonly rng: Rng;
  save: SaveData;
  screen: Screen;
  run: RunState | null = null;
  map: MapScreen | null = null;
  /** Seconds since the game started. Used for animations. */
  time = 0;
  /** A short message shown over any screen, such as "Sound off". */
  private toast: { text: string; until: number } | null = null;

  constructor(input: Input, seed: number) {
    this.input = input;
    this.rng = new Rng(seed);
    this.save = loadSave();
    this.screen = new StartScreen(this);
  }

  update(dt: number): void {
    this.time += dt;
    const pressed = this.input.take().filter((action) => {
      if (action !== 'mute') return true;
      this.toast = { text: sfx.toggleMute() ? 'Sound off' : 'Sound on', until: this.time + 1.6 };
      return false;
    });
    if (pressed.length <= 1) {
      this.screen.update(dt, pressed);
      return;
    }
    // Several keys landed in one frame. Handle them one at a time, in order,
    // so a key pressed right after Enter still reaches the right screen.
    pressed.forEach((action, i) => this.screen.update(i === 0 ? dt : 0, [action]));
  }

  render(ctx: Ctx): void {
    this.screen.render(ctx);
    if (this.toast && this.time < this.toast.until) {
      ctx.globalAlpha = Math.min(1, (this.toast.until - this.time) / 0.4);
      fillRR(ctx, W / 2 - 70, H - 42, 140, 34, 8, 'rgba(20, 13, 10, 0.92)');
      text(ctx, this.toast.text, W / 2, H - 24, { size: 16, bold: true, align: 'center', baseline: 'middle', color: C.gold });
      ctx.globalAlpha = 1;
    }
  }

  showStart(): void {
    this.screen = new StartScreen(this);
  }

  showHelp(): void {
    this.screen = new HelpScreen(this);
  }

  showShop(): void {
    this.screen = new ShopScreen(this);
  }

  startRun(): void {
    const knight = newKnight(this.save);
    const seed = this.rng.int(0, 0xffffffff);
    this.run = { knight, floorNum: 1, seed, kills: 0, startGold: knight.gold, spent: 0, vendorCounts: newVendorCounts() };
    this.enterFloor(1);
  }

  private enterFloor(num: number): void {
    if (!this.run) return;
    this.run.floorNum = num;
    // Mix the run seed and floor number (the murmur3 finish step), so each floor gets an unrelated seed.
    // A plain run seed + num would give run 7 floor 2 the same map as run 8 floor 1. And Rng moves its
    // seed by a fixed step on each draw, so two seeds a few steps apart would share most of a stream.
    let h = this.run.seed ^ Math.imul(num, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    this.map = new MapScreen(this, generateFloor(num, new Rng(h)));
    this.screen = this.map;
  }

  startBattle(enemy: MapEnemy, ambush: boolean): void {
    this.screen = new BattleScreen(this, enemy, ambush);
  }

  endBattle(outcome: Outcome, enemy: MapEnemy): void {
    if (!this.run || !this.map) return;
    if (outcome === 'lost') {
      this.endRun(false, enemy);
      return;
    }
    if (outcome === 'won') {
      this.run.kills++;
      const list = this.map.floor.enemies;
      const i = list.indexOf(enemy);
      if (i >= 0) list.splice(i, 1);
      if (enemy.stats.boss) {
        this.endRun(true);
        return;
      }
    } else if (outcome === 'fled') {
      // The enemy stays on the map. It is dazed for a moment so the knight can get away.
      enemy.hidden = false;
      enemy.dazed = 3;
    }
    this.screen = this.map;
  }

  floorCleared(): void {
    if (!this.run) return;
    const reward = giveFloorReward(this.run.knight, this.rng);
    sfx.play('stairs');
    this.screen = new RewardScreen(this, reward, this.run.floorNum);
  }

  showVendor(): void {
    this.screen = new VendorScreen(this);
  }

  nextFloor(): void {
    if (!this.run) return;
    this.enterFloor(Math.min(FINAL_FLOOR, this.run.floorNum + 1));
  }

  /** `foe` is the enemy that beat the knight, when the run was lost. */
  private endRun(won: boolean, foe?: MapEnemy): void {
    const run = this.run;
    if (!run) return;
    const k = run.knight;
    // Vendor spending lowers the gold carried, so count it back in for "earned".
    const earned = k.gold - run.startGold + run.spent;
    this.save.gold = k.gold;
    this.save.runs++;
    if (won) this.save.wins++;
    this.save.bestFloor = Math.max(this.save.bestFloor, run.floorNum);
    writeSave(this.save);
    this.screen = new EndScreen(this, {
      won,
      floorNum: run.floorNum,
      level: k.level,
      kills: run.kills,
      goldEarned: earned,
      goldSaved: k.gold,
      foeKind: foe?.stats.kind,
      foeName: foe?.stats.name,
    });
    this.run = null;
    this.map = null;
  }
}
