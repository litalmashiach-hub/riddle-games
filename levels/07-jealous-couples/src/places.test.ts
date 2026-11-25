import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA, DOCK_X, seat, slot } from './places';
import { BIRDS, nameOf, type Bird, type Side } from './rules';

/**
 * The birds as a small iPhone held sideways shows them (667 by 375), through the level's own camera.
 * The play screen pulls the camera back a little on short screens (fitFor in PlayScreen.tsx: 1.08),
 * which is done here too. Only the places are looked at: each body's middle, and how wide a body is drawn.
 */
const W = 667;
const H = 375;
const camera = new THREE.PerspectiveCamera(CAMERA.fov, W / H, 0.1, 100);
{
  const target = new THREE.Vector3(...CAMERA.target);
  camera.position.copy(new THREE.Vector3(...CAMERA.position).sub(target).multiplyScalar(1.08).add(target));
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
/** The middle of a bird's body: 0.36 above its feet, enlarged 1.22 by the scene. */
const BODY_Y = 0.36 * 1.22;
/** Half the width of a lady's body as drawn (0.27 by 1.22); a gent is a little larger. */
const BODY_HALF = 0.27 * 1.22;
const onScreen = (b: Bird, s: Side) => {
  const [x, , z] = slot(b, s);
  const p = new THREE.Vector3(x, BODY_Y, z).project(camera);
  const edge = new THREE.Vector3(x + BODY_HALF, BODY_Y, z).project(camera);
  return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, half: (Math.abs(edge.x - p.x) / 2) * W };
};

describe('where the birds stand', () => {
  for (const side of ['L', 'R'] as Side[]) {
    it(`no bird hides behind another on island ${side}, with all six there`, () => {
      for (const a of BIRDS)
        for (const b of BIRDS) {
          if (a >= b) continue;
          const p = onScreen(a, side);
          const q = onScreen(b, side);
          // Two bodies drawn on one spot hide one of the two: their middles must lie at least a body's
          // width apart on the screen (a body is about 25 points wide here). As the birds stood before,
          // three pairs were nearer: Mrs Coral and Mr Teal at 0.6 of a width, Mr Teal and Mr Plum, and
          // Mrs Teal and Mrs Plum, at 0.7. The nearest pair now is 1.14 apart.
          const apart = Math.hypot(p.x - q.x, p.y - q.y);
          expect(apart, `${nameOf(a)} and ${nameOf(b)}, in points on a 667 by 375 screen`).toBeGreaterThan(p.half + q.half);
        }
    });

    it(`every bird on island ${side} is on the screen, clear of the corner buttons and of the basket`, () => {
      for (const b of BIRDS) {
        const p = onScreen(b, side);
        expect(p.x, nameOf(b)).toBeGreaterThan(90);
        expect(p.x, nameOf(b)).toBeLessThan(W - 90);
        expect(p.y, nameOf(b)).toBeGreaterThan(70);
        expect(p.y, nameOf(b)).toBeLessThan(H - 110);
        // On the island's flat top (a circle of radius 3 around x = 5.1), away from its rim.
        const [x, , z] = slot(b, side);
        expect(Math.hypot(Math.abs(x) - 5.1, z), nameOf(b)).toBeLessThan(2.6);
        // A body's width clear of the two seats in the basket.
        for (const i of [0, 1]) expect(Math.hypot(x - seat(side, i)[0], z - seat(side, i)[2]), nameOf(b)).toBeGreaterThan(2 * BODY_HALF);
      }
    });
  }

  it('the two islands mirror each other', () => {
    for (const b of BIRDS) {
      const l = slot(b, 'L');
      const r = slot(b, 'R');
      expect([-l[0], l[1], l[2]]).toEqual(r);
      expect(Math.abs(l[0])).toBeGreaterThan(DOCK_X + 1);
    }
  });
});
