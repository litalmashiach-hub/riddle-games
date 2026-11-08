import { useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Written by the scene every frame. */
export interface Flame {
  /** 1 = fresh torch, 0 = no fuel left. The flame shrinks as it burns. */
  fuel: number;
  /** Set when the torch has gone out; the time (performance.now) it happened. */
  outAt: number | null;
}

const flameOuter = new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 3.2, transparent: true, opacity: 0.92, flatShading: true });
const flameInner = new THREE.MeshStandardMaterial({ color: '#fff1a8', emissive: '#ffd36a', emissiveIntensity: 4, flatShading: true });
const smokeMat = new THREE.MeshStandardMaterial({ color: '#6b6470', transparent: true, opacity: 0.6, roughness: 1, flatShading: true, depthWrite: false });

/** The explorers' only torch: a stick, an oily wrap, a flickering flame and a warm light. */
export const Torch = forwardRef<THREE.Group, { flame: Flame }>(function Torch({ flame }, ref) {
  const high = useSettings((s) => s.quality) === 'high';
  const fire = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.Group>(null);
  const puffs = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ x: Math.sin(i * 2.4) * 0.06, z: Math.cos(i * 2.4) * 0.06, d: i * 0.12, mat: smokeMat.clone() })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const out = flame.outAt != null;
    const size = out ? 0 : 0.55 + 0.45 * flame.fuel;
    const flick = 1 + Math.sin(t * 23) * 0.08 + Math.sin(t * 37 + 1) * 0.06;
    if (fire.current) {
      const cur = fire.current.scale.x;
      const next = cur + (size - cur) * (out ? 0.35 : 0.2);
      fire.current.scale.set(next, next * flick, next);
      fire.current.visible = next > 0.02;
    }
    if (outer.current) outer.current.rotation.y = t * 3;
    if (inner.current) inner.current.rotation.y = -t * 4;
    if (light.current) {
      const target = out ? 0 : (high ? 9 : 7) * (0.6 + 0.4 * flame.fuel) * (0.9 + Math.sin(t * 19) * 0.07 + Math.sin(t * 31) * 0.05);
      light.current.intensity += (target - light.current.intensity) * (out ? 0.3 : 0.5);
    }
    // A comic puff of smoke when the torch dies.
    const g = smoke.current;
    if (g) {
      const since = out ? (performance.now() - flame.outAt!) / 1000 : -1;
      g.visible = since >= 0 && since < 2.2;
      g.children.forEach((c, i) => {
        const k = Math.max(0, since - puffs[i].d);
        c.position.set(puffs[i].x * (1 + k * 3), 0.1 + k * 0.9, puffs[i].z * (1 + k * 3));
        c.scale.setScalar(k > 0 ? 0.06 + k * 0.16 : 0.001);
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.6 - k * 0.3);
      });
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, -0.2, 0]} material={toon('#7a4b28')} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.5, 6]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={toon('#3b2a1c', { rough: 1 })} castShadow>
        <cylinderGeometry args={[0.055, 0.04, 0.12, 7]} />
      </mesh>
      <group position={[0, 0.12, 0]}>
        <group ref={fire}>
          <mesh ref={outer} position={[0, 0.13, 0]} material={flameOuter}>
            <coneGeometry args={[0.085, 0.3, 6]} />
          </mesh>
          <mesh ref={inner} position={[0, 0.09, 0]} material={flameInner}>
            <coneGeometry args={[0.045, 0.18, 5]} />
          </mesh>
        </group>
        <pointLight ref={light} color="#ff9a45" intensity={8} distance={high ? 9 : 7} decay={1.6} position={[0, 0.2, 0]} />
        {high && <Sparkles count={14} scale={[0.3, 0.9, 0.3]} position={[0, 0.5, 0]} size={2.2} speed={1.4} color="#ffb35a" opacity={0.9} />}
        <group ref={smoke} visible={false}>
          {puffs.map((p, i) => (
            <mesh key={i} material={p.mat}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
});
