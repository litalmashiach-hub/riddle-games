import * as THREE from 'three';

/**
 * Tap padding.
 *
 * A thing that can be tapped often carries an invisible shape wider than what is drawn, so that
 * a thumb landing just beside it still picks it. The game gives a tap to the nearest thing under
 * the finger, drawn or not. So where things stand behind each other, the padding of the one in
 * front lies over the drawn body of the one behind, and a tap on that body picks the wrong thing.
 *
 * `tapPadRaycast()` is a `raycast` for such an invisible mesh:
 *
 *   <mesh visible={false} raycast={pad}> ... </mesh>      with   const pad = tapPadRaycast();
 *
 * A padding with it reports itself as lying behind everything that is drawn, so a drawn thing
 * under the finger always gets the tap. Padding decides only where nothing tappable is drawn.
 * Between two paddings the tap goes to the one whose middle the finger is closest to, as seen
 * on the screen, and `rank` puts a padding behind every padding of a lower rank (a boat behind
 * the passengers that stand on it).
 *
 * `tapBackdropRaycast()` is for the one kind of drawn thing that paddings should still cover:
 * a big tappable thing that the others stand on, in or in front of (a boat, a bridge, a pond).
 * A thumb beside a passenger lands on the drawn boat, and should still pick the passenger:
 *
 *   <group raycast={boat}> <Boat /> </group>               with   const boat = tapBackdropRaycast();
 *
 * Everything inside that group reports itself as lying behind every padding. Among themselves
 * backdrop things keep their order, nearest first.
 *
 * So the order under a finger is: what is drawn (nearest first), then paddings (lowest rank,
 * then closest middle), then backdrops (nearest first).
 */

/** Further away than anything drawn in a scene. */
export const TAP_PAD_DEPTH = 100_000;
/** One step of `rank`. Larger than any offset between a finger and a padding's middle. */
export const TAP_PAD_RANK = 100;

export interface TapPadOptions {
  /**
   * Length of the padding's middle line, along the mesh's own y axis and centred on its origin:
   * the height of a standing figure, say. 0, the default, measures to the mesh's centre.
   */
  axis?: number;
  /** Paddings of a higher rank lie behind all paddings of a lower one. Default 0. */
  rank?: number;
}

const hits: THREE.Intersection[] = [];
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const onRay = new THREE.Vector3();
const onAxis = new THREE.Vector3();

/** How far the ray passes from the padding's middle, as an angle seen from the ray's origin (in radians, for small angles). */
function offset(mesh: THREE.Object3D, ray: THREE.Ray, axis: number): number {
  from.set(0, -axis / 2, 0).applyMatrix4(mesh.matrixWorld);
  to.set(0, axis / 2, 0).applyMatrix4(mesh.matrixWorld);
  const gap = Math.sqrt(ray.distanceSqToSegment(from, to, onRay, onAxis));
  const depth = onAxis.distanceTo(ray.origin);
  return depth > 1e-6 ? gap / depth : 0;
}

/** Further away than every padding. */
export const TAP_BACKDROP_DEPTH = 2 * TAP_PAD_DEPTH;

/** A `raycast` for an invisible padding mesh. Make it once, outside the component. */
export function tapPadRaycast({ axis = 0, rank = 0 }: TapPadOptions = {}): THREE.Mesh['raycast'] {
  return function (this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    hits.length = 0;
    THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
    if (hits.length === 0) return;
    let hit = hits[0];
    for (const h of hits) if (h.distance < hit.distance) hit = h;
    hit.distance = TAP_PAD_DEPTH + rank * TAP_PAD_RANK + offset(this, raycaster.ray, axis);
    intersects.push(hit);
  };
}

/**
 * A `raycast` for a group (or a mesh) that holds the drawn parts of a backdrop thing. Make it once,
 * outside the component. Everything below the group is asked as usual, then moved behind all paddings.
 */
export function tapBackdropRaycast(): THREE.Object3D['raycast'] {
  return function (this: THREE.Object3D, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const found: THREE.Intersection[] = [];
    // The object's own shape, by its class's raycast (this function replaces it on the object itself).
    (Object.getPrototypeOf(this) as THREE.Object3D).raycast.call(this, raycaster, found);
    for (const child of this.children) raycaster.intersectObject(child, true, found);
    for (const hit of found) {
      hit.distance += TAP_BACKDROP_DEPTH;
      intersects.push(hit);
    }
    // The children are done: three.js must not ask them again.
    return false;
  } as THREE.Object3D['raycast'];
}
