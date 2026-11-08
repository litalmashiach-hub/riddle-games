import { useSettings } from '@riddle/fx';

/** Small synthesized water sounds for this level (the shared sfx has no pouring sound). */
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

function blip(a: AudioContext, t: number, f: number, dur: number, gain: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 1.9, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(a: AudioContext, t: number, dur: number, gain: number, freq: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const env = Math.min(1, i / (a.sampleRate * 0.08)) * Math.min(1, (d.length - i) / (a.sampleRate * 0.15));
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** Running water with glugs. A pour into a jug glugs higher as it fills. */
export function pourSound(durationMs: number, kind: 'fill' | 'pour' | 'splash') {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const dur = durationMs / 1000;
  hiss(a, t0, dur, kind === 'splash' ? 0.16 : 0.07, kind === 'splash' ? 900 : 2200);
  const glugs = kind === 'splash' ? 5 : 9;
  for (let i = 0; i < glugs; i++) {
    const k = i / glugs;
    const base = kind === 'splash' ? 180 : 260 + k * 420; // rising pitch as the jug fills
    blip(a, t0 + k * dur * 0.95 + Math.random() * 0.04, base * (0.9 + Math.random() * 0.2), 0.07, 0.07);
  }
}

/** Squeaky pump handle. */
export function pumpSound() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t + i * 0.3);
    o.frequency.exponentialRampToValueAtTime(1300, t + i * 0.3 + 0.12);
    g.gain.setValueAtTime(0.0001, t + i * 0.3);
    g.gain.exponentialRampToValueAtTime(0.03, t + i * 0.3 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.14);
    o.connect(g).connect(a.destination);
    o.start(t + i * 0.3);
    o.stop(t + i * 0.3 + 0.2);
  }
}
