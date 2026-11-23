// Start up and the game loop.
import { Game } from './game';
import { Input } from './input';
import { H, W } from './render/draw';
import { sfx } from './audio/sfx';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Add ?seed=123 to the address to get the same floor layouts each time.
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
  const touchH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--touch-h')) || 0;
  const fit = Math.min(window.innerWidth / W, (window.innerHeight - touchH) / H);
  const cssW = Math.max(160, Math.floor(W * fit));
  const cssH = Math.floor((cssW * H) / W);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scale = canvas.width / W;
}

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
