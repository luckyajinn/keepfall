// Touch buttons for phones and tablets: a direction pad, plus OK, Back and Sound.
// They stay hidden until the first touch, or from the start when the main pointer is coarse,
// so nothing changes for keyboard players.
import type { Action, Dir, Input } from '../input';
import { DIR_VEC } from '../input';
import { PAL } from '../render/colors';
import { H, W } from '../render/draw';
import { CAP_H, drawText, measureText, textLog } from '../render/font';
import { ART_W, Painter, spriteFromPixels } from '../render/pixel';
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
/** The button grid in each layout, in CSS px before it is snapped to whole art pixels. */
const BAR_COLS = [76, 88];
const BAR_ROWS = [52, 52];
const BAR_GAP = 10;
const SIDE_ROWS = [48, 56, 76];
const SIDE_GAP = 12;
/** A finger this close to the middle of the pad keeps the direction it had. Part of the pad's half width. */
const DEAD_ZONE = 0.15;
/** How far past the middle line between two directions a finger must slide before it switches. */
const SWITCH_BIAS = 1.25;
/** No touch target may be smaller than this, in CSS px. */
const MIN_TARGET = 48;

type Layout = 'bar' | 'side';

const BUTTONS: { action: Action; label: string; cls: string }[] = [
  { action: 'mute', label: 'Sound', cls: 'tc-sound' },
  { action: 'cancel', label: 'Back', cls: 'tc-back' },
  { action: 'confirm', label: 'OK', cls: 'tc-ok' },
];

const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

// The art. Every control face is pixel art drawn in code with the game's own colors and font,
// at a native size of one canvas pixel per art pixel, and shown enlarged with image-rendering:
// pixelated. place() picks the art pixel size so it matches the game's pixels on the same screen
// and snaps every control to a whole number of art pixels, so each pixel is an even square.
// The art is drawn again only when that size changes, never per frame.

/** The colors of one face: a two line border like the game's panels, then a flat fill with a 1 pixel bevel. */
interface Tones {
  rim: string;
  inner: string;
  fill: string;
  light: string;
  dark: string;
}

const FACE: Tones = { rim: PAL.gold1, inner: PAL.gold0, fill: PAL.night2, light: PAL.night3, dark: PAL.night1 };
const FACE_ON: Tones = { rim: PAL.gold2, inner: PAL.gold1, fill: PAL.night4, light: PAL.wood0, dark: PAL.night3 };
/** The hard edged shadow under each control. The page around the controls is already the darkest color, so a dark wood tone shows the drop instead. */
const DROP = PAL.wood0;

/** For a shape given by `inside`, how far each pixel is from the outside (0 on the edge), counting up, down, left and right steps. -1 outside. Stops at 3. */
function depths(w: number, h: number, inside: (x: number, y: number) => boolean): Int8Array {
  const d = new Int8Array(w * h).fill(-1);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? -1 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) d[y * w + x] = 99;
  for (let k = 0; k <= 3; k++) {
    const set: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[y * w + x] !== 99) continue;
        if (Math.min(at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)) === k - 1) set.push(y * w + x);
      }
    }
    for (const i of set) d[i] = k;
  }
  return d;
}

/**
 * Paints a face: the shape's outer pixel in `rim`, the next in `inner`, the rest in `fill`, with the
 * fill's upper left edge in `light` and its lower right edge in `dark`. `only` limits it to some pixels.
 * The shape is placed with its top left at (ox, oy).
 */
function paintFace(p: Painter, d: Int8Array, w: number, ox: number, oy: number, t: Tones, only?: (x: number, y: number) => boolean): void {
  const h = d.length / w;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? -1 : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = d[y * w + x];
      if (k < 0 || (only && !only(x, y))) continue;
      let c = k === 0 ? t.rim : k === 1 ? t.inner : t.fill;
      if (k >= 2) {
        if (at(x + 1, y) === 1 || at(x, y + 1) === 1) c = t.dark;
        if (at(x - 1, y) === 1 || at(x, y - 1) === 1) c = t.light;
      }
      p.px(ox + x, oy + y, c);
    }
  }
}

