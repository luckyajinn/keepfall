// Sound effects made in code with the Web Audio API. There are no sound files.
// Browsers only allow sound after the player presses a key, clicks or taps, so the audio
// context is created on the first key press, click or tap.

export type SfxName =
  | 'move'
  | 'pick'
  | 'deny'
  | 'step'
  | 'encounter'
  | 'ambush'
  | 'hit'
  | 'hurt'
  | 'block'
  | 'guard'
  | 'heal'
  | 'windup'
  | 'flee'
  | 'down'
  | 'coin'
  | 'levelUp'
  | 'stairs'
  | 'buy'
  | 'win'
  | 'lose';

const MUTE_KEY = 'keepfall.muted';

interface Tone {
  /** Start frequency in Hz. */
  f: number;
  /** End frequency. The pitch slides to it over the length of the tone. */
  to?: number;
  /** Start time in seconds from now. */
  at?: number;
  /** Length in seconds. */
  len: number;
  wave?: OscillatorType;
  vol?: number;
}

class Sfx {
  muted = false;
  /** Names of the sounds played so far. Only used for testing. */
  readonly played: SfxName[] = [];
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage can be blocked. Sound just starts switched on.
    }
  }

  /** Call on a key press, click or tap so the browser lets sound play. */
  unlock(): void {
    this.ready();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Not saved, but the switch still works for this visit.
    }
    if (!this.muted) this.play('pick');
    return this.muted;
  }

  private ready(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(ctx: AudioContext, t: Tone): void {
    const start = ctx.currentTime + (t.at ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.wave ?? 'square';
    osc.frequency.setValueAtTime(t.f, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.len);
    const vol = t.vol ?? 0.3;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.len);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(start);
    osc.stop(start + t.len + 0.02);
  }

  private noise(ctx: AudioContext, at: number, len: number, vol: number, cutoff: number): void {
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const start = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start(start);
    src.stop(start + len + 0.02);
  }

  /** Plays a run of notes, one after another. */
  private notes(ctx: AudioContext, freqs: number[], each: number, wave: OscillatorType, vol: number): void {
    freqs.forEach((f, i) => this.tone(ctx, { f, at: i * each, len: each * 1.6, wave, vol }));
  }

  play(name: SfxName): void {
    this.played.push(name);
    if (this.played.length > 200) this.played.shift();
    if (this.muted) return;
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    try {
      switch (name) {
        case 'move':
          this.tone(ctx, { f: 520, len: 0.05, wave: 'triangle', vol: 0.18 });
          break;
        case 'pick':
          this.notes(ctx, [520, 780], 0.06, 'triangle', 0.25);
          break;
        case 'deny':
          this.tone(ctx, { f: 160, to: 110, len: 0.18, wave: 'sawtooth', vol: 0.2 });
          break;
        case 'step':
          this.noise(ctx, 0, 0.05, 0.06, 500);
          break;
        case 'encounter':
          this.notes(ctx, [330, 440, 330, 440], 0.07, 'square', 0.18);
          break;
        case 'ambush':
          this.tone(ctx, { f: 220, len: 0.35, wave: 'sawtooth', vol: 0.25 });
          this.tone(ctx, { f: 233, len: 0.35, wave: 'sawtooth', vol: 0.25 });
          this.noise(ctx, 0, 0.25, 0.25, 1800);
          break;
        case 'hit':
          this.noise(ctx, 0, 0.12, 0.4, 2600);
          this.tone(ctx, { f: 240, to: 90, len: 0.12, wave: 'square', vol: 0.2 });
          break;
        case 'hurt':
          this.noise(ctx, 0, 0.16, 0.4, 900);
          this.tone(ctx, { f: 130, to: 60, len: 0.2, wave: 'sawtooth', vol: 0.25 });
          break;
        case 'block':
          this.tone(ctx, { f: 900, to: 700, len: 0.14, wave: 'triangle', vol: 0.3 });
          this.noise(ctx, 0, 0.06, 0.25, 4000);
          break;
        case 'guard':
          this.tone(ctx, { f: 660, len: 0.1, wave: 'triangle', vol: 0.25 });
          this.tone(ctx, { f: 990, at: 0.05, len: 0.14, wave: 'triangle', vol: 0.2 });
          break;
        case 'heal':
          this.notes(ctx, [523, 659, 784], 0.08, 'sine', 0.3);
          break;
        case 'windup':
          this.tone(ctx, { f: 70, to: 200, len: 0.45, wave: 'sawtooth', vol: 0.28 });
          break;
        case 'flee':
          this.tone(ctx, { f: 500, to: 900, len: 0.2, wave: 'triangle', vol: 0.22 });
          break;
        case 'down':
          this.notes(ctx, [392, 330, 262, 196], 0.08, 'square', 0.2);
          break;
        case 'coin':
          this.notes(ctx, [988, 1319], 0.07, 'square', 0.15);
          break;
        case 'buy':
          this.notes(ctx, [784, 988, 1319], 0.06, 'square', 0.15);
          break;
        case 'levelUp':
          this.notes(ctx, [392, 494, 587, 784], 0.09, 'triangle', 0.3);
          break;
        case 'stairs':
          this.notes(ctx, [330, 392, 494, 659], 0.11, 'triangle', 0.28);
          break;
        case 'win':
          this.notes(ctx, [392, 392, 523, 659, 784, 659, 784, 1047], 0.14, 'triangle', 0.3);
          break;
        case 'lose':
          this.notes(ctx, [330, 294, 262, 220, 165], 0.2, 'sawtooth', 0.18);
          break;
      }
    } catch {
      // A sound that fails to play must never stop the game.
    }
  }
}

export const sfx = new Sfx();
