import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/** A glowing pulsing ring on the ground, to point at something (hints, selection). */
export function HintRing({ position, radius = 0.55, color = '#ffd166', visible = true }: { position: [number, number, number]; radius?: number; color?: string; visible?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const s = 1 + Math.sin(t * 5) * 0.08;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 5) * 0.25;
  });
  if (!visible) return null;
  return (
    <mesh ref={ref} position={position} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[radius * 0.78, radius, 48]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
