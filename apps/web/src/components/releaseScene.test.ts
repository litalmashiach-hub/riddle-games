import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { releaseScene } from './ReleaseOnLeave';

/** Counts the "dispose" events an object sends, the way three.js's renderer listens for them. */
const watch = (x: THREE.EventDispatcher<{ dispose: object }>) => {
  const seen = { n: 0 };
  x.addEventListener('dispose', () => seen.n++);
  return seen;
};

describe('releaseScene', () => {
  it('disposes, once each, the geometries, materials, textures and instance buffers of a closing scene', () => {
    const scene = new THREE.Scene();
    // Shared at module level in many levels: two meshes use the same geometry and material.
    const geo = new THREE.BoxGeometry();
    const map = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map });
    const glow = new THREE.Texture();
    const shader = new THREE.ShaderMaterial({ uniforms: { uGlow: { value: glow }, uTime: { value: 0 } } });
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(), shader, 4);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, [mat, shader]));
    scene.add(group, inst);
    const env = new THREE.Texture();
    scene.environment = env;

    const seen = [geo, map, mat, glow, shader, inst.geometry, inst, env].map(watch);
    releaseScene(scene);
    expect(seen.map((s) => s.n)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    // The scene itself is left whole: taking it down is React's job.
    expect(scene.children).toHaveLength(2);
  });
});
