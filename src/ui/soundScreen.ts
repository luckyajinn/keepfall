// The sound check screen. Plays every sound in the game and sets the volume.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import { C, PAL } from '../render/colors';
import { Ctx, H, W, bar, drawMenu, panel, text } from '../render/draw';
import { Sprite, drawSprite, fillPx, lazy, makeSprite, snap } from '../render/pixel';
import { SFX_NAMES, SfxName, sfx } from '../audio/sfx';
import { hint } from './hints';
import { menuInput } from './common';
import { inset, splitLines } from './hud';

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
// The layout, in logical units (two per art pixel).
/** Left and right edges of the text inside the panel. */
const LEFT = 56;
const RIGHT = 744;
const VOL_Y = 112;
const ROW_H = 28;
const LIST_X = 48;
const LIST_Y = 172;
const LIST_W = 680;
/** The scroll bar's track, right of the list. */
const TRACK_X = 736;
const DESC_W = 704;
/** Nine rows of 28 end at y 424. The box below holds two lines. */
const DESC_Y = 440;
const DESC_H = 52;

/** The scroll arrows: small gold triangles, 7 by 4 pixels with their outline. */
const arrowUp: () => Sprite = lazy(() =>
  makeSprite(9, 6, (p) => {
    p.grid(['...Y...', '..YgY..', '.Ygggy.', 'ggggyyy'], { Y: PAL.gold2, g: PAL.gold1, y: PAL.gold0 }, 1, 1);
    p.outline(C.outline);
  }),
);
const arrowDown: () => Sprite = lazy(() =>
  makeSprite(9, 6, (p) => {
    p.grid(['YYgggyy', '.ggggy.', '..ggy..', '...y...'], { Y: PAL.gold2, g: PAL.gold1, y: PAL.gold0 }, 1, 1);
    p.outline(C.outline);
  }),
);

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
    fillPx(ctx, 0, 0, W, H, C.bg);
    // The panel ends at y 560, leaving the strip below it free for the Sound off message.
    panel(ctx, 32, 16, 736, 544);
    text(ctx, 'Sound check', LEFT, 40, { size: 32, bold: true, color: C.gold, baseline: 'top' });
    text(ctx, 'Hear every sound in the game and set how loud it is.', LEFT, 80, { size: 16, color: C.inkDim, baseline: 'top' });

    // The volume: a label, a bar 9 pixels tall around the label's row, and the level.
    const vol = sfx.volume;
    text(ctx, 'Volume', LEFT, VOL_Y, { size: 16, bold: true, baseline: 'top' });
    bar(ctx, 136, VOL_Y - 2, 520, 18, vol, C.gold, PAL.gold0);
    text(ctx, `${Math.round(vol * 10)} / 10`, RIGHT, VOL_Y, { size: 16, bold: true, color: C.gold, align: 'right', baseline: 'top' });
    if (sfx.muted) text(ctx, hint('soundMuted'), LEFT, VOL_Y + 26, { size: 16, bold: true, color: C.ember, baseline: 'top' });

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
      const ry = LIST_Y + (i - top) * ROW_H + ROW_H / 2 - 2;
      text(ctx, name, LIST_X + LIST_W - 12, ry, { size: 16, color: C.inkFaint, align: 'right', baseline: 'middle' });
    }

    // A scroll bar in a sunken track, with arrows above and below it when there are rows that way.
    const trackY = LIST_Y;
    const trackH = SHOWN * ROW_H - 4;
    inset(ctx, TRACK_X, trackY, 12, trackH);
    const thumbY = snap(trackY + 2 + ((trackH - 4) * top) / this.count);
    const thumbH = snap(((trackH - 4) * SHOWN) / this.count);
    fillPx(ctx, TRACK_X + 2, thumbY, 8, thumbH, C.panelEdge);
    fillPx(ctx, TRACK_X + 2, thumbY, 2, thumbH, PAL.wood2);
    fillPx(ctx, TRACK_X + 2, thumbY + thumbH - 2, 8, 2, PAL.wood0);
    if (top > 0) drawSprite(ctx, arrowUp(), TRACK_X + 6, trackY - 8, { center: true });
    if (top + SHOWN < this.count) drawSprite(ctx, arrowDown(), TRACK_X + 6, trackY + trackH + 8, { center: true });

    // When the sound plays. Long lines wrap onto a second line in the box.
    const sel = SFX_NAMES[index];
    const lines = splitLines(sel ? `Plays when: ${SOUND_INFO[sel].when}` : 'Return to the title screen.', DESC_W - 32);
    inset(ctx, LIST_X, DESC_Y, DESC_W, DESC_H);
    const ty = snap(DESC_Y + DESC_H / 2 - (lines.length * 22 - 8) / 2);
    lines.forEach((line, i) => text(ctx, line, LIST_X + 16, ty + i * 22, { size: 16, baseline: 'top' }));
    text(ctx, hint('soundMenu'), RIGHT, 526, { size: 16, color: C.inkFaint, align: 'right', baseline: 'top' });
  }
}