/** The shape's pixels in one flat color, placed with its top left at (ox, oy). */
function paintFlat(p: Painter, d: Int8Array, w: number, ox: number, oy: number, c: string): void {
  for (let i = 0; i < d.length; i++) if (d[i] >= 0) p.px(ox + (i % w), oy + Math.floor(i / w), c);
}

/** A set of pixels, painted with light on the upper left, shadow on the lower right and a hard drop shadow. */
function paintSolid(p: Painter, pts: readonly [number, number][], base: string, light: string, dark: string, drop: string): void {
  const has = new Set(pts.map(([x, y]) => `${x},${y}`));
  const out = (x: number, y: number): boolean => !has.has(`${x},${y}`);
  for (const [x, y] of pts) if (out(x + 1, y + 1)) p.px(x + 1, y + 1, drop);
  for (const [x, y] of pts) {
    let c = base;
    if (out(x - 1, y) || out(x, y - 1)) c = light;
    if (out(x + 1, y) || out(x, y + 1)) c = dark;
    p.px(x, y, c);
  }
}

/** A rectangle w by h with 1 pixel chamfered corners. */
const chamferedRect =
  (w: number, h: number) =>
  (x: number, y: number): boolean =>
    !((x === 0 || x === w - 1) && (y === 0 || y === h - 1));

/** Copies a painter onto a page canvas, sizing the canvas to it. */
function show(canvas: HTMLCanvasElement, p: Painter): void {
  const s = spriteFromPixels(p.w, p.h, p.buf);
  canvas.width = p.w;
  canvas.height = p.h;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, p.w, p.h);
  g.drawImage(s.canvas, 0, 0);
}

/**
 * The pad art, n by n art pixels: a cross with four arrow heads and a dimple in the middle, on a
 * hard shadow `drop` pixels deep. Returns the picture at rest and, for each direction, a picture
 * that holds only that arm lit up (laid over the rest when that arm is held).
 */
function padArt(n: number, drop: number): { base: Painter; lit: Record<Dir, Painter> } {
  const m = n - drop;
  let a = Math.round(m * 0.34);
  if ((m - a) % 2) a++;
  const c0 = (m - a) / 2;
  const c1 = c0 + a;
  const inArm = (x: number, y: number): boolean => (x >= c0 && x < c1) || (y >= c0 && y < c1);
  const ends = (x: number, y: number): boolean =>
    (x === c0 || x === c1 - 1 || y === c0 || y === c1 - 1) && (x === 0 || x === m - 1 || y === 0 || y === m - 1);
  const d = depths(m, m, (x, y) => inArm(x, y) && !ends(x, y));

  // The up arrow: a 45 degree head, its tip 1 or 2 pixels wide to sit on the middle of the arm.
  const tip = a % 2 ? 1 : 2;
  const ah = Math.max(3, Math.round(a * 0.27));
  const top = Math.round((2 + c0) / 2 - ah / 2);
  const left = c0 + (a - tip) / 2;
  const upArrow: [number, number][] = [];
  for (let k = 0; k < ah; k++) for (let i = 0; i < tip + 2 * k; i++) upArrow.push([left - k + i, top + k]);
  const turn = (dir: Dir, [x, y]: [number, number]): [number, number] =>
    dir === 'up' ? [x, y] : dir === 'down' ? [x, m - 1 - y] : dir === 'left' ? [y, x] : [m - 1 - y, x];
  const arm = (dir: Dir) => (x: number, y: number): boolean =>
    dir === 'up' ? y < c0 : dir === 'down' ? y >= c1 : dir === 'left' ? x < c0 : x >= c1;

  const base = new Painter(n, n);
  paintFlat(base, d, m, drop, drop, DROP);
  paintFace(base, d, m, 0, 0, FACE);
  for (const dir of DIRS) paintSolid(base, upArrow.map((pt) => turn(dir, pt)), PAL.parch1, PAL.parch2, PAL.parch0, PAL.night1);
  // The dimple: a round hollow, dark on its upper left rim and lit on its lower right.
  let hd = Math.round(a * 0.4);
  if ((m - hd) % 2) hd++;
  const hub = new Painter(m, m).ellipse((m - hd) / 2, (m - hd) / 2, hd, hd, PAL.night1);
  const hubPts: [number, number][] = [];
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) if (hub.get(x, y)) hubPts.push([x, y]);
  paintSolid(base, hubPts, PAL.night1, PAL.night0, PAL.night3, PAL.night2);

  const lit = {} as Record<Dir, Painter>;
  for (const dir of DIRS) {
    const p = new Painter(n, n);
    paintFace(p, d, m, 0, 0, FACE_ON, arm(dir));
    paintSolid(p, upArrow.map((pt) => turn(dir, pt)), PAL.gold1, PAL.gold2, PAL.gold0, PAL.night2);
    lit[dir] = p;
  }
  return { base, lit };
}

