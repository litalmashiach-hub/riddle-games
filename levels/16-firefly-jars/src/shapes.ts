import * as THREE from 'three';
import type { Color } from './rules';

/**
 * Every firefly colour glows in a shape of its own, so the kinds can be told apart without telling colours
 * apart: a star, a heart, a diamond, a round bubble and a triangle (the names are SHAPES in rules.ts).
 * The shape is the firefly's whole body, with its face on it: in a jar a firefly has room for about 0.36
 * across and 0.3 up in its own measure, and the shape fills that. Each outline is drawn about the point
 * where the face sits.
 */
const OUTLINE: Record<Color, () => THREE.Shape> = {
  gold() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.092 : 0.19;
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.92 - 0.012;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  },
  pink() {
    const s = new THREE.Shape();
    const w = 0.185;
    s.moveTo(0, -0.16);
    s.bezierCurveTo(-w * 0.5, -0.09, -w, -0.01, -w, 0.065);
    s.bezierCurveTo(-w, 0.175, -0.03, 0.175, 0, 0.085);
    s.bezierCurveTo(0.03, 0.175, w, 0.175, w, 0.065);
    s.bezierCurveTo(w, -0.01, w * 0.5, -0.09, 0, -0.16);
    return s;
  },
  mint() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.165);
    s.lineTo(0.165, 0);
    s.lineTo(0, -0.165);
    s.lineTo(-0.165, 0);
    s.closePath();
    return s;
  },
  sky() {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.14, 0, Math.PI * 2, false);
    return s;
  },
  violet() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.2);
    s.lineTo(0.19, -0.12);
    s.lineTo(-0.19, -0.12);
    s.closePath();
    return s;
  },
};

const made = new Map<Color, THREE.BufferGeometry>();

/** The glowing body of a firefly of this colour: its outline with some depth, its back at z = -0.06. */
export function bodyGeometry(c: Color): THREE.BufferGeometry {
  let g = made.get(c);
  if (!g) {
    g = new THREE.ExtrudeGeometry(OUTLINE[c](), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.01, bevelSegments: 1, curveSegments: 10 });
    g.translate(0, 0, -0.04);
    made.set(c, g);
  }
  return g;
}

/** The top of each shape, where the feelers grow. */
export const TOP: Record<Color, number> = { gold: 0.15, pink: 0.12, mint: 0.15, sky: 0.13, violet: 0.17 };
