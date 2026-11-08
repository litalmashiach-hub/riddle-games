import { useSettings } from '@riddle/fx';

/** Extra cartoon sounds for this level (WebAudio, no files). */
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

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number, vibrato = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  if (vibrato) {
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 18;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const frogSfx = {
  /** Short frog croak. */
  ribbit: (pitch = 1) => {
    tone(260 * pitch, 0.09, 'square', 0.05, 0, 180 * pitch);
    tone(300 * pitch, 0.12, 'square', 0.05, 0.11, 200 * pitch);
  },
  /** Springy leap. */
  leap: () => tone(220, 0.35, 'sine', 0.12, 0, 900),
  /** Soft landing on a pad. */
  plop: () => tone(520, 0.12, 'sine', 0.1, 0, 160),
  /** Two heads meeting. */
  bonk: () => {
    tone(140, 0.18, 'square', 0.12, 0, 70);
    tone(1200, 0.08, 'triangle', 0.08, 0, 600);
  },
  /** Wobbly cartoon spring. */
  boing: () => tone(180, 0.6, 'sine', 0.12, 0, 520, 40),
  /** Slide-whistle fall. */
  whistle: () => tone(1400, 0.6, 'sine', 0.07, 0, 300),
  /** Bubbles after a splash. */
  glub: () => {
    tone(300, 0.08, 'sine', 0.08, 0, 600);
    tone(260, 0.08, 'sine', 0.08, 0.14, 560);
    tone(320, 0.08, 'sine', 0.08, 0.3, 700);
  },
};
