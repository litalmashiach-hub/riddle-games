import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HINT_MARK, edgedBandGeometry, noHit, useHintPulse } from './HintRing';
import { HINT_GOLD, haloBands } from './hintMark';

/** Drawn after everything else in the scene. */
const ON_TOP = 40;

/**
 * Hint's ring stood upright: it circles a figure, faces the camera and is drawn over everything in the
 * scene. For a figure in a crowd, where a ring on the ground at its feet is hidden behind the figures
 * that stand in front. Use it together with the `HintRing` on the ground.
 *
 * `position` is the middle of the figure. Like the ring it is gold with a dark edge, pulses gently and
 * takes no taps.
 */
export function HintHalo({ position, radius = 0.5, color = HINT_GOLD }: { position: [number, number, number]; radius?: number; color?: string }) {
  const turn = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useHintPulse(ring);
  const geometry = useMemo(() => {
    const b = haloBands(radius);
    return edgedBandGeometry(b.inner, b.outer, b.edge, color);
  }, [radius, color]);
  const parent = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ camera }) => {
    const g = turn.current;
    if (!g?.parent) return;
    // Face the camera, whichever way the thing it rides on is turned.
    g.parent.getWorldQuaternion(parent);
    g.quaternion.copy(parent.invert()).multiply(camera.quaternion);
  });
  return (
    <group ref={turn} position={position}>
      <mesh ref={ring} geometry={geometry} renderOrder={ON_TOP} raycast={noHit} name={HINT_MARK}>
        <meshBasicMaterial vertexColors transparent toneMapped={false} depthTest={false} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}
