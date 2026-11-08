import { useSettings } from '@riddle/fx';

/** A few pond sounds made with WebAudio, so the level needs no audio files. */
let ctx: AudioContext | null = null;
function audio() {
  if (!useSettings.getState().sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

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
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, freq: number, delay = 0, type: BiquadFilterType = 'lowpass') {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const pond = {
  /** Water swishing past a sliding log. */
  slide: () => noise(0.45, 0.1, 700),
  /** A hollow wooden knock when a log bumps to a stop. */
  thunk: () => {
    tone(190, 0.16, 'triangle', 0.16, 0, 120);
    tone(420, 0.06, 'square', 0.03);
  },
  quack: (delay = 0, pitch = 1) => {
    tone(520 * pitch, 0.13, 'sawtooth', 0.07, delay, 380 * pitch);
    tone(560 * pitch, 0.13, 'square', 0.03, delay + 0.01, 400 * pitch);
  },
  peep: (delay = 0) => tone(1500, 0.09, 'sine', 0.06, delay, 2100),
  croak: (delay = 0) => {
    tone(120, 0.22, 'sawtooth', 0.08, delay, 90);
    tone(150, 0.18, 'square', 0.03, delay + 0.03, 100);
  },
  bigSplash: () => {
    noise(0.9, 0.22, 1600);
    noise(0.5, 0.12, 400, 0.05);
    tone(600, 0.25, 'sine', 0.06, 0.02, 180);
  },
  bloop: () => tone(300, 0.2, 'sine', 0.1, 0, 700),
  select: () => tone(700, 0.1, 'sine', 0.07, 0, 980),
  sparkle: () => [1320, 1760, 2350].forEach((f, i) => tone(f, 0.25, 'sine', 0.04, i * 0.07)),
};
