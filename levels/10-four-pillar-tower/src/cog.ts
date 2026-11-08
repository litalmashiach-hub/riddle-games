import * as THREE from 'three';

const cache = new Map<string, THREE.ExtrudeGeometry>();

export interface CogOptions {
  /** Outer radius at the tooth tips. */
  radius: number;
  /** Total height of the cog, including the bevel. */
  height: number;
  /** Radius of the axle hole in the middle. */
  hole?: number;
  /** Tooth depth. */
  tooth?: number;
  /** Round "lightening" holes between hub and rim (0 = none). */
  windows?: number;
}

/**
 * A chunky low-poly gear, lying flat (axle along +y), bottom at y = 0.
 * Geometries are cached, so many cogs of the same size share one.
 */
export function cogGeometry({ radius, height, hole = 0.14, tooth = 0.1, windows = 0 }: CogOptions) {
  const key = [radius, height, hole, tooth, windows].join('|');
  const hit = cache.get(key);
  if (hit) return hit;

  const teeth = Math.max(8, Math.round(radius * 17));
  const step = (Math.PI * 2) / teeth;
  const root = radius - tooth;
  const shape = new THREE.Shape();
  const at = (r: number, a: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [at(root, a), at(root, a + step * 0.38), at(radius, a + step * 0.5), at(radius, a + step * 0.82), at(root, a + step * 0.94)];
    pts.forEach(([x, y], j) => (i === 0 && j === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  }
  shape.closePath();

  const axle = new THREE.Path();
  axle.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(axle);

  if (windows > 0) {
    const hub = hole + 0.12;
    const rim = root - 0.09;
    const mid = (hub + rim) / 2;
    const wr = Math.min((rim - hub) / 2, (Math.PI * mid) / windows - 0.05);
    if (wr > 0.04) {
      for (let i = 0; i < windows; i++) {
        const a = (i / windows) * Math.PI * 2 + 0.3;
        const p = new THREE.Path();
        p.absarc(Math.cos(a) * mid, Math.sin(a) * mid, wr, 0, Math.PI * 2, true);
        shape.holes.push(p);
      }
    }
  }

  const bevel = Math.min(0.035, height * 0.15);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height - bevel * 2, 0.01),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
}
