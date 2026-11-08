import { useSettings } from '@riddle/fx';
import * as THREE from 'three';

/** Gold coin face with an engraved number, drawn on a canvas (no image files). */
export function coinFaceTexture(label: string) {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const mid = s / 2;
  const grad = g.createRadialGradient(mid * 0.8, mid * 0.7, 10, mid, mid, mid);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.55, '#f2c450');
  grad.addColorStop(1, '#b97f1c');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  // Raised rim and a ring of dots.
  g.lineWidth = 10;
  g.strokeStyle = '#a86d12';
  g.beginPath();
  g.arc(mid, mid, mid - 14, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = '#ffe9a0';
  g.beginPath();
  g.arc(mid, mid, mid - 22, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#b07514';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.beginPath();
    g.arc(mid + Math.cos(a) * (mid - 34), mid + Math.sin(a) * (mid - 34), 3.2, 0, Math.PI * 2);
    g.fill();
  }
  // Engraved number: dark fill with a light lower edge.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${label.length > 1 ? 112 : 130}px Georgia, 'Times New Roman', serif`;
  g.fillStyle = '#fff6d0';
  g.fillText(label, mid + 3, mid + 10);
  g.fillStyle = '#6b3f07';
  g.fillText(label, mid, mid + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A cog outline, extruded. Origin at its centre, facing +z. */
export function gearGeometry(radius: number, teeth: number, depth = 0.14, hole = 0.25) {
  const shape = new THREE.Shape();
  const inner = radius * 0.84;
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 4 === 1 || i % 4 === 2 ? radius : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, radius * hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  // Spokes cut-outs make it read as a gear from far away.
  const spokes = teeth > 10 ? 5 : 0;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + 0.3;
    const p = new THREE.Path();
    const r0 = radius * 0.38;
    const r1 = radius * 0.7;
    const w = (Math.PI * 2) / spokes / 2.6;
    p.moveTo(Math.cos(a - w) * r0, Math.sin(a - w) * r0);
    p.absarc(0, 0, r1, a - w, a + w, false);
    p.lineTo(Math.cos(a + w) * r0, Math.sin(a + w) * r0);
    p.absarc(0, 0, r0, a + w, a - w, true);
    shape.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ---- Little synthesized sounds for metal and coins (WebAudio, respects the sound setting) ----
let ctx: AudioContext | null = null;
function audio() {
  if (!useSettings.getState().sound || typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function ping(freqs: number[], dur: number, gain: number, type: OscillatorType = 'sine', delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  for (const f of freqs) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
function hiss(dur: number, gain: number, freq: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const vaultSfx = {
  clink: () => ping([2350 + Math.random() * 300, 3520 + Math.random() * 200], 0.25, 0.05),
  clank: () => {
    ping([180, 271, 433], 0.5, 0.08, 'triangle');
    hiss(0.08, 0.15, 2500);
  },
  creak: () => {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(115, t + 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.9);
  },
  chime: () => [880, 1320].forEach((f, i) => ping([f], 0.7, 0.06, 'sine', i * 0.12)),
  thud: () => ping([95, 140], 0.45, 0.12, 'triangle'),
  steam: () => hiss(1.1, 0.12, 1800),
  door: () => {
    ping([60, 90], 1.6, 0.1, 'sawtooth');
    hiss(1.4, 0.06, 900, 0.1);
  },
  giggle: () => [990, 1170, 990, 1250].forEach((f, i) => ping([f], 0.12, 0.05, 'square', i * 0.09)),
};
