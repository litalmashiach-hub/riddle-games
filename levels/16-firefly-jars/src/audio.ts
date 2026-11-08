import { useSettings } from '@riddle/fx';

/** Small synthesized firefly sounds for this level. */
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

function note(a: AudioContext, t: number, f: number, dur: number, gain: number, type: OscillatorType = 'sine', slide?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A buzzing wing sound: a low saw with a fast wobble. */
function buzzAt(a: AudioContext, t: number, dur: number, base: number, gain: number, wobble = 30) {
  const o = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, t);
  lfo.frequency.value = wobble;
  lfoGain.gain.value = base * 0.08;
  lfo.connect(lfoGain).connect(o.frequency);
  f.type = 'bandpass';
  f.frequency.value = base * 4;
  f.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(a.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

/** Pitch of each colour's little chime. */
const PITCH = { gold: 784, pink: 880, mint: 988, sky: 1175 } as const;

/** A firefly lifts off. */
export function liftSound() {
  const a = audio();
  if (!a) return;
  buzzAt(a, a.currentTime, 0.28, 210, 0.05);
  note(a, a.currentTime, 600, 0.12, 0.05, 'sine', 900);
}

/** A firefly flies across. */
export function flySound() {
  const a = audio();
  if (!a) return;
  buzzAt(a, a.currentTime, 0.6, 240, 0.045, 22);
}

/** Lands in a jar: a soft glassy tink, pitched by colour. */
export function landSound(color: keyof typeof PITCH) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  note(a, t, PITCH[color] * 2, 0.25, 0.05, 'sine');
  note(a, t, PITCH[color] * 3.01, 0.18, 0.02, 'sine');
}

/** A whole jar of one colour: a sparkly arpeggio. */
export function jarDoneSound(color: keyof typeof PITCH) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  [1, 1.25, 1.5, 2].forEach((m, i) => note(a, t + i * 0.07, PITCH[color] * m, 0.35, 0.06, 'triangle'));
}

/** Grumbly "hmph" buzz from the fireflies. */
export function grumbleSound() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  buzzAt(a, t, 0.35, 130, 0.06, 12);
  buzzAt(a, t + 0.3, 0.3, 110, 0.05, 12);
}

/** The whole swarm buzzing angrily. */
export function swarmSound(durationMs: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const dur = durationMs / 1000;
  [150, 190, 233, 270].forEach((f, i) => buzzAt(a, t + i * 0.05, dur, f, 0.035, 18 + i * 7));
}
