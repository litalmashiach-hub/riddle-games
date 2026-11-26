import { TAP_BACKDROP_DEPTH, TAP_PAD_DEPTH, tapBackdropRaycast, tapPadRaycast } from '@riddle/fx';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BRIM_DEPTH, brimRaycast } from './brim';

/**
 * Two gents as the level builds them, seen by a camera at z = 10 that looks down -z: a body
 * (1 wide, 1 high), on it a hat with a wide thin brim (1.2 wide) and a crown (0.5 wide, 0.8 high),
 * and an unseen padding ball. `front` stands nearer and lower, so that its hat lies over the body of
 * `back`. A tap picks the bird of the nearest hit, as the game does.
 */
function bunch(brims: 'soft' | 'plain') {
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  const root = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial();
  const bird = (name: string, at: [number, number, number]) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...at);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.6), mat);
    brim.position.y = 0.55;
    if (brims === 'soft') brim.raycast = brimRaycast();
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), mat);
    crown.position.y = 1;
    g.add(brim, crown);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), mat);
    pad.visible = false;
    pad.raycast = tapPadRaycast();
    g.add(pad);
    root.add(g);
    return g;
  };
  const back = bird('back', [0.4, 0.55, -2]);
  const front = bird('front', [0, 0, 2]);
  const balloon = new THREE.Group();
  balloon.name = 'balloon';
  balloon.raycast = tapBackdropRaycast();
  const envelope = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 0.2), mat);
  envelope.position.set(4, 2, -4);
  balloon.add(envelope);
  root.add(balloon);
  root.updateMatrixWorld(true);
  const things = [back, front, balloon];
  /** Who a tap picks, aimed at the point (x, y) of the front bird's own plane, z = 2. */
  const tap = (x: number, y: number): string | null => {
    const raycaster = new THREE.Raycaster();
    raycaster.set(camera.position, new THREE.Vector3(x, y, 2).sub(camera.position).normalize());
    const first = raycaster.intersectObjects(things, true).sort((a, b) => a.distance - b.distance)[0];
    if (!first) return null;
    let o: THREE.Object3D | null = first.object;
    while (o && !things.includes(o as THREE.Group)) o = o.parent;
    return o ? o.name : null;
  };
  return { tap, front, back };
}

describe('brimRaycast', () => {
  it('shows the fault it mends: a brim in front takes a tap on the body of the bird behind it', () => {
    const { tap } = bunch('plain');
    // The right end of the front bird's brim is drawn here, over the body of the back bird.
    expect(tap(0.5, 0.55)).toBe('front');
  });

  it('gives a tap on a brim to the bird whose body lies behind it', () => {
    const { tap } = bunch('soft');
    expect(tap(0.5, 0.55)).toBe('back');
    expect(tap(0.3, 0.57)).toBe('back');
  });

  it('gives a tap on a brim to its wearer where no body lies behind it', () => {
    const { tap, back } = bunch('soft');
    // The left end of the front bird's brim: only the back bird's padding lies behind it.
    expect(tap(-0.5, 0.55)).toBe('front');
    // The right end again, once the back bird has flown off.
    back.position.x = 30;
    back.updateMatrixWorld(true);
    expect(tap(0.5, 0.55)).toBe('front');
  });

  it('leaves the crown of a hat with its wearer, also over the body of the bird behind', () => {
    const { tap } = bunch('soft');
    expect(tap(0.15, 1.0)).toBe('front');
    expect(tap(0.2, 0.7)).toBe('front');
  });

  it('leaves a tap on a body with that bird, also where it stands in front of another', () => {
    const { tap } = bunch('soft');
    expect(tap(0, 0)).toBe('front');
    expect(tap(0.3, 0.45)).toBe('front'); // the top of the front body, over the foot of the back body
  });

  it('keeps a brim ahead of the balloon', () => {
    const { tap, front } = bunch('soft');
    front.position.set(4, 1.6, 2);
    front.updateMatrixWorld(true);
    expect(tap(4.5, 2.15)).toBe('front');
  });

  it('reports its hits between drawn things and paddings', () => {
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    brim.raycast = brimRaycast();
    brim.updateMatrixWorld(true);
    // Off the middle, so that the ray does not run along the edge between a face's two triangles.
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0.2, 0.1, 10), new THREE.Vector3(0, 0, -1));
    const found = raycaster.intersectObject(brim, true);
    expect(found.length).toBeGreaterThan(0);
    expect(Math.min(...found.map((h) => h.distance))).toBeCloseTo(BRIM_DEPTH + 9.5);
    for (const h of found) expect(h.distance).toBeLessThan(TAP_PAD_DEPTH);
    expect(TAP_PAD_DEPTH).toBeLessThan(TAP_BACKDROP_DEPTH);
    raycaster.set(new THREE.Vector3(5, 0, 10), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(brim, true)).toHaveLength(0);
  });
});
