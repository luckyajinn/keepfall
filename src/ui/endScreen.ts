// The win and lose screens.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, panel, text } from '../render/draw';
import { drawSprite, fillPx, fromPx } from '../render/pixel';
import { drawEnemy, drawIcon, drawKnight, spriteSize } from '../render/sprites';
import type { EnemyKind } from '../entities/enemies';
import { sfx } from '../audio/sfx';
import { nightSky } from './common';
import { hint } from './hints';
import { STAGE_FLOOR, STAGE_H, STAGE_W, stage } from './titleArt';

export interface RunSummary {
  won: boolean;
  floorNum: number;
  level: number;
  kills: number;
  goldEarned: number;
  goldSaved: number;
  /** The enemy that beat the knight. Only set when the run was lost. */
  foeKind?: EnemyKind;
  foeName?: string;
  /** True when the player gave up the run. It counts as a loss with no enemy. */
  gaveUp?: boolean;
  /** Seconds played in the run. */
  seconds: number;
  potionsUsed: number;
  /** Health the knight lost in fights, after Guard. */
  damageTaken: number;
  /** The run's seed. Each floor's layout is built from it. */
  seed: number;
}

/** Whole minutes and seconds, such as "9:42". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "A Cellar Rat", "An ...", or the boss's own name. */
function foeTitle(kind: EnemyKind, name: string): string {
  if (kind === 'boss') return name;
  return `${/^[aeiou]/i.test(name) ? 'An' : 'A'} ${name}`;
}

export class EndScreen implements Screen {
  private age = 0;

  constructor(
    private readonly game: Game,
    private readonly sum: RunSummary,
  ) {
    if (sum.won) sfx.play('win');
  }

  update(dt: number, pressed: Action[]): void {
    this.age += dt;
    if (this.age > 0.6 && pressed.includes('confirm')) this.game.showShop();
  }

  render(ctx: Ctx): void {
    const s = this.sum;
    const t = this.game.time;
    if (s.won) {
      // The title backdrop, a step deeper into the night so the panel stands out.
      nightSky(ctx, t, true);
    } else {
      fillPx(ctx, 0, 0, W, H, C.bgDeep);
    }
    const top = 24;
    panel(ctx, 96, top, 608, 552);

    // The title, the line under it, and the picture in its little scene.
    const title = s.won ? 'The keep is yours!' : s.gaveUp ? 'You turned back' : 'You have fallen';
    const line = s.won
      ? 'Mogrum the Ork is beaten and the hall is quiet.'
      : s.gaveUp
        ? `You left the keep from floor ${s.floorNum}. Your gold is safe.`
        : `The keep holds, for now. You reached floor ${s.floorNum}.`;
    text(ctx, title, W / 2, top + 48, { size: 40, bold: true, align: 'center', color: s.won ? C.gold : C.ember, shadow: true });
    text(ctx, line, W / 2, top + 74, { size: 16, align: 'center', color: C.inkDim });

    const scene = stage(s.won ? 'win' : s.gaveUp ? 'gaveUp' : 'lose');
    const sx = W / 2 - fromPx(STAGE_W) / 2;
    const sy = top + 88;
    drawSprite(ctx, scene, sx, sy);
    // Every picture stands on the floor of the scene: the bottom of its box on the same line.
    const ground = sy + fromPx(STAGE_H - 2 - STAGE_FLOOR + 6);
    if (s.won) {
      drawKnight(ctx, W / 2, ground - spriteSize('knight', 'large').h / 2, 'large', 'down', t, false);
    } else if (s.gaveUp) {
      // The knight walks away, seen from behind, out through the door.
      drawKnight(ctx, W / 2, ground - spriteSize('knight', 'large').h / 2, 'large', 'up', t, false);
    } else if (s.foeKind) {
      // Every enemy at its large size, the boss too: his 96 pixels fill the scene from floor to top.
      drawEnemy(ctx, s.foeKind, W / 2, ground - spriteSize(s.foeKind, 'large').h / 2, 'large', t, false);
      if (s.foeName) {
        text(ctx, `${foeTitle(s.foeKind, s.foeName)} got the better of you.`, W / 2, sy + fromPx(STAGE_H) + 22, { size: 15, align: 'center', color: C.inkDim });
      }
    }

    // Two columns of run numbers, then the gold saved across the whole panel.
    const columns: [string, string][][] = [
      [
        ['Level reached', `${s.level}`],
        ['Enemies beaten', `${s.kills}`],
        ['Gold earned', `${s.goldEarned}`],
      ],
      [
        ['Time', formatTime(s.seconds)],
        ['Potions used', `${s.potionsUsed}`],
        ['Damage taken', `${s.damageTaken}`],
      ],
    ];
    const statsY = sy + fromPx(STAGE_H) + 52;
    columns.forEach((rows, col) => {
      const x = col === 0 ? 136 : 424;
      rows.forEach(([label, value], i) => {
        const y = statsY + i * 24;
        text(ctx, label, x, y, { size: 17 });
        text(ctx, value, x + 240, y, { size: 17, align: 'right', color: C.ink });
      });
    });
    // The gold saved, on a lighter band with a coin.
    const gy = statsY + 3 * 24 + 4;
    fillPx(ctx, 120, gy, 560, 28, C.panelLight);
    fillPx(ctx, 120, gy + 26, 560, 2, C.outline);
    drawIcon(ctx, 'coin', 140, gy + 13, 'small');
    text(ctx, 'Gold saved for the shop', 156, gy + 14, { size: 18, color: C.gold, bold: true, baseline: 'middle' });
    text(ctx, `${s.goldSaved}`, 664, gy + 14, { size: 18, align: 'right', color: C.gold, bold: true, baseline: 'middle' });
    text(ctx, `Run seed ${s.seed}`, W / 2, gy + 52, { size: 12, align: 'center', color: C.inkFaint });
    if (Math.sin(t * 5) > -0.3) {
      text(ctx, hint('toShop'), W / 2, top + 526, { size: 16, align: 'center', color: C.gold, shadow: true });
    }
  }
}
