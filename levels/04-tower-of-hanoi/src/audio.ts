import { useSettings } from '@riddle/fx';

/** Each disc rings its own note when it lands (bigger disc, lower note), plus a soft stone knock. */
let ac: AudioContext | null = null;
const NOTES = [0, 880, 698.5, 587.3, 440];

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

export function chime(size: number) {
  if (!useSettings.getState().sound) return;
  const a = ctx();
  if (!a) return;
  const t = a.currentTime;
  // A bell-like note: a few slightly detuned partials that fade out.
  for (const [mult, gain, dur] of [
    [1, 0.11, 1.2],
    [2.01, 0.035, 0.7],
    [3.03, 0.018, 0.4],
  ]) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = NOTES[size] * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  // Stone knock.
  const len = Math.ceil(a.sampleRate * 0.08);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const g = a.createGain();
  g.gain.value = 0.25;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** Cartoon spring "boing": a wobbly pitch bend. */
export function boing() {
  if (!useSettings.getState().sound) return;
  const a = ctx();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  const g = a.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(220, t + 0.55);
  lfo.frequency.setValueAtTime(18, t);
  lfo.frequency.linearRampToValueAtTime(9, t + 0.55);
  lfoGain.gain.value = 35;
  lfo.connect(lfoGain).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(a.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.65);
  lfo.stop(t + 0.65);
}

/** A cheeky little monkey giggle: quick bouncing chirps. */
export function giggle() {
  if (!useSettings.getState().sound) return;
  const a = ctx();
  if (!a) return;
  const t0 = a.currentTime;
  for (let i = 0; i < 6; i++) {
    const t = t0 + i * 0.11;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'square';
    const f = 900 - i * 45 + (i % 2) * 120;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.04);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.1);
  }
}
