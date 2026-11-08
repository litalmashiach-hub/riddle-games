import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const COLORS = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ffffff', '#f78c6b'];

/**
 * Confetti burst. Increase `trigger` to fire it again.
 * Pass `colors` (e.g. whites for flying wool, greens for cabbage leaves) and a smaller `power`
 * to reuse it for fail scenes.
 */
export function Burst({
  trigger,
  position = [0, 2, 0],
  count = 220,
  colors = COLORS,
  power = 1,
  size = 1,
}: {
  trigger: number;
  position?: [number, number, number];
  count?: number;
  colors?: string[];
  power?: number;
  size?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        w: new THREE.Vector3(),
        life: 0,
      })),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!trigger || !mesh.current) return;
    parts.forEach((pt, i) => {
      pt.p.set(...position);
      const a = Math.random() * Math.PI * 2;
      const s = (3 + Math.random() * 5) * power;
      pt.v.set(Math.cos(a) * s * 0.6, (5 + Math.random() * 6) * power, Math.sin(a) * s * 0.6);
      pt.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      pt.life = 3 + Math.random() * 1.5;
      mesh.current!.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    });
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    parts.forEach((pt, i) => {
      if (pt.life > 0) {
        pt.life -= dt;
        pt.v.y -= 9 * dt;
        pt.v.multiplyScalar(1 - 1.6 * dt);
        pt.p.addScaledVector(pt.v, dt);
        pt.r.x += pt.w.x * dt;
        pt.r.y += pt.w.y * dt;
      }
      dummy.position.copy(pt.p);
      dummy.rotation.copy(pt.r);
      dummy.scale.setScalar(pt.life > 0 ? Math.min(1, pt.life) : 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.12 * size, 0.2 * size]} />
      <meshStandardMaterial side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.5} />
    </instancedMesh>
  );
}
