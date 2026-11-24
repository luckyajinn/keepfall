// Start up and the game loop.
import { Game } from './game';
import { Input } from './input';
import { H, W } from './render/draw';
import { ART_H, ART_W } from './render/pixel';
import { textLog } from './render/font';
import { sfx } from './audio/sfx';
import { TouchControls } from './ui/touch';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const stage = document.getElementById('stage')!;
const ctx = canvas.getContext('2d')!;

// Add ?seed=123 to the address to get the same floor layouts each time, for the first run of a visit.
// The end screen shows each run's seed, which can be used here.
// Fights can still go differently, since they depend on what the player does.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null && seedParam !== '' && Number.isFinite(Number(seedParam)) ? Number(seedParam) : Date.now();

const input = new Input(window);
// Browsers only let sound start after a key press, a click or a tap.
// A tap only counts once the finger lifts, and the Escape key does not count,
// so try on each of these events and stop listening after the first one that counts.
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend'] as const;

function unlockSound(e: Event): void {
  sfx.unlock();
  const touchStart = e.type === 'pointerdown' && (e as PointerEvent).pointerType !== 'mouse';
  const mouseUp = e.type === 'pointerup' && (e as PointerEvent).pointerType === 'mouse';
  const escape = e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape';
  if (touchStart || mouseUp || escape) return;
  for (const name of UNLOCK_EVENTS) window.removeEventListener(name, unlockSound);
}

for (const name of UNLOCK_EVENTS) window.addEventListener(name, unlockSound);

const game = new Game(input, seed);

// The canvas holds exactly the 400 by 300 pixel grid. The page scales it up with nearest
// neighbor (image-rendering: pixelated in index.html), so each art pixel stays a crisp square.
canvas.width = ART_W;
canvas.height = ART_H;

/** Below this share of the best fit, a whole number scale is given up for an exact fit. */
const WHOLE_SCALE_MIN = 0.8;

/**
 * How many device pixels each art pixel gets, for a free area of availW by availH device pixels.
 * The largest whole number that fits, unless that leaves the game smaller than 80% of the best
 * fit (or under 1), and then the best fit itself, which makes some pixels a device pixel wider.
 */
function pixelScale(availW: number, availH: number): number {
  const fit = Math.max(0, Math.min(availW / ART_W, availH / ART_H));
  const whole = Math.floor(fit);
  return whole >= 1 && whole >= fit * WHOLE_SCALE_MIN ? whole : fit;
}

function resize(): void {
  // The stage is the screen minus the phone's safe areas. Keep room in it for the touch buttons when they are shown.
  const area = stage.getBoundingClientRect();
  const room = touch.room(area.width, area.height);
  const dpr = window.devicePixelRatio || 1;
  // Work in device pixels, so a whole number scale means whole device pixels per art pixel.
  const k = pixelScale((area.width - 2 * room.side) * dpr, (area.height - room.bottom) * dpr);
  let cssW = (ART_W * k) / dpr;
  let cssH = (ART_H * k) / dpr;
  if (cssW < 160) {
    cssW = 160;
    cssH = 120;
  }
  touch.place(area.width, area.height, cssW, cssH);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}

// Shows itself on the first touch, or right away when the main pointer is a finger.
const touch = new TouchControls(document.getElementById('touch-controls')!, input, resize);

window.addEventListener('resize', resize);
resize();
canvas.focus();

let last = performance.now();

function frame(now: number): void {
  // Cap the step so a paused tab doesn't jump ahead when it comes back.
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  // The text drawn in each frame is kept for tests (dev mode only). It starts empty each frame.
  textLog.length = 0;
  // All screen code works in 800 by 600 logical units: one art pixel is 2 of them.
  ctx.setTransform(ART_W / W, 0, 0, ART_H / H, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  game.render(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // A handle for testing in the browser console while developing.
  (window as unknown as { keepfall: Game; keepfallSfx: typeof sfx }).keepfall = game;
  (window as unknown as { keepfallSfx: typeof sfx }).keepfallSfx = sfx;
  // The strings drawn in the last frame, with their color and box in canvas pixels. See src/render/font.ts.
  (window as unknown as { keepfallText: typeof textLog }).keepfallText = textLog;
}
