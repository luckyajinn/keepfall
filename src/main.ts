// Start up and the game loop.
import { Game } from './game';
import { Input } from './input';
import { H, W } from './render/draw';
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

let scale = 1;

function resize(): void {
  // The stage is the screen minus the phone's safe areas. Keep room in it for the touch buttons when they are shown.
  const area = stage.getBoundingClientRect();
  const room = touch.room(area.width, area.height);
  const fit = Math.min((area.width - 2 * room.side) / W, (area.height - room.bottom) / H);
  const cssW = Math.max(160, Math.floor(W * fit));
  const cssH = Math.floor((cssW * H) / W);
  touch.place(area.width, area.height, cssW, cssH);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scale = canvas.width / W;
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
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  game.render(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // A handle for testing in the browser console while developing.
  (window as unknown as { keepfall: Game; keepfallSfx: typeof sfx }).keepfall = game;
  (window as unknown as { keepfallSfx: typeof sfx }).keepfallSfx = sfx;
}
