import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

/**
 * Hint's marks, read without drawing them: with React's hooks and the frame loop stood in for,
 * `HintRing` and `HintHalo` are plain functions that return their meshes.
 */
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: (v: unknown = null) => ({ current: v }),
  useMemo: (f: () => unknown) => f(),
}));
vi.mock('@react-three/fiber', () => ({ useFrame: () => {} }));

import { HintHalo } from './HintHalo';
import { edgedBandGeometry, HintRing } from './HintRing';
import { HINT_EDGE, HINT_GOLD, HINT_LABEL_STYLE, RING_OPACITY, haloBands, ringBands } from './hintMark';

interface El {
  type: unknown;
  props: Record<string, any>;
}
function walk(node: unknown, out: El[] = []) {
  if (Array.isArray(node)) for (const n of node) walk(n, out);
  else if (node && typeof node === 'object' && 'props' in node) {
    out.push(node as El);
    walk((node as El).props.children, out);
  }
  return out;
}
const meshesOf = (node: unknown) => walk(node).filter((el) => el.type === 'mesh');
const materialOf = (mesh: El) => walk(mesh.props.children).find((el) => el.type === 'meshBasicMaterial')!;

/** The radii the levels ask for, from a seated rider's ring to the ring round a tower. */
const RADII = [0.36, 0.4, 0.42, 0.45, 0.5, 0.55, 0.6, 0.66, 0.82, 0.95, 1.02, 1.3, 1.4, 1.45, 1.5];

/** How far from the middle each colour of a band's geometry reaches. */
function reach(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const col = geometry.getAttribute('color');
  const out = new Map<string, { from: number; to: number }>();
  for (let i = 0; i < pos.count; i++) {
    const hex = '#' + new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString();
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const seen = out.get(hex) ?? { from: Infinity, to: 0 };
    out.set(hex, { from: Math.min(seen.from, r), to: Math.max(seen.to, r) });
  }
  return out;
}

describe("the hint ring's band", () => {
  it('is never thinner than 0.15, and a small ring is at least as wide as it was', () => {
    for (const r of RADII) {
      const b = ringBands(r);
      // As it was: a band from 78% of the radius to the radius, 2 to 4 points wide round a figure on an iPhone.
      expect(b.outer - b.inner, `radius ${r}`).toBeGreaterThanOrEqual(0.15 - 1e-9);
      expect(b.outer - b.inner, `radius ${r}`).toBeGreaterThanOrEqual(r * 0.22 - 1e-9);
    }
  });

  it('covers no more of what it is drawn around than before', () => {
    for (const r of RADII) {
      const b = ringBands(r);
      expect(b.inner, `radius ${r}`).toBeCloseTo(r * 0.78, 9);
      // The dark edge inside is thin: under a tenth of the radius.
      expect(b.edge, `radius ${r}`).toBeLessThan(r * 0.1);
    }
  });

  it('a wide ring keeps its size', () => {
    for (const r of RADII.filter((x) => x >= 0.7)) expect(ringBands(r).outer, `radius ${r}`).toBeCloseTo(r, 9);
  });

  it('never fades away', () => {
    // As it was, the ring swung between 0.40 and 0.90, and at its low point it was nearly gone on a pale table.
    expect(RING_OPACITY.low).toBeGreaterThanOrEqual(0.8);
    expect(RING_OPACITY.high).toBeLessThanOrEqual(1);
  });

  it('has a dark edge on both sides of the colour, so it does not rest on colour alone', () => {
    for (const [name, bands, color] of [
      ['ring', ringBands(0.5), HINT_GOLD],
      ['ring in another colour', ringBands(0.82), '#7ee0b0'],
      ['halo', haloBands(0.46), HINT_GOLD],
    ] as const) {
      const seen = reach(edgedBandGeometry(bands.inner, bands.outer, bands.edge, color));
      const fill = seen.get(color)!;
      const edge = seen.get(HINT_EDGE)!;
      expect([...seen.keys()].sort(), name).toEqual([HINT_EDGE, color].sort());
      expect(fill.from, name).toBeCloseTo(bands.inner, 5);
      expect(fill.to, name).toBeCloseTo(bands.outer, 5);
      // Three decimals: the edge is drawn a hair wider at the corners of the 48 straight pieces a round band is made of.
      expect(edge.from, name).toBeCloseTo(bands.inner - bands.edge, 3);
      expect(edge.to, name).toBeCloseTo(bands.outer + bands.edge, 3);
    }
  });

  it('with four corners it is a square whose dark edge is as wide along its sides', () => {
    const seen = reach(edgedBandGeometry(0.43, 0.56, 0.035, HINT_GOLD, 4, Math.PI / 4));
    // Corners lie further out than the sides by 1 / cos(45 degrees).
    expect(seen.get(HINT_EDGE)!.to).toBeCloseTo(0.56 + 0.035 * Math.SQRT2, 5);
  });
});

