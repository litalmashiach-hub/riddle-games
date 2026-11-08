import { useSettings } from './settings';

/**
 * Tiny synthesized sound effects (WebAudio), so levels get sound with no audio files.
 * Swap for recorded sounds later if wanted.
 */
let ctx: AudioContext | null = null;
const audio = () => {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15, delay = 0, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain = 0.12, filterFreq = 900, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const on = () => useSettings.getState().sound;

export const sfx = {
  click: () => on() && tone(660, 0.08, 'triangle', 0.08),
  select: () => on() && tone(520, 0.12, 'sine', 0.1, 0, 780),
  deselect: () => on() && tone(600, 0.12, 'sine', 0.08, 0, 400),
  hop: () => on() && tone(300, 0.18, 'sine', 0.1, 0, 620),
  splash: () => on() && noise(0.5, 0.14, 1200),
  row: () => {
    if (!on()) return;
    noise(0.35, 0.08, 600);
    noise(0.35, 0.08, 600, 0.5);
  },
  denied: () => on() && tone(180, 0.2, 'square', 0.05),
  win: () => {
    if (!on()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.12, i * 0.11));
  },
  lose: () => {
    if (!on()) return;
    tone(330, 0.35, 'sawtooth', 0.06, 0, 220);
    tone(220, 0.6, 'sawtooth', 0.06, 0.3, 110);
  },
  growl: () => on() && tone(90, 0.6, 'sawtooth', 0.1, 0, 60),
};
