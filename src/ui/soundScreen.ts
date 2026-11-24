// The sound check screen. Plays every sound in the game and sets the volume.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C } from '../render/colors';
import { Ctx, H, W, bar, drawMenu, fillRR, panel, poly, text } from '../render/draw';
import { SFX_NAMES, SfxName, sfx } from '../audio/sfx';
import { menuInput } from './common';

/** A plain name for each sound, and when the game plays it. */
const SOUND_INFO: Record<SfxName, { label: string; when: string }> = {
  move: { label: 'Menu cursor', when: 'Moving up or down in a menu.' },
  pick: { label: 'Menu choice', when: 'Picking a row on the title screen, or turning sound back on.' },
  deny: { label: 'Not allowed', when: 'A choice that can not be made, such as buying without enough gold.' },
  step: { label: 'Footstep', when: 'Each step the knight takes on the map.' },
  encounter: { label: 'Fight starts', when: 'Walking into an enemy you can see.' },
  ambush: { label: 'Ambush', when: 'A hidden enemy jumps out at you.' },
  hit: { label: 'Your hit lands', when: 'Your attack hits the enemy.' },
  hurt: { label: 'You are hit', when: 'An enemy hits you.' },
  block: { label: 'Blocked hit', when: 'Your shield takes part of a hit.' },
  guard: { label: 'Raise shield', when: 'You pick Guard in a fight.' },
  heal: { label: 'Healing', when: 'A potion or a trinket heals you.' },
  windup: { label: 'Heavy blow warning', when: 'An enemy winds up a heavy blow, or the Ork grows angry.' },
  flee: { label: 'Run away', when: 'You flee from a fight.' },
  down: { label: 'Enemy beaten', when: 'An enemy falls in a fight.' },
  coin: { label: 'Fight reward', when: 'You get XP and gold after a won fight.' },
  levelUp: { label: 'Level up', when: 'The knight reaches a new level.' },
  stairs: { label: 'Floor cleared', when: 'You reach the stairs.' },
  buy: { label: 'Bought', when: 'Buying something at the shop or the vendor.' },
  win: { label: 'Victory tune', when: 'You beat the Ork and win the run.' },
  lose: { label: 'Knight falls', when: 'The knight is beaten and the run is lost.' },
};

/** How many list rows fit on the screen at once. The list scrolls to keep the selected row in view. */
const SHOWN = 9;
const ROW_H = 34;
const LIST_X = 100;
const LIST_Y = 182;
const LIST_W = 590;

export class SoundScreen implements Screen {
  /** `top` is the first list row on screen. */
  private state = { index: 0, top: 0 };
  /** The sounds, then a Back row at the end. */
  private readonly count = SFX_NAMES.length + 1;
  readonly shown = SHOWN;

  constructor(private readonly game: Game) {}

  update(_dt: number, pressed: Action[]): void {
    if (pressed.includes('cancel')) {
      this.game.showStart();
      return;
    }
    for (const a of pressed) {
      if (a !== 'left' && a !== 'right') continue;
      const before = sfx.volume;
      const after = sfx.setVolume(before + (a === 'left' ? -0.1 : 0.1));
      // A short sound at the new level. At either end there is nothing to change.
      sfx.play(after === before ? 'deny' : 'pick');
    }
    const pick = menuInput(pressed, this.state, this.count);
    this.scrollToIndex();
    if (pick < 0) return;
    if (pick === SFX_NAMES.length) {
      this.game.showStart();
      return;
    }
    sfx.play(SFX_NAMES[pick]);
  }

  /** Moves the scroll so the selected row is on screen. */
  private scrollToIndex(): void {
    const s = this.state;
    if (s.index < s.top) s.top = s.index;
    else if (s.index >= s.top + SHOWN) s.top = s.index - SHOWN + 1;
    s.top = Math.max(0, Math.min(this.count - SHOWN, s.top));
  }

  render(ctx: Ctx): void {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 70, 24, 660, 552);
    text(ctx, 'Sound check', 100, 74, { size: 32, bold: true, color: C.gold });
    text(ctx, 'Hear every sound in the game and set how loud it is.', 100, 100, { size: 15, italic: true, color: C.inkDim });

    const vol = sfx.volume;
    text(ctx, 'Volume', 100, 141, { size: 19, bold: true });
    bar(ctx, 200, 128, 400, 18, vol, C.gold);
    text(ctx, `${Math.round(vol * 10)} / 10`, 700, 141, { size: 19, bold: true, color: C.gold, align: 'right' });
    if (sfx.muted) text(ctx, 'Sound is off. Press M to turn it back on.', 100, 168, { size: 15, bold: true, color: C.ember });

    // The rows on screen now, drawn as one menu. The raw sound id sits on the right.
    const { index, top } = this.state;
    const rows: { label: string; right?: string }[] = [];
    for (let i = top; i < top + SHOWN; i++) {
      const name = SFX_NAMES[i];
      rows.push(name ? { label: SOUND_INFO[name].label } : { label: 'Back to the title' });
    }
    drawMenu(ctx, rows, index - top, LIST_X, LIST_Y, LIST_W, ROW_H, 18);
    for (let i = top; i < top + SHOWN; i++) {
      const name = SFX_NAMES[i];
      if (!name) continue;
      const ry = LIST_Y + (i - top) * ROW_H + ROW_H / 2 - 1;
      text(ctx, name, LIST_X + LIST_W - 14, ry, { size: 14, color: C.inkFaint, align: 'right', baseline: 'middle' });
    }

    // A scroll bar, plus arrows when there are rows above or below.
    const trackY = LIST_Y;
    const trackH = SHOWN * ROW_H - 4;
    fillRR(ctx, 706, trackY, 6, trackH, 3, '#150e0b');
    fillRR(ctx, 706, trackY + (trackH * top) / this.count, 6, (trackH * SHOWN) / this.count, 3, C.panelEdge);
    if (top > 0) poly(ctx, [709, trackY - 12, 703, trackY - 4, 715, trackY - 4], C.inkDim);
    if (top + SHOWN < this.count) poly(ctx, [709, trackY + trackH + 12, 703, trackY + trackH + 4, 715, trackY + trackH + 4], C.inkDim);

    fillRR(ctx, 100, 494, 600, 36, 8, C.panelLight);
    const sel = SFX_NAMES[index];
    text(ctx, sel ? `Plays when: ${SOUND_INFO[sel].when}` : 'Return to the title screen.', 116, 512, {
      size: 15,
      baseline: 'middle',
    });
    // Kept above y 558, where the game shows its Sound off and Sound on message.
    text(ctx, 'W and S to choose. Enter to play. A and D for volume. Esc to go back.', 700, 550, {
      size: 13,
      color: C.inkFaint,
      align: 'right',
    });
  }
}
