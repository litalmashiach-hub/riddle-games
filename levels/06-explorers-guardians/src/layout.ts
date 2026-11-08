import type { Vec3 } from '@riddle/fx';
import type { Side, Who } from './rules';

/** Shared numbers for the cavern lake, used by the scene, the terrain and the water shader. */

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Half-width of the lake at depth z. It widens into a pool under the waterfall at the back. */
export function lakeHalf(z: number) {
  return 2.9 + 1.4 * smooth(-3, -6.5, z) + Math.sin(z * 0.8 + 1.3) * 0.25 * smooth(2.5, 5, Math.abs(z));
}

/** The flat temple floor that each bank's characters stand on. */
export const DECK_Y = 0.4;
export const DECK = { inner: 2.95, outer: 6.2, back: -2.2, front: 2.2 };
/** The far end of the lake: the cliff with the carved face. */
export const BACK_WALL_Z = -7.6;

/** Height of the cave floor and walls at (x, z). */
export function floorHeight(x: number, z: number) {
  const ax = Math.abs(x);
  const d = ax - lakeHalf(z);
  const n = vnoise(x * 0.45, z * 0.45);
  const n2 = vnoise(x * 1.3 + 7, z * 1.3);
  const bank = -0.85 + 1.2 * smooth(-0.7, 0.35, d);
  const wallStart = 4.2 - 1.9 * smooth(-2.6, -5.0, z);
  const side = smooth(wallStart, wallStart + 3.4, d) * (6.5 + n * 3.5);
  const back = smooth(BACK_WALL_Z, BACK_WALL_Z - 1.6, z) * (8 + n * 2);
  const ledges = (n2 - 0.5) * 0.9 * smooth(wallStart - 0.5, wallStart + 1.5, d);
  const bumps = (n - 0.5) * 0.35 * smooth(0.6, 1.6, d) * smooth(2.6, 3.4, Math.abs(z));
  return bank + side + back + ledges + bumps;
}

export const sign = (s: Side) => (s === 'L' ? -1 : 1);
export const BOAT_X = 1.6;
export const boatX = (s: Side) => sign(s) * BOAT_X;
export const BOAT_Y = 0.13;

/**
 * Seat `i` in the barge, for a barge moored at `boatSide` that was boarded from `boardedFrom`.
 * Seat 0 is the end nearest the boarding bank, seat 1 the far end. Seats stay put in the barge
 * during the crossing, so after landing the far seat is nearest the new bank.
 */
export const seat = (boatSide: Side, boardedFrom: Side, i: number): Vec3 => [
  boatX(boatSide) + sign(boardedFrom) * (i === 0 ? 0.5 : -0.5),
  BOAT_Y,
  0,
];

const SLOTS: Record<Who, { x: number; z: number }> = {
  e0: { x: 3.55, z: 0.95 },
  e1: { x: 4.3, z: 1.15 },
  e2: { x: 5.05, z: 0.95 },
  g0: { x: 3.65, z: -0.8 },
  g1: { x: 4.5, z: -1.0 },
  g2: { x: 5.35, z: -0.8 },
};

/** Where someone stands on a bank. */
export const slot = (w: Who, side: Side): Vec3 => [sign(side) * SLOTS[w].x, DECK_Y, SLOTS[w].z];
