// Touch buttons for phones and tablets: a direction pad, plus OK, Back and Sound.
// They stay hidden until the first touch, or from the start when the main pointer is coarse,
// so nothing changes for keyboard players.
import type { Action, Dir, Input } from '../input';
import { DIR_VEC } from '../input';
import { H, W } from '../render/draw';
import { controls } from './hints';

/** Space between the buttons and the screen edges or the game. */
const MARGIN = 12;
const PAD_MIN = 144;
const PAD_MAX = 200;
/** The OK, Back and Sound block when it sits in a bar under the game: two small buttons beside a tall OK. */
const BAR_BLOCK_W = 174;
const BAR_BLOCK_H = 114;
/** The same block as a column at the side of the game. */
const SIDE_BLOCK_W = 120;
const SIDE_BLOCK_H = 204;
/** A finger this close to the middle of the pad keeps the direction it had. Part of the pad's half width. */
const DEAD_ZONE = 0.15;
/** How far past the middle line between two directions a finger must slide before it switches. */
const SWITCH_BIAS = 1.25;

type Layout = 'bar' | 'side';

const PAD_SVG = `
<svg viewBox="0 0 120 120" aria-hidden="true">
  <path class="tc-cross" d="M42 6 H78 V42 H114 V78 H78 V114 H42 V78 H6 V42 H42 Z" />
  <g data-dir="up"><rect class="tc-lit" x="45" y="9" width="30" height="34" rx="5" /><path class="tc-tri" d="M60 17 L72 35 H48 Z" /></g>
  <g data-dir="down"><rect class="tc-lit" x="45" y="77" width="30" height="34" rx="5" /><path class="tc-tri" d="M60 103 L72 85 H48 Z" /></g>
  <g data-dir="left"><rect class="tc-lit" x="9" y="45" width="34" height="30" rx="5" /><path class="tc-tri" d="M17 60 L35 48 V72 Z" /></g>
  <g data-dir="right"><rect class="tc-lit" x="77" y="45" width="34" height="30" rx="5" /><path class="tc-tri" d="M103 60 L85 48 V72 Z" /></g>
  <circle class="tc-hub" cx="60" cy="60" r="9" />
</svg>`;

const BUTTONS: { action: Action; label: string; cls: string }[] = [
  { action: 'mute', label: 'Sound', cls: 'tc-sound' },
  { action: 'cancel', label: 'Back', cls: 'tc-back' },
  { action: 'confirm', label: 'OK', cls: 'tc-ok' },
];

