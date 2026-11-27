import { Sparkles as DreiSparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import type * as THREE from 'three';

/*
 * drei's Sparkles, made safe to hold still.
 *
 * drei's sparkle shader makes each dot brighter towards its middle with `0.05 / distanceToCenter`. A pixel
 * whose centre falls exactly on a dot's middle divides by zero: its alpha is infinite, and blending turns it
 * into NaN. The bloom of PostFX then smears that one pixel over the whole picture, and the frame comes out
 * empty: the player sees only the page's sky colour behind a see-through canvas.
 *
 * While the dots drift, such a frame is one flash. With Reduce Motion on, the scene's clock is held and the
 * dots stand still, so a dot that lands on a pixel centre blanks the scene for as long as nothing moves
 * (levels 1 to 3 and 22 were seen blank at rest in the play-through tests' software renderer). Every level
 * takes its sparkles from here, never from drei itself: Sparkles.test.ts checks that.
 *
 * The cure keeps the look: the distance is never below a thousandth of the dot, so the middle pixel is very
 * bright, as it was, but finite.
 */

const DIVIDE = '0.05 / distanceToCenter';

/** drei's sparkle fragment shader with its division by zero taken out. Unchanged if the line is not there. */
export function guardSparkleShader(fragmentShader: string): string {
  return fragmentShader.replace(DIVIDE, '0.05 / max(distanceToCenter, 0.001)');
}

/** Guards every sparkle material under `root` that is not guarded yet. Returns how many it guarded. */
export function guardSparklesWithin(root: THREE.Object3D | null): number {
  let fresh = 0;
  root?.traverse((object) => {
    const materials = (object as THREE.Points).material;
    for (const material of Array.isArray(materials) ? materials : materials ? [materials] : []) {
      const shader = material as THREE.ShaderMaterial;
      if (!shader.fragmentShader || shader.userData.guarded) continue;
      shader.fragmentShader = guardSparkleShader(shader.fragmentShader);
      shader.userData.guarded = true;
      shader.needsUpdate = true;
      fresh++;
    }
  });
  return fresh;
}

export function Sparkles(props: Omit<ComponentProps<typeof DreiSparkles>, 'ref'>) {
  /*
   * The guard looks for the sparkle material under a group of its own, never through drei's ref. drei
   * builds new points, with a new material, whenever the count or the scale changes (the HD/SD button
   * changes the count), but it hands out its points with useImperativeHandle and no dependencies, so its
   * ref keeps pointing at the first points. The group always holds the points of now.
   *
   * It looks twice: after every render of this component, when new points have just been made, and before
   * every frame is drawn, so that no material, however it came to be, reaches the graphics card unguarded.
   * A material is compiled at its first draw, which comes after the frame's useFrame callbacks.
   */
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    guardSparklesWithin(group.current);
  });
  useFrame(() => {
    guardSparklesWithin(group.current);
  });
  return (
    <group ref={group}>
      <DreiSparkles {...props} />
    </group>
  );
}
