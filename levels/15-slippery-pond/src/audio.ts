import { useSettings } from '@riddle/fx';

/** Little synthesized sounds for the pond (sliding, bonks, splashes). */
let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === 'undefined' || !useSettings.getState().sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(a: AudioContext, t: number, f: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function hiss(a: AudioContext, t: number, dur: number, gain: number, type: BiquadFilterType, from: number, to = from, q = 1) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const env = Math.min(1, i / (a.sampleRate * 0.03)) * Math.pow(1 - i / d.length, 1.4);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const run = (fn: (a: AudioContext, t: number) => void) => () => {
  const a = audio();
  if (a) fn(a, a.currentTime);
};

export const pond = {
  /** Push off: a little "hup!" */
  hup: run((a, t) => tone(a, t, 420, 0.12, 0.08, 'triangle', 700)),
  /** Whoosh along the ice; longer slides whoosh longer. */
  slide: (seconds: number) =>
    run((a, t) => {
      hiss(a, t, seconds, 0.16, 'bandpass', 2600, 1200, 2.5);
      tone(a, t, 900, Math.min(seconds, 0.5), 0.02, 'sine', 1500);
    })(),
  bonk: run((a, t) => {
    tone(a, t, 520, 0.18, 0.14, 'square', 140);
    tone(a, t + 0.05, 1400, 0.25, 0.05, 'sine', 1900);
    tone(a, t + 0.2, 1600, 0.25, 0.04, 'sine', 2100);
  }),
  thud: run((a, t) => {
    hiss(a, t, 0.25, 0.2, 'lowpass', 500, 200);
    tone(a, t, 140, 0.2, 0.12, 'sine', 70);
  }),
  poof: run((a, t) => hiss(a, t, 0.45, 0.22, 'lowpass', 3000, 400)),
  uhoh: run((a, t) => {
    tone(a, t, 660, 0.18, 0.1, 'triangle');
    tone(a, t + 0.2, 440, 0.32, 0.1, 'triangle', 380);
  }),
  whistle: run((a, t) => tone(a, t, 1800, 0.34, 0.05, 'sine', 300)),
  splash: run((a, t) => {
    hiss(a, t, 0.9, 0.35, 'lowpass', 4000, 300);
    tone(a, t, 300, 0.4, 0.12, 'sine', 80);
    [0.15, 0.3, 0.42, 0.55].forEach((d, i) => tone(a, t + d, 700 + i * 180, 0.08, 0.05, 'sine', 1300 + i * 200));
  }),
  bloop: run((a, t) => {
    tone(a, t, 260, 0.14, 0.12, 'sine', 820);
    tone(a, t + 0.18, 320, 0.12, 0.08, 'sine', 900);
  }),
  brrr: run((a, t) => {
    for (let i = 0; i < 10; i++) tone(a, t + i * 0.045, 230 + (i % 2) * 40, 0.05, 0.06, 'sawtooth');
  }),
  yum: run((a, t) => {
    [660, 880, 1100].forEach((f, i) => tone(a, t + i * 0.09, f, 0.16, 0.08, 'triangle'));
  }),
};
