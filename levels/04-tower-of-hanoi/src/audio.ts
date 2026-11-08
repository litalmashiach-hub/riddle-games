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