/** The direction for a finger at (dx, dy) from the middle of the pad. Keeps `current` near the line between two. */
function dirAt(dx: number, dy: number, current: Dir | null): Dir {
  if (current) {
    const v = DIR_VEC[current];
    const along = dx * v.x + dy * v.y;
    const across = Math.abs(dx * v.y) + Math.abs(dy * v.x);
    if (along > 0 && along * SWITCH_BIAS >= across) return current;
  }
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export class TouchControls {
  shown = false;
  private layout: Layout = 'bar';
  private readonly pad: HTMLElement;
  private readonly block: HTMLElement;
  /** The element that shows each action as pressed. */
  private readonly marks = new Map<Action, Element>();
  /** How many fingers hold each action, so two fingers on one button release only when both lift. */
  private readonly holds = new Map<Action, number>();
  /** The direction each finger on the pad is over, or null when it has slid off the pad. */
  private readonly padPointers = new Map<number, Dir | null>();

  constructor(
    private readonly root: HTMLElement,
    private readonly input: Input,
    private readonly onShow: () => void,
  ) {
    this.pad = document.createElement('div');
    this.pad.className = 'tc-pad';
    this.pad.innerHTML = PAD_SVG;
    this.pad.querySelectorAll('[data-dir]').forEach((g) => this.marks.set(g.getAttribute('data-dir') as Dir, g));
    this.block = document.createElement('div');
    this.block.className = 'tc-block';
    for (const b of BUTTONS) this.block.append(this.makeButton(b.action, b.label, b.cls));
    root.append(this.pad, this.block);
    this.wirePad();

    // No long press menu on the buttons. On the game itself only while touch is in use, so a right click still works on desktop.
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.parentElement?.addEventListener('contextmenu', (e) => {
      if (controls.touch) e.preventDefault();
    });
    // Older phone browsers can still drag or bounce the page. Nothing on this page scrolls.
    root.parentElement?.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    const firstTouch = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      window.removeEventListener('pointerdown', firstTouch);
      this.show();
    };
    window.addEventListener('pointerdown', firstTouch);
    // At load, without onShow: the caller lays out the page right after this.
    if (window.matchMedia('(pointer: coarse)').matches) this.reveal();
  }

  show(): void {
    if (this.shown) return;
    this.reveal();
    this.onShow();
  }

  private reveal(): void {
    this.shown = true;
    controls.touch = true;
    this.root.classList.add('on');
  }

  /** The room to keep free next to the game for the buttons, in CSS px. Zero while hidden. */
  room(areaW: number, areaH: number): { bottom: number; side: number } {
    if (!this.shown) return { bottom: 0, side: 0 };
    const bottom = Math.max(PAD_MIN, BAR_BLOCK_H) + 2 * MARGIN;
    const side = Math.max(PAD_MIN, SIDE_BLOCK_W) + 2 * MARGIN;
    // Pick the layout that leaves the bigger game. Upright phones get a bar, sideways phones get the sides.
    const fitBar = Math.min(areaW / W, (areaH - bottom) / H);
    const fitSide = Math.min((areaW - 2 * side) / W, areaH / H);
    this.layout = fitSide > fitBar ? 'side' : 'bar';
    return this.layout === 'side' ? { bottom: 0, side } : { bottom, side: 0 };
  }

  /** Places the buttons around a game of gameW by gameH, sized by resize() from room(). */
  place(areaW: number, areaH: number, gameW: number, gameH: number): void {
    if (!this.shown) return;
    const root = document.documentElement.style;
    this.root.dataset.layout = this.layout;
    let pad: number;
    let padX: number;
    let padY: number;
    let blockX: number;
    let blockY: number;
    let blockW: number;
    let blockH: number;
    if (this.layout === 'bar') {
      // The game sits at the top and the bar takes all the height under it.
      const bar = areaH - gameH;
      root.setProperty('--touch-h', `${bar}px`);
      root.setProperty('--side-w', '0px');
      pad = Math.min(PAD_MAX, bar - 2 * MARGIN, areaW - BAR_BLOCK_W - 3 * MARGIN);
      blockW = BAR_BLOCK_W;
      blockH = BAR_BLOCK_H;
      padX = MARGIN;
      padY = gameH + (bar - pad) / 2;
      blockX = areaW - MARGIN - blockW;
      blockY = gameH + (bar - blockH) / 2;
    } else {
      const side = Math.floor((areaW - gameW) / 2);
      root.setProperty('--touch-h', '0px');
      root.setProperty('--side-w', `${side}px`);
      pad = Math.min(PAD_MAX, side - 2 * MARGIN, areaH - 2 * MARGIN);
      blockW = Math.min(SIDE_BLOCK_W, side - 2 * MARGIN);
      blockH = SIDE_BLOCK_H;
      padX = (side - pad) / 2;
      padY = (areaH - pad) / 2;
      blockX = areaW - side + (side - blockW) / 2;
      blockY = (areaH - blockH) / 2;
    }
    pad = Math.floor(pad);
    Object.assign(this.pad.style, { left: `${padX}px`, top: `${padY}px`, width: `${pad}px`, height: `${pad}px` });
    Object.assign(this.block.style, { left: `${blockX}px`, top: `${blockY}px`, width: `${blockW}px`, height: `${blockH}px` });
  }

  private hold(action: Action): void {
    this.holds.set(action, (this.holds.get(action) ?? 0) + 1);
    this.input.press(action);
    this.marks.get(action)?.classList.add('on');
  }

  private letGo(action: Action): void {
    const n = this.holds.get(action) ?? 0;
    if (n <= 0) return;
    this.holds.set(action, n - 1);
    if (n > 1) return;
    this.input.release(action);
    this.marks.get(action)?.classList.remove('on');
  }

  private makeButton(action: Action, label: string, cls: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.className = `tc-btn ${cls}`;
    btn.textContent = label;
    btn.dataset.action = action;
    this.marks.set(action, btn);
    const down = new Set<number>();
    // preventDefault only: these events must still reach window, where the first tap unlocks sound.
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if ((e.pointerType === 'mouse' && e.button !== 0) || down.has(e.pointerId)) return;
      capture(btn, e.pointerId);
      down.add(e.pointerId);
      this.hold(action);
    });
    const up = (e: PointerEvent): void => {
      if (down.delete(e.pointerId)) this.letGo(action);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) btn.addEventListener(name, up);
    return btn;
  }

  private wirePad(): void {
    const pad = this.pad;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if ((e.pointerType === 'mouse' && e.button !== 0) || this.padPointers.has(e.pointerId)) return;
      capture(pad, e.pointerId);
      this.padPointers.set(e.pointerId, null);
      this.padMove(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (this.padPointers.has(e.pointerId)) this.padMove(e);
    });
    // The pointer keeps its capture while the finger is down, so a finger that slides off the pad
    // is seen by padMove. pointerleave covers a browser that refused the capture.
    const end = (e: PointerEvent): void => {
      if (!this.padPointers.has(e.pointerId)) return;
      const dir = this.padPointers.get(e.pointerId);
      this.padPointers.delete(e.pointerId);
      if (dir) this.letGo(dir);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'] as const) pad.addEventListener(name, end);
  }

  /** Holds the direction under the finger, switching as it slides. Off the pad holds nothing. */
  private padMove(e: PointerEvent): void {
    const r = this.pad.getBoundingClientRect();
    const half = r.width / 2;
    const dx = (e.clientX - (r.left + half)) / half;
    const dy = (e.clientY - (r.top + r.height / 2)) / half;
    const current = this.padPointers.get(e.pointerId) ?? null;
    let next: Dir | null;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) next = null;
    else if (dx * dx + dy * dy < DEAD_ZONE * DEAD_ZONE) next = current;
    else next = dirAt(dx, dy, current);
    if (next === current) return;
    if (current) this.letGo(current);
    if (next) this.hold(next);
    this.padPointers.set(e.pointerId, next);
  }
}

function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Some browsers refuse capture for a pointer that is already gone. Its up event still comes.
  }
}
