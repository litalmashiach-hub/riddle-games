import * as THREE from 'three';

/**
 * Tap padding.
 *
 * Each person, and the raft, carries an invisible shape that is wider than the
 * drawn figure, so a thumb that lands just beside someone still picks them. The
 * player cannot see that shape, so it must never win against something they can
 * see: where a drawn figure is under the finger, that figure gets the tap, even
 * when the padding of someone standing in front of it is nearer to the camera.
 *
 * A tap goes to the nearest thing it hits. So the padding reports itself as
 * lying behind everything that is drawn. Between two paddings the tap goes to
 * the one whose middle line the finger is closest to, and a `rank` step puts
 * the raft behind every person.
 */

/** Further than anything drawn in the scene. */
export const PAD_DEPTH = 1000;
/** One step of `rank`. Larger than any distance between a tap and a padding's middle. */
export const PAD_RANK = 10;

const hits: THREE.Intersection[] = [];
const from = new THREE.Vector3();
const to = new THREE.Vector3();

/**
 * A `raycast` for an invisible padding mesh.
 * `axis` is the length of the mesh's middle line along its own y (a standing person); 0 measures to its centre.
 */
export function padRaycast({ axis = 0, rank = 0 }: { axis?: number; rank?: number } = {}): THREE.Mesh['raycast'] {
  return function (this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    hits.length = 0;
    THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
    if (hits.length === 0) return;
    const hit = hits.reduce((a, b) => (b.distance < a.distance ? b : a));
    from.set(0, -axis / 2, 0).applyMatrix4(this.matrixWorld);
    to.set(0, axis / 2, 0).applyMatrix4(this.matrixWorld);
    const off = Math.sqrt(raycaster.ray.distanceSqToSegment(from, to));
    hit.distance = PAD_DEPTH + rank * PAD_RANK + off;
    intersects.push(hit);
  };
}
