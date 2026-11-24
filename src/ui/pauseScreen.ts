// The pause menu, opened from the map with Escape. The map is drawn underneath but gets no time or input.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import type { MapScreen } from '../map/mapScreen';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, panel, text } from '../render/draw';
import { fillPx, withAlpha } from '../render/pixel';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { hint } from './hints';
import { HelpScreen } from './helpScreen';

const GIVE_UP = 3;

export class PauseScreen implements Screen {
  readonly pausesRun = true;
  private state = { index: 0 };
  /** True after the first pick of "Give up this run". A second pick gives up. */
  private confirming = false;

  constructor(
    private readonly game: Game,
    private readonly map: MapScreen,
  ) {}

  update(_dt: number, pressed: Action[]): void {
    if (pressed.includes('cancel')) {
      this.resume();
      return;
    }
    const pick = menuInput(pressed, this.state, 4);
    // Moving off the give up row takes back the first pick.
    if (this.state.index !== GIVE_UP) this.confirming = false;
    if (pick < 0) return;
    if (pick === 0) {
      sfx.play('pick');
      this.resume();
    } else if (pick === 1) {
      // toggleMute plays its own sound when the sound comes back on.
      sfx.toggleMute();
    } else if (pick === 2) {
      sfx.play('pick');
      this.game.screen = new HelpScreen(this.game, () => {
        this.game.screen = this;
      });
    } else if (!this.confirming) {
      this.confirming = true;
      sfx.play('deny');
    } else {
      sfx.play('pick');
      this.game.giveUp();
    }
  }

  private resume(): void {
    this.confirming = false;
    this.game.screen = this.map;
  }

  render(ctx: Ctx): void {
    this.map.render(ctx);
    // The map dimmed under the menu: one flat layer of the outline color at 50%.
    withAlpha(ctx, 0.5, () => fillPx(ctx, 0, 0, W, H, C.outline));

    // Wide enough for the hint in key and touch wording, and for "Press again to give up".
    const w = 480;
    const h = 264;
    const x = (W - w) / 2;
    const y = 168;
    panel(ctx, x, y, w, h);
    text(ctx, 'Paused', W / 2, y + 24, { size: 32, bold: true, align: 'center', color: C.gold, baseline: 'top' });
    const rows = [
      { label: 'Resume' },
      { label: sfx.muted ? 'Sound: off' : 'Sound: on' },
      { label: 'How to play' },
      { label: this.confirming ? 'Press again to give up' : 'Give up this run' },
    ];
    drawMenu(ctx, rows, this.state.index, x + 24, y + 64, w - 48, 34, 18);
    // A groove between the rows and the hint.
    fillPx(ctx, x + 24, y + h - 50, w - 48, 2, C.outline);
    fillPx(ctx, x + 24, y + h - 48, w - 48, 2, C.panelLight);
    text(ctx, hint('pauseMenu'), W / 2, y + h - 32, { size: 16, align: 'center', color: C.inkDim, baseline: 'top' });
  }
}
