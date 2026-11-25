import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TAP_BACKDROP_DEPTH, TAP_PAD_DEPTH, TAP_PAD_RANK, tapBackdropRaycast, tapPadRaycast } from './tapPad';

/** A camera at z = 10 that looks down -z, and the thing a tap at screen point (x, y) picks: nearest hit first, as the game does. */
function scene() {
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  const root = new THREE.Scene();
  const things: THREE.Object3D[] = [];
  /** A thing at `at`: a drawn box of `drawn` size (if any), and an invisible padding ball round it. */
  const add = (name: string, at: [number, number, number], drawn: number | null, padding: number, pad: THREE.Mesh['raycast'] | null) => {
    const thing = new THREE.Group();
    thing.name = name;
    thing.position.set(...at);
    if (drawn) thing.add(new THREE.Mesh(new THREE.BoxGeometry(drawn, drawn, drawn), new THREE.MeshBasicMaterial()));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(padding, 12, 12), new THREE.MeshBasicMaterial());
    ball.visible = false;
    if (pad) ball.raycast = pad;
    thing.add(ball);
    root.add(thing);
    things.push(thing);
    return thing;
  };
  const tap = (x: number, y: number): string | null => {
    root.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const first = raycaster.intersectObjects(things, true)[0];
    return first ? (first.object.parent as THREE.Object3D).name : null;
  };
  return { add, tap, camera };
}

describe('tapPadRaycast', () => {
  it('shows the fault it mends: plain padding in front takes a tap on a drawn thing behind it', () => {
    const { add, tap } = scene();
    add('behind', [0, 0, -2], 1, 1.2, null);
    add('front', [0.9, 0, 2], 0.5, 1.5, null);
    // The centre of the screen shows only the thing behind; the front thing is drawn off to the right.
    expect(tap(0, 0)).toBe('front');
  });

  it('gives a tap on a drawn thing to that thing, whatever padding lies in front of it', () => {
    const { add, tap } = scene();
    add('behind', [0, 0, -2], 1, 1.2, tapPadRaycast());
    add('front', [0.9, 0, 2], 0.5, 1.5, tapPadRaycast());
    expect(tap(0, 0)).toBe('behind');
  });

  it('still gives the tap to the drawn thing in front where two drawn things overlap', () => {
    const { add, tap } = scene();
    add('behind', [0, 0, -2], 1, 1.2, tapPadRaycast());
    add('front', [0, 0, 2], 0.5, 1.5, tapPadRaycast());
    expect(tap(0, 0)).toBe('front');
  });

  it('keeps the padding: a tap just beside a lone thing still picks it', () => {
    const { add, tap } = scene();
    add('alone', [0, 0, 0], 1, 1.2, tapPadRaycast());
    expect(tap(0.25, 0)).toBe('alone'); // beside the box, inside the ball
    expect(tap(0.9, 0.9)).toBeNull(); // outside the ball
  });

  it('between two paddings, picks the one whose middle is closest to the finger on the screen', () => {
    const { add, tap } = scene();
    // The far one is further from the tap in the world, but closer to it on the screen.
    add('far', [-0.6, 0, -8], null, 3, tapPadRaycast());
    add('near', [0.5, 0, 4], null, 3, tapPadRaycast());
    expect(tap(-0.05, 0)).toBe('far');
    expect(tap(0.2, 0)).toBe('near');
  });

  it('measures to the middle line when `axis` is set', () => {
    const { add, tap } = scene();
    add('tall', [-0.5, 0, 0], null, 2, tapPadRaycast({ axis: 3 }));
    add('ball', [0.5, 0.9, 0], null, 2, tapPadRaycast());
    // High up between the two: nearer to the ball's centre than to the tall one's centre, but nearer still to the tall one's middle line.
    expect(tap(0, 0.25)).toBe('tall');
  });

  it('puts a higher rank behind every padding of a lower rank', () => {
    const { add, tap } = scene();
    add('boat', [0, 0, 0], null, 2, tapPadRaycast({ rank: 1 }));
    add('rider', [0.8, 0, 0], null, 1, tapPadRaycast());
    expect(tap(0.05, 0)).toBe('rider'); // inside both; the boat's middle is closer
    expect(tap(-0.3, 0)).toBe('boat'); // inside the boat's padding only
  });

  it('reports one hit per padding, behind everything drawn, and none when the ray misses', () => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    ball.raycast = tapPadRaycast({ rank: 2 });
    ball.updateMatrixWorld();
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
    const found = raycaster.intersectObject(ball);
    expect(found).toHaveLength(1);
    expect(found[0].distance).toBeGreaterThanOrEqual(TAP_PAD_DEPTH + 2 * TAP_PAD_RANK);
    expect(found[0].distance).toBeLessThan(TAP_PAD_DEPTH + 3 * TAP_PAD_RANK);
    expect(found[0].object).toBe(ball);
    raycaster.set(new THREE.Vector3(5, 0, 10), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(ball)).toHaveLength(0);
  });
});

