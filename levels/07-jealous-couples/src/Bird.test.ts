import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

/**
 * The bird as the level builds it, read without drawing it: with React's hooks and the frame loop
 * stood in for, `Bird` is a plain function that returns its tree of meshes. That is enough to see
 * which mesh carries which `raycast`, and which marks a couple wears.
 */
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: (v: unknown = null) => ({ current: v }),
  useMemo: (f: () => unknown) => f(),
}));
vi.mock('@react-three/fiber', () => ({ useFrame: () => {} }));
vi.mock('@riddle/props', () => ({ toon: (color: string) => ({ color }) }));

import { Bird, COUPLE_MARKS } from './Bird';
import { BRIM_DEPTH } from './brim';
import { COUPLE_PATTERNS, COUPLES, type Couple, type Role } from './rules';

interface El {
  type: unknown;
  props: Record<string, any>;
}
/** Every element of the tree, with the elements it sits in. */
function walk(node: unknown, path: El[] = [], out: { el: El; path: El[] }[] = []) {
  if (Array.isArray(node)) for (const n of node) walk(n, path, out);
  else if (node && typeof node === 'object' && 'props' in node) {
    const el = node as El;
    out.push({ el, path });
    walk(el.props.children, [...path, el], out);
  }
  return out;
}
const tree = (couple: Couple, role: Role) => walk((Bird as (p: { couple: Couple; role: Role }) => unknown)({ couple, role }));
const geometryOf = (el: El) => walk(el.props.children).find((c) => typeof c.el.type === 'string' && c.el.type.endsWith('Geometry'))?.el;
/** The hat's brim: the wide, thin disc (see the top hat in Bird.tsx). */
const brimsOf = (couple: Couple, role: Role) =>
  tree(couple, role)
    .map((n) => n.el)
    .filter((el) => {
      if (el.type !== 'mesh') return false;
      const g = geometryOf(el);
      return g?.type === 'cylinderGeometry' && g.props.args[0] === 0.15 && g.props.args[2] === 0.02;
    });

describe("a gent's hat", () => {
  it('has one brim, and a tap on it counts as lying behind everything else that is drawn', () => {
    for (const couple of COUPLES) {
      const brims = brimsOf(couple, 'gent');
      expect(brims, 'the brim of the top hat').toHaveLength(1);
      const raycast = brims[0].props.raycast as THREE.Mesh['raycast'] | undefined;
      // Without this, the brim of a hat takes the tap from the bird that stands behind it (brim.ts).
      expect(raycast, "the brim's own raycast (brimRaycast in brim.ts)").toBeTypeOf('function');

      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 14), new THREE.MeshBasicMaterial());
      brim.updateMatrixWorld();
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
      const plain: THREE.Intersection[] = [];
      THREE.Mesh.prototype.raycast.call(brim, ray, plain);
      const soft: THREE.Intersection[] = [];
      raycast!.call(brim, ray, soft);
      expect(plain.length).toBeGreaterThan(0);
      expect(soft.map((h) => h.distance)).toEqual(plain.map((h) => h.distance + BRIM_DEPTH));
    }
  });

  it('is the only part of a bird with a picking rule of its own', () => {
    for (const couple of COUPLES)
      for (const role of ['gent', 'lady'] as Role[]) {
        const own = tree(couple, role).filter((n) => n.el.props.raycast);
        expect(own.map((n) => n.el)).toEqual(brimsOf(couple, role));
      }
    expect(brimsOf(0, 'lady')).toHaveLength(0);
  });
});

describe("a couple's pattern", () => {
  /** The meshes that wear the couple's mark colour. */
  const marks = (couple: Couple, role: Role) => tree(couple, role).filter((n) => n.el.type === 'mesh' && n.el.props.material?.color === COUPLE_MARKS[couple].color);

  it('is a different kind for each couple, named in the rules in the same order', () => {
    expect(COUPLES.map((c) => COUPLE_MARKS[c].kind)).toEqual(['spots', 'stripes', 'mask']);
    expect([...COUPLE_PATTERNS]).toEqual(['spotted', 'striped', 'pale-faced']);
  });

  it('is worn by husband and wife alike, and by no other couple', () => {
    const shape = (couple: Couple, role: Role) =>
      marks(couple, role)
        .map((n) => `${geometryOf(n.el)!.type}${JSON.stringify(geometryOf(n.el)!.props.args)}@${JSON.stringify(n.el.props.position ?? n.el.props['position-y'] ?? 0)}`)
        .sort();
    const seen = new Set<string>();
    for (const couple of COUPLES) {
      const gent = shape(couple, 'gent');
      expect(gent.length, `marks on couple ${couple}`).toBeGreaterThan(0);
      expect(shape(couple, 'lady')).toEqual(gent);
      seen.add(gent.join('|'));
    }
    expect(seen.size).toBe(COUPLES.length);
  });

  it('does not rest on colour: no mark is the colour of the body or the belly it lies on', () => {
    // Told apart by brightness alone (the grey picture): spots and stripes are far darker than the body, the mask far lighter.
    const grey = (hex: string) => {
      const c = new THREE.Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    const BODY = ['#ff7f6e', '#2ec4b6', '#9d74e0'];
    for (const couple of COUPLES) {
      const a = grey(COUPLE_MARKS[couple].color);
      const b = grey(BODY[couple]);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `mark against body, couple ${couple}`).toBeGreaterThan(3);
    }
  });
});
