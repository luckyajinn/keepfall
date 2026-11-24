// The win and lose screens.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, panel, text } from '../render/draw';
import { drawEnemy, drawKnight } from '../render/sprites';
import type { EnemyKind } from '../entities/enemies';
import { sfx } from '../audio/sfx';
import { nightSky } from './common';
import { hint } from './hints';

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
      nightSky(ctx, t);
      ctx.fillStyle = 'rgba(18, 12, 10, 0.45)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = C.bgDeep;
      ctx.fillRect(0, 0, W, H);
    }
    panel(ctx, 150, 70, 500, 460);
    if (s.won) {
      text(ctx, 'The keep is yours!', W / 2, 135, { size: 40, bold: true, align: 'center', color: C.gold });
      text(ctx, 'Mogrum the Ork is beaten and the hall is quiet.', W / 2, 168, { size: 16, italic: true, align: 'center', color: C.inkDim });
      drawKnight(ctx, W / 2, 236, 'large', 'down', t, false);
    } else if (s.gaveUp) {
      text(ctx, 'You turned back', W / 2, 135, { size: 40, bold: true, align: 'center', color: C.ember });
      text(ctx, `You left the keep from floor ${s.floorNum}. Your gold is safe.`, W / 2, 168, { size: 16, italic: true, align: 'center', color: C.inkDim });
      // The knight walks away, seen from behind.
      drawKnight(ctx, W / 2, 236, 'large', 'up', t, false, { alpha: 0.75 });
    } else {
      text(ctx, 'You have fallen', W / 2, 135, { size: 40, bold: true, align: 'center', color: C.ember });
      text(ctx, `The keep holds, for now. You reached floor ${s.floorNum}.`, W / 2, 168, { size: 16, italic: true, align: 'center', color: C.inkDim });
      if (s.foeKind) {
        // The boss's small sprite, which is about the size the other enemies have when large.
        const boss = s.foeKind === 'boss';
        drawEnemy(ctx, s.foeKind, W / 2, boss ? 236 : 232, boss ? 'small' : 'large', t, false, { alpha: 0.75 });
        if (s.foeName) {
          text(ctx, `${foeTitle(s.foeKind, s.foeName)} got the better of you.`, W / 2, 290, { size: 15, align: 'center', color: C.inkDim });
        }
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
    columns.forEach((rows, col) => {
      const x = col === 0 ? 190 : 420;
      rows.forEach(([label, value], i) => {
        const y = 326 + i * 28;
        text(ctx, label, x, y, { size: 17 });
        text(ctx, value, x + 190, y, { size: 17, align: 'right' });
      });
    });
    text(ctx, 'Gold saved for the shop', 190, 424, { size: 18, color: C.gold, bold: true });
    text(ctx, `${s.goldSaved}`, 610, 424, { size: 18, align: 'right', color: C.gold, bold: true });
    text(ctx, `Run seed ${s.seed}`, W / 2, 454, { size: 12, align: 'center', color: C.inkFaint });
    if (Math.sin(t * 5) > -0.3) {
      text(ctx, hint('toShop'), W / 2, 492, { size: 16, align: 'center', color: C.gold });
    }
  }
}
