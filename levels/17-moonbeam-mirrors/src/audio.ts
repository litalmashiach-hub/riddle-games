import { useSettings } from '@riddle/fx';

/** Level sounds, synthesized with WebAudio (no files). */
let ctx: AudioContext | null = null;
const audio = () => {
  if (!useSettings.getState().sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, freq: number, delay = 0, type: BiquadFilterType = 'bandpass') {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const moonSfx = {
  /** A crystal turning: a glassy two-note chime. */
  turn: () => {
    tone(1568, 0.5, 'sine', 0.07);
    tone(2349, 0.6, 'sine', 0.045, 0.06);
    tone(3136, 0.35, 'triangle', 0.02, 0.1);
  },
  /** A moon-flower opening. */
  bloom: (i = 0) => {
    const base = [784, 880, 988, 1175][i % 4];
    tone(base, 0.7, 'triangle', 0.06, 0, base * 1.5);
    tone(base * 2, 0.5, 'sine', 0.03, 0.08);
  },
  /** Beam bouncing off a crystal. */
  ping: () => tone(2637, 0.18, 'sine', 0.025),
  snore: () => {
    tone(110, 0.9, 'sawtooth', 0.025, 0, 85);
    noise(0.9, 0.05, 300, 0, 'lowpass');
  },
  ah: (n = 0) => tone(330 + n * 90, 0.45, 'triangle', 0.08, 0, 420 + n * 110),
  choo: () => {
    noise(0.55, 0.35, 2600, 0, 'highpass');
    tone(520, 0.25, 'square', 0.05, 0, 180);
  },
  sniff: () => {
    noise(0.12, 0.12, 3000, 0, 'highpass');
    noise(0.12, 0.12, 3200, 0.18, 'highpass');
  },
  moonset: () => {
    [784, 659, 523, 392].forEach((f, i) => tone(f, 0.55, 'sine', 0.06, i * 0.22));
  },
  yawn: () => tone(260, 1.2, 'triangle', 0.07, 0, 140),
  rumble: () => noise(0.4, 0.2, 140, 0, 'lowpass'),
};