/**
 * One button face, w by h art pixels: a chamfered panel on a hard shadow `drop` pixels deep, with its
 * label in the pixel font. Pressed, the shadow is gone and the face sits `drop` pixels lower and right.
 */
function buttonArt(w: number, h: number, drop: number, pressed: boolean): Painter {
  const fw = w - drop;
  const fh = h - drop;
  const d = depths(fw, fh, chamferedRect(fw, fh));
  const p = new Painter(w, h);
  const off = pressed ? drop : 0;
  if (!pressed) paintFlat(p, d, fw, drop, drop, DROP);
  paintFace(p, d, fw, off, off, pressed ? FACE_ON : FACE);
  return p;
}

/** Draws a button's label onto its canvas, centered on the face. */
function drawLabel(canvas: HTMLCanvasElement, w: number, h: number, drop: number, label: string, scale: number, color: string, off: number): void {
  const g = canvas.getContext('2d')!;
  const tw = measureText(label, scale);
  const x = Math.round((w - drop - tw) / 2) + off;
  const y = Math.round((h - drop - CAP_H * scale) / 2) + off;
  // The font logs every string it draws for the tests of the game screen. These are not on it.
  const logged = textLog.length;
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawText(g, label, x, y, { scale, color, shadow: PAL.night0, baseline: 'top' });
  textLog.length = logged;
}

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
  /** The canvases that show the pad: the picture at rest, then one lit arm per direction. */
  private readonly padBase: HTMLCanvasElement;
  private readonly padLit = new Map<Dir, HTMLCanvasElement>();
  /** Each button's canvases at rest and pressed, and its label. */
  private readonly faces: { rest: HTMLCanvasElement; held: HTMLCanvasElement; label: string; ok: boolean }[] = [];
  /** The sizes the art was last drawn at, so it is drawn again only when they change. */
  private drawnAt = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly input: Input,
    private readonly onShow: () => void,
  ) {
    this.pad = document.createElement('div');
    this.pad.className = 'tc-pad';
    this.padBase = artCanvas('tc-face');
    this.pad.append(this.padBase);
    for (const dir of DIRS) {
      const lit = artCanvas('tc-lit');
      lit.dataset.dir = dir;
      this.padLit.set(dir, lit);
      this.marks.set(dir, lit);
      this.pad.append(lit);
    }
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

    // Art pixels as big as the game's: the game's device pixels per art pixel, rounded to a whole
    // number so every control pixel is an even square of device pixels. `u` is that in CSS px.
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.round((gameW * dpr) / ART_W));
    const u = k / dpr;
    // Chrome places a canvas on whole CSS px, so sizes and positions are kept on whole CSS px where
    // the screen allows: every length is a multiple of `q` art pixels, where q art pixels make whole
    // CSS px (q is 2 when an art pixel is 1.5 CSS px). With an odd pixel ratio, whole device px.
    let q = 1;
    while (q < 8 && Math.abs(q * u - Math.round(q * u)) > 1e-6) q++;
    const step = Number.isInteger(dpr) ? 1 : 1 / dpr;
    const dev = (v: number): number => Math.round(v / step) * step;
    // A length in art pixels, a multiple of q: the nearest to `len` CSS px, but never under `min`.
    const art = (len: number, min = 0): number => q * Math.max(Math.ceil(min / u / q - 1e-6), Math.round(len / u / q));

    // The pad shrinks to whole art pixels and stays centered where it was.
    const padN = q * Math.floor(pad / u / q + 1e-6);
    const padCss = padN * u;
    padX = dev(padX + (pad - padCss) / 2);
    padY = dev(padY + (pad - padCss) / 2);
    Object.assign(this.pad.style, { left: `${padX}px`, top: `${padY}px`, width: `${padCss}px`, height: `${padCss}px` });

    // The buttons' grid, in art pixels. Each button covers whole art pixels and is at least MIN_TARGET.
    const bar = this.layout === 'bar';
    const cols = (bar ? BAR_COLS : [blockW]).map((c) => art(c, MIN_TARGET));
    const rows = (bar ? BAR_ROWS : SIDE_ROWS).map((r) => art(r, MIN_TARGET));
    const gap = Math.max(q, art(bar ? BAR_GAP : SIDE_GAP));
    const sum = (v: number[]): number => v.reduce((t, x) => t + x, 0);
    const bw = sum(cols) + gap * (cols.length - 1);
    const bh = sum(rows) + gap * (rows.length - 1);
    blockX = dev(blockX + (blockW - bw * u) / 2);
    blockY = dev(blockY + (blockH - bh * u) / 2);
    Object.assign(this.block.style, {
      left: `${blockX}px`,
      top: `${blockY}px`,
      width: `${bw * u}px`,
      height: `${bh * u}px`,
      gap: `${gap * u}px`,
      gridTemplateColumns: cols.map((c) => `${c * u}px`).join(' '),
      gridTemplateRows: rows.map((r) => `${r * u}px`).join(' '),
    });
    // Sound, Back and OK, in art pixels.
    const sizes: [number, number][] = bar
      ? [
          [cols[0], rows[0]],
          [cols[0], rows[1]],
          [cols[1], rows[0] + gap + rows[1]],
        ]
      : rows.map((r) => [cols[0], r]);
    this.drawArt(u, padN, sizes);
  }

  /** Draws the pad and button art for art pixels of `u` CSS px. Skipped when nothing changed. */
  private drawArt(u: number, padN: number, sizes: [number, number][]): void {
    const key = `${u} ${padN} ${sizes.join(' ')}`;
    if (key === this.drawnAt) return;
    this.drawnAt = key;
    // The shadow and the press are about 2 CSS px deep. Labels are about 14 CSS px tall, OK about 20.
    const drop = Math.max(1, Math.round(2 / u));
    const labelScale = Math.max(1, Math.round(13 / (CAP_H * u)));
    const okScale = Math.max(1, Math.ceil(19 / (CAP_H * u)));
    const pad = padArt(padN, drop);
    show(this.padBase, pad.base);
    for (const dir of DIRS) show(this.padLit.get(dir)!, pad.lit[dir]);
    this.faces.forEach((f, i) => {
      const [w, h] = sizes[i];
      const scale = f.ok ? okScale : labelScale;
      show(f.rest, buttonArt(w, h, drop, false));
      drawLabel(f.rest, w, h, drop, f.label, scale, f.ok ? PAL.gold1 : PAL.parch2, 0);
      show(f.held, buttonArt(w, h, drop, true));
      drawLabel(f.held, w, h, drop, f.label, scale, f.ok ? PAL.gold2 : PAL.gold1, drop);
    });
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
    btn.dataset.action = action;
    // The label is drawn in the pixel font on the canvases. The hidden text gives the button its name.
    const name = document.createElement('span');
    name.className = 'tc-name';
    name.textContent = label;
    const rest = artCanvas('tc-face tc-rest');
    const held = artCanvas('tc-face tc-held');
    btn.append(rest, held, name);
    this.faces.push({ rest, held, label, ok: action === 'confirm' });
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

/** A canvas for control art, hidden from screen readers. */
function artCanvas(cls: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  c.width = 1;
  c.height = 1;
  return c;
}

function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Some browsers refuse capture for a pointer that is already gone. Its up event still comes.
  }
}
