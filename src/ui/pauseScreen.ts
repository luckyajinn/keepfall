// The pause menu, opened from the map with Escape. The map is drawn underneath but gets no time or input.
import type { Action } from '../input';
import type { Game, Screen } from '../game';
import type { MapScreen } from '../map/mapScreen';
import { C } from '../render/colors';
import { Ctx, H, W, drawMenu, panel, text } from '../render/draw';
import { sfx } from '../audio/sfx';
import { menuInput } from './common';
import { HelpScreen } from './helpScreen';

const GIVE_UP = 3;

export class PauseScreen implements Screen {
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
    ctx.fillStyle = 'rgba(12, 7, 5, 0.62)';
    ctx.fillRect(0, 0, W, H);

    const x = 220;
    const y = 170;
    panel(ctx, x, y, 360, 292);
    text(ctx, 'Paused', W / 2, y + 48, { size: 30, bold: true, align: 'center', color: C.gold });
    const rows = [
      { label: 'Resume' },
      { label: sfx.muted ? 'Sound: off' : 'Sound: on' },
      { label: 'How to play' },
      { label: this.confirming ? 'Press again to give up' : 'Give up this run' },
    ];
    drawMenu(ctx, rows, this.state.index, x + 16, y + 70, 328, 44, 19);
    text(ctx, 'W and S to choose. Enter to pick. Esc to resume.', W / 2, y + 268, { size: 13, align: 'center', color: C.inkDim });
  }
}