describe('tapBackdropRaycast', () => {
  /** A wide drawn deck at z = 0 inside a backdrop group, and a rider on it: a small drawn box with a padding ball. */
  function boatAndRider(deck: 'backdrop' | 'plain') {
    const { add, tap } = scene();
    const boat = new THREE.Group();
    boat.name = 'boat';
    const hull = new THREE.Group();
    if (deck === 'backdrop') hull.raycast = tapBackdropRaycast();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.2), new THREE.MeshBasicMaterial());
    plank.name = 'plank';
    hull.add(plank);
    boat.add(hull);
    const rider = add('rider', [0, 0, 1], 0.4, 1, tapPadRaycast());
    (rider.parent as THREE.Object3D).add(boat);
    const pick = (x: number, y: number): string | null => {
      const root = rider.parent as THREE.Object3D;
      root.updateMatrixWorld(true);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 10);
      camera.updateMatrixWorld();
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const first = raycaster.intersectObjects([rider, boat], true)[0];
      if (!first) return null;
      let o: THREE.Object3D | null = first.object;
      while (o && o !== rider && o !== boat) o = o.parent;
      return o ? o.name : null;
    };
    return { tap, pick };
  }

  it('shows why it is needed: beside a rider, the drawn boat would take the tap from the rider\'s padding', () => {
    const { pick } = boatAndRider('plain');
    expect(pick(0, 0)).toBe('rider'); // on the drawn rider
    expect(pick(0.15, 0)).toBe('boat'); // beside the rider, inside the padding, over the drawn deck
  });

  it('lets a padding cover a backdrop: a tap beside the rider picks the rider, further away the boat', () => {
    const { pick } = boatAndRider('backdrop');
    expect(pick(0, 0)).toBe('rider');
    expect(pick(0.15, 0)).toBe('rider');
    expect(pick(0.6, 0)).toBe('boat');
    expect(pick(0, 0.9)).toBeNull();
  });

  it('reports each hit below the group once, behind every padding, nearest first', () => {
    const group = new THREE.Group();
    group.raycast = tapBackdropRaycast();
    const near = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const far = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    far.position.z = -3;
    const inner = new THREE.Group();
    inner.add(far);
    group.add(near, inner);
    group.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0.2, 0.1, 10), new THREE.Vector3(0, 0, -1));
    // Off the middle, so that the ray does not run along the edge between a face's two triangles.
    const found = raycaster.intersectObject(group, true);
    expect(found.map((h) => h.object)).toEqual([near, far]);
    expect(found[0].distance).toBeCloseTo(TAP_BACKDROP_DEPTH + 9.5);
    expect(found[1].distance).toBeCloseTo(TAP_BACKDROP_DEPTH + 12.5);
    expect(found[0].distance).toBeGreaterThan(TAP_PAD_DEPTH + 999 * TAP_PAD_RANK);
  });

  it('works on a mesh too', () => {
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial());
    pond.raycast = tapBackdropRaycast();
    pond.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0.2, 0.1, 10), new THREE.Vector3(0, 0, -1));
    const found = raycaster.intersectObject(pond, true);
    expect(found).toHaveLength(1);
    expect(found[0].distance).toBeCloseTo(TAP_BACKDROP_DEPTH + 10);
  });
});
