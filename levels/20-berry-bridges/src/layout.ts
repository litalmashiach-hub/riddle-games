import type { Vec3 } from '@riddle/fx';
import { BRIDGES, ON_RAFT } from './rules';

/** Islet centres on the water (x, z). Slightly uneven, so it reads as a pond and not a chessboard. */
export const ISLET_XZ: [number, number][] = [
  [-4.2, -1.8], [-1.0, -2.0], [2.25, -1.95], [5.45, -1.75],
  [-4.25, 1.55], [-1.05, 1.45], [2.2, 1.6], [5.4, 1.5],
];
export const ISLET_R = 0.92;
/** Height of an islet's mossy top. */
export const TOP = 0.2;
/** Off to the left of the islets, clear of the game's bottom buttons on a phone held sideways. */
export const RAFT: Vec3 = [-7.2, 0.1, 0.2];

/** Where Bramble stands: toward the front of the islet, leaving the back for its landmark. */
export const standAt = (islet: number): Vec3 => (islet === ON_RAFT ? RAFT : [ISLET_XZ[islet][0], TOP, ISLET_XZ[islet][1] + 0.22]);

export interface Span {
  /** Ends of the planks, at the islets' edges. */
  a: [number, number];
  b: [number, number];
  mid: [number, number];
  length: number;
  /** Angle of the walking direction around the y axis. */
  yaw: number;
}

export const SPANS: Span[] = BRIDGES.map(([p, q]) => {
  const [ax, az] = ISLET_XZ[p];
  const [bx, bz] = ISLET_XZ[q];
  const d = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / d;
  const uz = (bz - az) / d;
  const inset = ISLET_R - 0.1;
  const a: [number, number] = [ax + ux * inset, az + uz * inset];
  const b: [number, number] = [bx - ux * inset, bz - uz * inset];
  return { a, b, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], length: d - inset * 2, yaw: Math.atan2(ux, uz) };
});
