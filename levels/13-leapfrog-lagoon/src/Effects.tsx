import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** A water splash: a crown of droplets plus spreading ripple rings. Fires when `at` changes (a timestamp). */
export function Splash({ at, position, big = false }: { at: number; position: [number, number, number]; big?: boolean }) {
  const drops = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const count = big ? 40 : 16;
  const parts = useMemo(() => Array.from({ length: count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3() })), [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const start = useRef(0);
  useEffect(() => {
    if (!at) return;
    start.current = at;
    parts.forEach((pt, i) => {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const s = (big ? 1.4 : 0.8) * (0.6 + Math.random() * 0.6);
      pt.p.set(position[0], 0.05, position[2]);
      pt.v.set(Math.cos(a) * s, (big ? 3.6 : 2.2) * (0.6 + Math.random() * 0.6), Math.sin(a) * s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  useFrame((_, dt) => {
    const t = (performance.now() - start.current) / 1000;
    const live = start.current > 0 && t >= 0 && t < 2.2;
    const m = drops.current;
    if (m) {
      parts.forEach((pt, i) => {
        if (live && t >= 0) {
          pt.v.y -= 9.8 * Math.min(dt, 0.05);
          pt.p.addScaledVector(pt.v, Math.min(dt, 0.05));
        }
        o.position.copy(pt.p);
        o.scale.setScalar(live && pt.p.y > -0.02 ? 0.05 + (big ? 0.03 : 0) : 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    rings.current.forEach((r, i) => {
      if (!r) return;
      const k = t - i * 0.22;
      const on = live && k > 0 && k < 1.6;
      r.visible = on;
      if (!on) return;
      const s = 0.2 + k * (big ? 1.5 : 0.9);
      r.scale.set(s, s, s);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k / 1.6);
    });
  });
  return (
    <group>
      <instancedMesh ref={drops} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#d8f6ff" emissive="#9fe8ff" emissiveIntensity={0.6} roughness={0.2} />
      </instancedMesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (rings.current[i] = m)} position={[position[0], 0.04, position[2]]} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial color="#e8fbff" transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const STAR = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.42 : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  g.center();
  return g;
})();

/** Cartoon impact: a flash plus yellow stars flying out. Fires when `at` changes. */
export function Bonk({ at, position }: { at: number; position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const stars = useRef<(THREE.Mesh | null)[]>([]);
  const dirs = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8 + 0.4, 0.3);
  }), []);
  useFrame(() => {
    const t = (performance.now() - at) / 1000;
    const on = at > 0 && t >= 0 && t < 0.9;
    if (group.current) group.current.visible = on;
    if (!on) return;
    if (flash.current) {
      const s = 0.2 + t * 2.2;
      flash.current.scale.setScalar(s);
      (flash.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - t * 2.5);
    }
    stars.current.forEach((m, i) => {
      if (!m) return;
      const d = dirs[i];
      const r = 0.15 + t * 1.3;
      m.position.set(d.x * r, d.y * r - t * t * 0.8, d.z * r);
      m.rotation.z = t * 8 + i;
      m.scale.setScalar(0.09 * Math.max(0, 1 - t / 0.9));
    });
  });
  return (
    <group ref={group} position={position} visible={false}>
      <mesh ref={flash}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshBasicMaterial color="#fff6c0" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {dirs.map((_, i) => (
        <mesh key={i} ref={(m) => void (stars.current[i] = m)} geometry={STAR}>
          <meshStandardMaterial color="#ffe066" emissive="#ffc400" emissiveIntensity={2.5} />
        </mesh>
      ))}
    </group>
  );
}
