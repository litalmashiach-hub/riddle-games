import { Sparkles as DreiSparkles } from '@react-three/drei';
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

export function Sparkles(props: Omit<ComponentProps<typeof DreiSparkles>, 'ref'>) {
  const points = useRef<THREE.Points>(null);
  // No dependencies: drei makes new points, with a new material, when the count or the scale changes.
  useLayoutEffect(() => {
    const material = points.current?.material as THREE.ShaderMaterial | undefined;
    if (!material?.fragmentShader || material.userData.guarded) return;
    material.fragmentShader = guardSparkleShader(material.fragmentShader);
    material.userData.guarded = true;
    material.needsUpdate = true;
  });
  return <DreiSparkles {...props} ref={points} />;
}