describe('a hint mark in the scene', () => {
  const ray = () => new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));

  it('takes no taps: the ring, in any colour, and the halo', () => {
    const marks = [
      HintRing({ position: [0, 0, 0] }),
      HintRing({ position: [0, 0, 0], radius: 1.4, color: '#7ee0b0' }),
      HintHalo({ position: [0, 0, 0] }),
    ];
    for (const mark of marks) {
      const meshes = meshesOf(mark);
      expect(meshes.length).toBeGreaterThan(0);
      for (const el of meshes) {
        // The mesh as the scene builds it: a ray straight through its band hits it, unless its own raycast says no.
        const mesh = new THREE.Mesh(el.props.geometry as THREE.BufferGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        mesh.updateMatrixWorld();
        const r = ray();
        const pos = (el.props.geometry as THREE.BufferGeometry).getAttribute('position');
        r.ray.origin.set((pos.getX(0) + pos.getX(1)) / 2, (pos.getY(0) + pos.getY(1)) / 2, 5);
        const plain: THREE.Intersection[] = [];
        THREE.Mesh.prototype.raycast.call(mesh, r, plain);
        expect(plain.length, 'a mesh like it, with no rule of its own, is hit').toBeGreaterThan(0);
        const own: THREE.Intersection[] = [];
        expect(el.props.raycast, 'the mark has a raycast of its own').toBeTypeOf('function');
        (el.props.raycast as THREE.Mesh['raycast']).call(mesh, r, own);
        expect(own).toHaveLength(0);
      }
    }
  });

  it('the ring lies on the ground and is hidden by what stands in front; the halo is drawn over everything', () => {
    const ring = meshesOf(HintRing({ position: [0, 0, 0] }))[0];
    expect(ring.props['rotation-x']).toBeCloseTo(-Math.PI / 2);
    expect(materialOf(ring).props.depthTest).not.toBe(false);
    const halo = meshesOf(HintHalo({ position: [0, 0, 0] }))[0];
    expect(halo.props['rotation-x']).toBeUndefined();
    expect(materialOf(halo).props.depthTest).toBe(false);
    expect(halo.props.renderOrder).toBeGreaterThan(10);
    // Neither is faded by a world's haze, nor writes depth that would cut a hole in what is drawn later.
    for (const el of [ring, halo]) expect(materialOf(el).props).toMatchObject({ fog: false, depthWrite: false, transparent: true });
  });

  it('a hidden ring draws nothing', () => {
    expect(HintRing({ position: [0, 0, 0], visible: false })).toBeNull();
  });
});

describe("a hinted name label's band", () => {
  it('is gold between two dark edges, and takes up no room in the page', () => {
    expect(HINT_LABEL_STYLE.boxShadow).toMatch(new RegExp(`^0 0 0 [\\d.]+px ${HINT_EDGE}, 0 0 0 [\\d.]+px ${HINT_GOLD}, 0 0 0 [\\d.]+px ${HINT_EDGE}`));
    // A shadow and a transform change nothing in the layout, so labels that step aside for each other stay put.
    expect(Object.keys(HINT_LABEL_STYLE).sort()).toEqual(['animation', 'boxShadow']);
  });
});
