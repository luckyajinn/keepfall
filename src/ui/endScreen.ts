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
      drawKnight(ctx, W / 2, 232, 84, 'down', t, false);
    } else {
      text(ctx, 'You have fallen', W / 2, 135, { size: 40, bold: true, align: 'center', color: C.ember });
      text(ctx, `The keep holds, for now. You reached floor ${s.floorNum}.`, W / 2, 168, { size: 16, italic: true, align: 'center', color: C.inkDim });
      if (s.foeKind) {
        // The boss is drawn a little larger, and lower so its raised club stays clear of the line above.
        const boss = s.foeKind === 'boss';
        ctx.globalAlpha = 0.7;
        drawEnemy(ctx, s.foeKind, W / 2, boss ? 234 : 228, boss ? 72 : 68, t);
        ctx.globalAlpha = 1;
        if (s.foeName) {
          text(ctx, `${foeTitle(s.foeKind, s.foeName)} got the better of you.`, W / 2, 290, { size: 15, align: 'center', color: C.inkDim });
        }
      }
    }
    const rows: [string, string][] = [
      ['Level reached', `${s.level}`],
      ['Enemies beaten', `${s.kills}`],
      ['Gold earned this run', `${s.goldEarned}`],
      ['Gold saved for the shop', `${s.goldSaved}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 322 + i * 34;
      const last = i === rows.length - 1;
      text(ctx, label, 210, y, { size: 18, color: last ? C.gold : C.ink, bold: last });
      text(ctx, value, 590, y, { size: 18, align: 'right', color: last ? C.gold : C.ink, bold: last });
    });
    if (Math.sin(t * 5) > -0.3) {
      text(ctx, hint('toShop'), W / 2, 492, { size: 16, align: 'center', color: C.gold });
    }
  }
}
