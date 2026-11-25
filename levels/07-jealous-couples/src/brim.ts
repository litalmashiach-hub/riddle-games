import { TAP_PAD_DEPTH } from '@riddle/fx';
import * as THREE from 'three';

/**
 * Taps on the brim of a top hat.
 *
 * The birds stand in a tight bunch, and a gent's hat rises over the bird in the row behind. Of
 * Mrs Coral only a sliver shows beside Mr Teal's hat. The hat sways with his head, a few points to
 * each side, so its thin brim sweeps to and fro over that sliver: a finger put on her met the brim
 * in some taps, and the game then picked him.
 *
 * With this `raycast` on the brim, a tap on it goes to the bird behind wherever that bird's body
 * lies under the finger, and to the wearer everywhere else. The crown of the hat is left as it is:
 * a tap on it picks the wearer. So the brim, the part that sweeps over the neighbour, never takes
 * a tap from the bird it passes over, and where it is in its sway makes no difference to who is picked.
 *
 * The order under a finger is then: everything else that is drawn (nearest first), brims (nearest
 * first), and after those the tap paddings and the balloon, as tapPad.ts in @riddle/fx has them.
 */

/** Further away than anything drawn in the scene, nearer than every tap padding. */
export const BRIM_DEPTH = TAP_PAD_DEPTH / 2;

/** A `raycast` for a hat brim's mesh. Make it once, outside the component. */
export function brimRaycast(): THREE.Mesh['raycast'] {
  return function (this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const found: THREE.Intersection[] = [];
    THREE.Mesh.prototype.raycast.call(this, raycaster, found);
    for (const hit of found) {
      hit.distance += BRIM_DEPTH;
      intersects.push(hit);
    }
  };
}
