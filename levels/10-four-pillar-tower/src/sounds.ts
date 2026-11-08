import { useSettings } from '@riddle/fx';

/** Level-only sound effects, synthesized with WebAudio so no files are needed. */
let actx: AudioContext | null = null;
function audio() {
  if (!useSettings.getState().sound || typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  actx ??= new AC();
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}

function note(a: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(a.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

/** A short metallic clank. Higher pitch for smaller cogs. */
export function clank(pitch = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  [1, 2.76, 5.4].forEach((m, i) => note(a, 330 * pitch * m, t, 0.35 / (i + 1), i === 0 ? 'triangle' : 'sine', 0.12 / (i + 1)));
}

/** A soft cartoon "bonk" with a puff of air. */
export function bonk() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  note(a, 260, t, 0.16, 'square', 0.07, 90);
  note(a, 130, t, 0.25, 'triangle', 0.16, 70);
  const len = Math.ceil(a.sampleRate * 0.35);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1400;
  const g = a.createGain();
  g.gain.value = 0.16;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t + 0.02);
}

/** Tock's little "uh-oh". */
export function uhOh() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.12;
  note(a, 620, t, 0.16, 'triangle', 0.1, 600);
  note(a, 440, t + 0.17, 0.26, 'triangle', 0.1, 400);
}
