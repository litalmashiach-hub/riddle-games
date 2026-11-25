import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { padRaycast } from './tapTargets';

/** A thin drawn figure with a wide invisible padding around it, like a person in the scene. */
function person(name: string, x: number, z: number) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8));
  body.position.y = 0.6;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.4, 8));
  pad.position.y = 0.6;
  pad.visible = false;
  pad.raycast = padRaycast({ axis: 1.4 });
  group.add(body, pad);
  return group;
}

function scene() {
  const root = new THREE.Group();
  // Dad stands in front of the guard and a little to the side, as on the quay.
  const front = person('front', 0.3, 1);
  const back = person('back', 0, 0);
  const raft = new THREE.Group();
  raft.name = 'raft';
  const raftPad = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4));
  raftPad.position.set(0, 0.3, 0.5);
  raftPad.visible = false;
  raftPad.raycast = padRaycast({ rank: 1 });
  raft.add(raftPad);
  root.add(front, back, raft);
  root.updateMatrixWorld(true);
  return root;
}

/** Who a tap along this ray goes to: the owner of the nearest hit, as react-three-fiber decides it. */
function tapped(root: THREE.Group, x: number, y = 0.6) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObjects(root.children, true)[0];
  return hit ? hit.object.parent!.name : null;
}

describe('tap padding', () => {
  it('gives the tap to the figure the player sees, not to the padding of someone in front', () => {
    // x = -0.05 is on the back figure's body, and inside the front figure's padding only.
    expect(tapped(scene(), -0.05)).toBe('back');
  });

  it('still gives the tap to the front figure where it is drawn', () => {
    expect(tapped(scene(), 0.25)).toBe('front');
  });

  it('gives a tap beside the figures to whoever it is closest to', () => {
    expect(tapped(scene(), 0.6)).toBe('front');
    expect(tapped(scene(), -0.3)).toBe('back');
  });

  it('picks a person before the raft padding around them', () => {
    expect(tapped(scene(), 0, 0.3)).toBe('back');
    expect(tapped(scene(), 0.6, 0.3)).toBe('front');
    expect(tapped(scene(), 1.5, 0.3)).toBe('raft');
  });

  it('is not hit at all where the padding is not under the finger', () => {
    expect(tapped(scene(), 3, 2)).toBeNull();
  });
});
