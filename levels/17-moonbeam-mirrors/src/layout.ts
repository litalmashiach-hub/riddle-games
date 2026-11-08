import { COLS, LAYOUT, ROWS, trace, type State } from './rules';

/** Distance between lily pad centres. */
export const S = 1.3;
/** Height of the moonbeam above the water. */
export const BEAM_Y = 0.52;
export const PAD_Y = 0.04;

export type V3 = [number, number, number];

/** Grid cell (column, row) to world x/z. Fractions are fine (beam ends sit between cells). */
export const cellX = (c: number) => (c - (COLS - 1) / 2) * S;
export const cellZ = (r: number) => (r - (ROWS - 1) / 2) * S;
export const cellPos = (c: number, r: number, y = 0): V3 => [cellX(c), y, cellZ(r)];

/** Where the moonstone lantern sits (one cell outside the grid, where the beam enters). */
export const SOURCE: V3 = cellPos(LAYOUT.source.c - 0.4, LAYOUT.source.r, 0);

/** The beam as a polyline in world space, with distances along it. */
export interface BeamPath {
  pts: THREE_V2[];
  /** Cumulative distance at each point. */
  dist: number[];
  total: number;
  /** Distance at which each flower is first reached (Infinity = never). */
  flowerAt: number[];
  end: 'toad' | 'rock' | 'edge' | 'loop';
  /** Distance at which each mirror is first hit (Infinity = never). */
  mirrorAt: number[];
}
export type THREE_V2 = [number, number];

const toWorld = ([c, r]: [number, number]): THREE_V2 => [cellX(c), cellZ(r)];

export function beamPath(state: State): BeamPath {
  const t = trace(state);
  const pts: THREE_V2[] = [];
  t.segs.forEach((s, i) => {
    if (i === 0) {
      // Start at the lantern's orb instead of the grid edge.
      const [dc, dr] = [Math.sign(s.to[0] - s.from[0]), Math.sign(s.to[1] - s.from[1])];
      pts.push(toWorld([s.from[0] - dc * 0.72, s.from[1] - dr * 0.72]));
    }
    let to = s.to;
    if (i === t.segs.length - 1 && t.end === 'edge') {
      // Let the beam shoot off far across the lagoon.
      const [dc, dr] = [Math.sign(s.to[0] - s.from[0]), Math.sign(s.to[1] - s.from[1])];
      to = [s.to[0] + dc * 2.2, s.to[1] + dr * 2.2];
    }
    if (i === t.segs.length - 1 && t.end === 'toad') {
      const [dc, dr] = [Math.sign(s.to[0] - s.from[0]), Math.sign(s.to[1] - s.from[1])];
      to = [s.to[0] - dc * 0.3, s.to[1] - dr * 0.3];
    }
    pts.push(toWorld(to));
  });
  const dist = [0];
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = dist[dist.length - 1] ?? 0;
  const along = (x: number, z: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      const minX = Math.min(ax, bx) - 0.01, maxX = Math.max(ax, bx) + 0.01;
      const minZ = Math.min(az, bz) - 0.01, maxZ = Math.max(az, bz) + 0.01;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return dist[i - 1] + Math.hypot(x - ax, z - az);
    }
    return Infinity;
  };
  const flowerAt = LAYOUT.flowers.map((f, i) => (t.lit.includes(i) ? along(cellX(f.c), cellZ(f.r)) : Infinity));
  const mirrorAt = LAYOUT.mirrors.map((m, i) => (t.bounced.includes(i) ? along(cellX(m.c), cellZ(m.r)) : Infinity));
  return { pts, dist, total, flowerAt, end: t.end, mirrorAt };
}

/** How much of the new beam is the same as the old one (so only the changed part regrows). */
export function sharedLength(a: BeamPath, b: BeamPath) {
  let d = 0;
  for (let i = 1; i < Math.min(a.pts.length, b.pts.length); i++) {
    const [a0, a1] = [a.pts[i - 1], a.pts[i]];
    const [b0, b1] = [b.pts[i - 1], b.pts[i]];
    if (a0[0] !== b0[0] || a0[1] !== b0[1]) return d;
    if (a1[0] === b1[0] && a1[1] === b1[1]) {
      d = b.dist[i];
      continue;
    }
    // Same start: if they head the same way, they share the shorter part.
    const da = [Math.sign(a1[0] - a0[0]), Math.sign(a1[1] - a0[1])];
    const db = [Math.sign(b1[0] - b0[0]), Math.sign(b1[1] - b0[1])];
    if (da[0] === db[0] && da[1] === db[1]) return b.dist[i - 1] + Math.min(a.dist[i] - a.dist[i - 1], b.dist[i] - b.dist[i - 1]);
    return d;
  }
  return d;
}

/** Point at distance `d` along the beam. */
export function pointAt(p: BeamPath, d: number, out: THREE_V2 = [0, 0]): THREE_V2 {
  if (p.pts.length === 0) return out;
  for (let i = 1; i < p.pts.length; i++) {
    if (d <= p.dist[i] || i === p.pts.length - 1) {
      const seg = p.dist[i] - p.dist[i - 1] || 1;
      const k = Math.min(1, Math.max(0, (d - p.dist[i - 1]) / seg));
      out[0] = p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * k;
      out[1] = p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * k;
      return out;
    }
  }
  return out;
}
