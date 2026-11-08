import { easeInOut, type Vec3 } from '@riddle/fx';
import { CAPACITY, otherJug, type JugId, type Move, type State } from './rules';

// ---- Timeline of one move (ms) ----
export const GO_MS = 560; // hop to the pump, the pier or the other jug
export const TILT_MS = 320; // tip the jug
export const FLOW_MS = 1050; // water runs
export const UNTILT_MS = 280;
export const RETURN_MS = 520; // hop home
export const MOVE_MS = GO_MS + TILT_MS + FLOW_MS + UNTILT_MS + RETURN_MS;
export const FLOW_START = GO_MS + TILT_MS;
export const FLOW_END = FLOW_START + FLOW_MS;
/** Undo and restart glide everything home this fast. */
export const BACK_MS = 450;

// ---- The yard ----
/** Top of the cobbled yard where the jugs stand. */
export const YARD_Y = 0.6;
export const YARD_CENTER: [number, number] = [5.3, -0.3];
export const YARD_RADIUS = 2.0;
/** Top of the right-hand pier boards (from RiverValley). */
export const PIER_Y = 0.315;
export const PIER_Z = -1.15;
/** Where an emptying jug's lip hangs over the river. */
export const PIER_LIP_X = 2.3;

export const FILL_BASE: Vec3 = [5.0, YARD_Y, -1.25];
export const SPOUT: Vec3 = [5.0, YARD_Y + 1.36, -1.25];
export const PUMP_POS: Vec3 = [5.52, YARD_Y, -1.3];

// ---- The jugs ----
export interface JugDims {
  /** Outer radius. */
  r: number;
  /** Height of the measured part (0 to full). */
  hc: number;
  /** Glass bottom thickness. */
  base: number;
  /** Total glass height (lip). */
  h: number;
}
const dims = (r: number, hc: number): JugDims => ({ r, hc, base: 0.04, h: 0.04 + hc + 0.07 });
export const DIMS: Record<JugId, JugDims> = { small: dims(0.25, 0.6), big: dims(0.29, 0.76) };

export const HOME: Record<JugId, Vec3> = {
  small: [4.15, YARD_Y, 0.7],
  big: [5.45, YARD_Y, 0.7],
};

/** Height (above the jug's base) of the water when it holds `litres`. */
export const waterHeight = (id: JugId, litres: number) => DIMS[id].base + (litres / CAPACITY[id]) * DIMS[id].hc;

/** Where the moving jug goes for a move, which way it tips, how far, and where its lip ends up. */
export function moverSpot(m: Move, prev: State): { base: Vec3; dir: 1 | -1; tilt: number; lip: Vec3 } {
  const d = DIMS[m.jug];
  if (m.kind === 'fill') {
    return { base: FILL_BASE, dir: 1, tilt: 0, lip: [FILL_BASE[0], FILL_BASE[1] + d.h, FILL_BASE[2]] };
  }
  const fullness = prev[m.jug] / CAPACITY[m.jug];
  // Less water means tipping further to get it out.
  const tilt = 1.2 + (1 - fullness) * 0.45;
  if (m.kind === 'empty') {
    const lip: Vec3 = [PIER_LIP_X, PIER_Y + d.h, PIER_Z];
    return { base: [PIER_LIP_X + d.r, PIER_Y, PIER_Z], dir: -1, tilt, lip };
  }
  const to = otherJug(m.jug);
  const dir = HOME[to][0] > HOME[m.jug][0] ? 1 : -1;
  const t = HOME[to];
  const lip: Vec3 = [t[0] - dir * DIMS[to].r * 0.25, t[1] + DIMS[to].h + 0.3, t[2]];
  return { base: [lip[0] - dir * d.r, lip[1] - d.h, lip[2]], dir, tilt, lip };
}

/** Start and end of the water stream for a move. `ctrl` bends it like water leaving a lip. */
export function streamPath(m: Move, prev: State, next: State): { from: Vec3; ctrl: Vec3; to: Vec3; river: boolean } {
  if (m.kind === 'fill') {
    const to: Vec3 = [FILL_BASE[0], FILL_BASE[1] + waterHeight(m.jug, next[m.jug]), FILL_BASE[2]];
    return { from: SPOUT, ctrl: [(SPOUT[0] + to[0]) / 2, (SPOUT[1] + to[1]) / 2, SPOUT[2]], to, river: false };
  }
  const { lip, dir } = moverSpot(m, prev);
  const from: Vec3 = [lip[0] + dir * 0.02, lip[1], lip[2]];
  const ctrl: Vec3 = [lip[0] + dir * 0.2, lip[1] + 0.05, lip[2]];
  if (m.kind === 'empty') return { from, ctrl, to: [lip[0] - 0.6, 0.0, lip[2]], river: true };
  const t = otherJug(m.jug);
  const to: Vec3 = [HOME[t][0], HOME[t][1] + waterHeight(t, next[t]), HOME[t][2]];
  return { from, ctrl, to, river: false };
}

// ---- Shared animation clock ----
/** One animation the scene is playing: a forward move, or a quick glide back (undo / restart). */
export interface Anim {
  id: number;
  forward: boolean;
  move: Move | null;
  prev: State;
  next: State;
  start: number;
}

export const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
export const phase = (el: number, start: number, dur: number) => easeInOut(clamp01((el - start) / dur));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
