// Keyboard input, turned into game actions.
// Touch controls can be added later by calling press() and release().

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Action = Dir | 'confirm' | 'cancel' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

const KEY_MAP: Record<string, Action> = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
};

const DIRS: readonly Action[] = ['up', 'down', 'left', 'right'];

export class Input {
  private held = new Set<Action>();
  private pressed: Action[] = [];
  private dirStack: Dir[] = [];

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!e.repeat) this.press(action);
    });
    target.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      this.release(action);
    });
    target.addEventListener('blur', () => {
      this.held.clear();
      this.dirStack = [];
    });
  }

  press(action: Action): void {
    this.held.add(action);
    this.pressed.push(action);
    if (DIRS.includes(action)) {
      const dir = action as Dir;
      this.dirStack = this.dirStack.filter((d) => d !== dir);
      this.dirStack.push(dir);
    }
  }

  release(action: Action): void {
    this.held.delete(action);
    this.dirStack = this.dirStack.filter((d) => d !== action);
  }

  /** Actions pressed since the last call. Each press is returned once. */
  take(): Action[] {
    const out = this.pressed;
    this.pressed = [];
    return out;
  }

  /** The direction key pressed most recently that is still held down. */
  heldDir(): Dir | null {
    return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null;
  }
}

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
