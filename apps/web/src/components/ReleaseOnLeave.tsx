import { useThree } from '@react-three/fiber';
import { useLayoutEffect, type ReactNode } from 'react';
import type * as THREE from 'three';

/**
 * Lets go of everything a level drew with when the level closes.
 *
 * Each time three.js first draws a material, geometry or texture, it hangs a "dispose" listener on
 * that object, and the listener holds the whole renderer: its 3D context, its compiled programs, the
 * scene it drew. Many levels keep shared materials and geometries at module level, so they outlive
 * the level, and with them every renderer that ever drew them stayed in memory. Measured in Chromium,
 * each entry and exit of a level kept one more renderer (about 0.3 MB of page memory, plus its
 * shader programs and its context object). Disposing them here, while the scene is still whole,
 * makes three.js drop its listeners. A shared object is simply uploaded again by the next level that uses it.
 *
 * It must wrap the whole scene: its cleanup runs before the scene's own parts are taken down.
 */
export function ReleaseOnLeave({ children }: { children: ReactNode }) {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => () => releaseScene(scene), [scene]);
  return <>{children}</>;
}

const isTexture = (v: unknown): v is THREE.Texture => !!v && (v as THREE.Texture).isTexture === true;

/** Disposes every geometry, material and texture reachable from the scene. Exported for tests. */
export function releaseScene(scene: THREE.Scene) {
  const done = new Set<{ dispose(): void }>();
  const drop = (x: { dispose(): void } | null | undefined) => {
    if (!x || done.has(x)) return;
    done.add(x);
    x.dispose();
  };
  const dropMaterial = (m: THREE.Material) => {
    if (done.has(m)) return;
    for (const v of Object.values(m)) if (isTexture(v)) drop(v);
    const uniforms = (m as THREE.ShaderMaterial).uniforms;
    if (uniforms) for (const u of Object.values(uniforms)) if (isTexture(u?.value)) drop(u.value);
    drop(m);
  };
  scene.traverse((o) => {
    const obj = o as THREE.Mesh & Partial<Pick<THREE.InstancedMesh, 'isInstancedMesh' | 'dispose'>>;
    if (obj.geometry) drop(obj.geometry);
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach(dropMaterial);
    else if (mat) dropMaterial(mat);
    // Instanced meshes hold per-instance buffers of their own.
    if (obj.isInstancedMesh) drop(obj as THREE.InstancedMesh);
  });
  if (isTexture(scene.background)) drop(scene.background);
  if (isTexture(scene.environment)) drop(scene.environment);
}
