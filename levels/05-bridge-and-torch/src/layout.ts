import type { Vec3 } from '@riddle/fx';
import type { Explorer, Side } from './rules';

/** Shared measurements of the diorama, so the scene, bridge and characters agree. */

/** The bridge deck runs from -BRIDGE_HALF to +BRIDGE_HALF on x. */
export const BRIDGE_HALF = 3.4;
export const BRIDGE_SAG = 0.48;
/** Cliff edge (|x|) near the bridge. */
export const EDGE = 3.3;

export const sign = (s: Side) => (s === 'L' ? -1 : 1);

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

/** Where the cliff edge is at depth z (jagged away from the bridge, straight at it). */
export const edgeAt = (z: number) => EDGE + (vnoise(z * 0.55, 3.1) - 0.35) * 1.1 * smooth(1.2, 3.5, Math.abs(z));

/** Height of the cliff tops (and the chasm walls) at (x, z). */
export function groundY(x: number, z: number) {
  const ax = Math.abs(x);
  const edge = edgeAt(z);
  const far = Math.max(0, ax - edge);
  // Flat camp near the bridge, gentle bumps further out, tall canyon walls at the back and sides.
  const bumps = (vnoise(x * 0.45, z * 0.45) - 0.5) * 0.5 * smooth(2.2, 5, far);
  const back = smooth(-4.5, -13, z) * (4 + vnoise(x * 0.25, 7) * 5) * smooth(0.2, 2.5, far);
  const sides = smooth(9.5, 16, ax) * (3 + vnoise(z * 0.3, x * 0.1) * 3);
  const top = bumps + back + sides;
  // The chasm: steep walls with a few ledges.
  const wall = smooth(edge + 0.05, edge - 0.85, ax);
  const ledge = (vnoise(z * 0.8, ax * 2) - 0.5) * 1.2;
  return top * (1 - wall) + (-13 + ledge) * wall;
}

/** Deck height of the bridge at x (before anyone steps on it). */
export const deckY = (x: number) => -BRIDGE_SAG * (1 - Math.min(1, (x / BRIDGE_HALF) ** 2)) + 0.05;

/** How far the planks dip under a walker standing at `wx`. */
export const DIP = 0.11;
export const dipAt = (x: number, wx: number) => DIP * Math.exp(-((x - wx) ** 2) / 0.9) * (1 - (x / BRIDGE_HALF) ** 2);

/** Where each explorer waits on each side, in an arc around the bridgehead. */
const SLOTS: Record<Explorer, { x: number; z: number }> = {
  pip: { x: 4.4, z: 1.75 },
  juno: { x: 5.5, z: 1.2 },
  bram: { x: 6.35, z: 0.2 },
  mo: { x: 5.3, z: -0.95 },
};
export const slot = (e: Explorer, side: Side): Vec3 => {
  const x = sign(side) * SLOTS[e].x;
  const z = SLOTS[e].z;
  return [x, groundY(x, z), z];
};

/** Where a walker waits at the bridgehead before crossing. `lane` is -1, 0 or 1. */
export const bridgehead = (side: Side, lane: number): Vec3 => {
  const x = sign(side) * 3.85;
  const z = lane * 0.24;
  return [x, groundY(x, z), z];
};

/** The torch stand on each side. */
export const sconce = (side: Side): Vec3 => [sign(side) * 3.95, 0, -0.95];
export const TORCH_REST_Y = 0.62;
