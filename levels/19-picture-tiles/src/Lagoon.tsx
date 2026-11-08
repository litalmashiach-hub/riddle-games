import { seeded, useSettings, Water } from '@riddle/fx';
import { toon } from '@riddle/props';
import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Height of the mossy island top. */
export const ISLAND_TOP = 0.12;
export const ISLAND_R = 3.7;
export const WATER_Y = -0.18;

/** The little island in Firefly Lagoon: moss, stones, glowing mushrooms, lanterns, reeds, lily pads. */
export function Lagoon({ party }: { party: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <Water width={44} length={44} position={[0, WATER_Y, 0]} shallow="#2aa7a0" deep="#0d2f52" foam="#c9f4ff" flow={0.08} waveHeight={0.035} segments={high ? 96 : 48} />

      {/* island: mossy top on a ring of stones */}
      <mesh position-y={ISLAND_TOP - 0.25} receiveShadow material={toon('#4f8f4c')}>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R + 0.15, 0.5, 18]} />
      </mesh>
      <mesh position-y={-0.42} receiveShadow material={toon('#6d6a7a')}>
        <cylinderGeometry args={[ISLAND_R + 0.3, ISLAND_R + 0.6, 0.5, 14]} />
      </mesh>
      <Pebbles />
      <MossTufts />

      <Mushrooms />
      <Lantern position={[-2.55, ISLAND_TOP, -2.1]} light={high} />
      <Lantern position={[2.55, ISLAND_TOP, -2.1]} light={high} />

      <LilyPads />
      <Reeds />
      <FarShore />

      <Sparkles count={high ? 70 : 28} scale={[14, 3.5, 11]} position={[0, 1.8, 0]} size={party ? 7 : 4.5} speed={party ? 1.6 : 0.35} color="#fff3a0" opacity={0.95} noise={1} />
    </group>
  );
}

function Pebbles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r = seeded(19);
    return Array.from({ length: 22 }, () => {
      const a = r() * Math.PI * 2;
      const d = ISLAND_R - 0.05 + r() * 0.3;
      return { p: [Math.cos(a) * d, ISLAND_TOP - 0.05, Math.sin(a) * d] as const, s: 0.18 + r() * 0.22, rot: r() * 3 };
    });
  }, []);
  useLayoutEffect(() => {
    {
      const m = ref.current;
      if (!m) return;
      const o = new THREE.Object3D();
      items.forEach((it, i) => {
        o.position.set(...it.p);
        o.rotation.set(it.rot, it.rot * 2, 0);
        o.scale.set(it.s * 1.3, it.s * 0.7, it.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow material={toon('#8a8798')}>
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

function MossTufts() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r = seeded(7);
    const out: [number, number, number, number][] = [];
    while (out.length < 26) {
      const a = r() * Math.PI * 2;
      const d = 2.3 + r() * 1.3;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
      out.push([x, ISLAND_TOP, z, 0.12 + r() * 0.14]);
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    {
      const m = ref.current;
      if (!m) return;
      const o = new THREE.Object3D();
      items.forEach(([x, y, z, s], i) => {
        o.position.set(x, y, z);
        o.scale.set(s * 1.4, s, s * 1.4);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow material={toon('#6bb35a')}>
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

const MUSHROOMS: [number, number, number, string][] = [
  [3.0, 0, 0.2, '#62f0ff'],
  [3.25, 0, -0.35, '#ff7ad9'],
  [2.85, 0, -0.75, '#62f0ff'],
  [-2.25, 0, -1.2, '#ff7ad9'],
  [-2.6, 0, -0.75, '#a98bff'],
  [1.6, 0, 3.0, '#62f0ff'],
  [1.25, 0, 3.25, '#ff7ad9'],
  [-0.9, 0, 3.3, '#a98bff'],
];

function Mushrooms() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((c, i) => {
      const s = 1 + Math.sin(clock.elapsedTime * 1.7 + i * 1.3) * 0.04;
      c.scale.setScalar(s * (0.75 + (i % 3) * 0.18));
    });
  });
  return (
    <group ref={group}>
      {MUSHROOMS.map(([x, , z, glow], i) => (
        <group key={i} position={[x, ISLAND_TOP, z]}>
          <mesh position-y={0.17} castShadow material={toon('#f2ead2')}>
            <cylinderGeometry args={[0.06, 0.09, 0.34, 7]} />
          </mesh>
          <mesh position-y={0.33} castShadow material={toon(glow, { emissive: glow, emissiveIntensity: 2.4 })}>
            <sphereGeometry args={[0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0.07, 0.48, 0.05]} material={toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.5 })}>
            <sphereGeometry args={[0.03, 5, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Lantern({ position, light }: { position: [number, number, number]; light: boolean }) {
  const lamp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.08;
  });
  return (
    <group position={position}>
      <mesh position-y={0.9} castShadow material={toon('#6b4a2e')}>
        <cylinderGeometry args={[0.06, 0.08, 1.8, 6]} />
      </mesh>
      <mesh position={[0, 1.78, 0.2]} rotation-x={Math.PI / 2} material={toon('#6b4a2e')}>
        <cylinderGeometry args={[0.04, 0.04, 0.45, 5]} />
      </mesh>
      <group ref={lamp} position={[0, 1.76, 0.42]}>
        <mesh position-y={-0.08} material={toon('#3a2a20')}>
          <cylinderGeometry args={[0.01, 0.01, 0.16, 4]} />
        </mesh>
        <mesh position-y={-0.32} scale={[1, 1.25, 1]} material={toon('#ffb347', { emissive: '#ff9a2e', emissiveIntensity: 3 })}>
          <icosahedronGeometry args={[0.18, 1]} />
        </mesh>
        <mesh position-y={-0.1} material={toon('#c0392b')}>
          <cylinderGeometry args={[0.1, 0.14, 0.06, 8]} />
        </mesh>
        <mesh position-y={-0.55} material={toon('#c0392b')}>
          <cylinderGeometry args={[0.13, 0.09, 0.05, 8]} />
        </mesh>
        {light && <pointLight position-y={-0.32} color="#ffb04d" intensity={5} distance={6} decay={1.6} />}
      </group>
    </group>
  );
}

const PADS: [number, number, number, boolean][] = [
  [-4.6, 0.6, 0.7, true],
  [-5.2, -1.8, 0.55, false],
  [4.7, -1.0, 0.65, true],
  [5.4, 1.2, 0.5, false],
  [-3.6, 3.9, 0.6, false],
  [4.2, 3.6, 0.45, true],
  [0.6, 4.9, 0.55, false],
  [-1.8, 5.0, 0.4, true],
  [-4.4, -3.9, 0.7, false],
  [3.2, -4.4, 0.6, false],
];

function LilyPads() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((c, i) => {
      c.position.y = WATER_Y + 0.05 + Math.sin(clock.elapsedTime * 1.1 + i) * 0.02;
      c.rotation.y = i + Math.sin(clock.elapsedTime * 0.3 + i) * 0.15;
    });
  });
  return (
    <group ref={group}>
      {PADS.map(([x, z, r, flower], i) => (
        <group key={i} position={[x, WATER_Y + 0.05, z]}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow material={toon(i % 2 ? '#4fbf55' : '#3fae5a', { flat: false })}>
            <circleGeometry args={[r, 20, 0.3, Math.PI * 2 - 0.6]} />
          </mesh>
          {flower && <Lotus />}
        </group>
      ))}
    </group>
  );
}

function Lotus() {
  return (
    <group position={[0.08, 0.02, 0.05]} scale={0.8}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.09, 0.08, Math.sin(a) * 0.09]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} scale={[0.07, 0.15, 0.07]} material={toon('#ff9fd0', { emissive: '#ff5fae', emissiveIntensity: 0.5 })}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        );
      })}
      <mesh position-y={0.1} material={toon('#ffe066', { emissive: '#ffcc33', emissiveIntensity: 2 })}>
        <sphereGeometry args={[0.05, 6, 4]} />
      </mesh>
    </group>
  );
}

function Reeds() {
  const stems = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r = seeded(3);
    const out: { x: number; z: number; h: number; ph: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI * 0.95 + r() * Math.PI * 0.95 * 1.0 - 0.05; // back half of the lagoon
      const d = 5.6 + r() * 2.2;
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 0.8 + r() * 0.6, ph: r() * 6 });
    }
    return out;
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const s = stems.current;
    const h = heads.current;
    if (!s || !h) return;
    const t = clock.elapsedTime;
    items.forEach((it, i) => {
      const sway = Math.sin(t * 0.9 + it.ph) * 0.06;
      o.position.set(it.x, WATER_Y + it.h / 2, it.z);
      o.rotation.set(0, 0, sway);
      o.scale.set(1, it.h, 1);
      o.updateMatrix();
      s.setMatrixAt(i, o.matrix);
      o.position.set(it.x - Math.sin(sway) * it.h, WATER_Y + it.h * Math.cos(sway) + 0.05, it.z);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      h.setMatrixAt(i, o.matrix);
    });
    s.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={stems} args={[undefined, undefined, items.length]} material={toon('#5c8f3a')}>
        <cylinderGeometry args={[0.025, 0.035, 1, 4]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, items.length]} castShadow material={toon('#7a4a2a')}>
        <capsuleGeometry args={[0.055, 0.22, 2, 6]} />
      </instancedMesh>
    </group>
  );
}

/** Soft dark willow mounds around the lagoon, for depth in the twilight fog. */
function FarShore() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r = seeded(11);
    return Array.from({ length: 16 }, (_, i) => {
      const a = -Math.PI + (i / 15) * Math.PI + (r() - 0.5) * 0.15;
      const d = 13 + r() * 5;
      return { x: Math.cos(a) * d * 1.3, z: Math.sin(a) * d, s: 2.2 + r() * 2.2 };
    });
  }, []);
  useLayoutEffect(() => {
    {
      const m = ref.current;
      if (!m) return;
      const o = new THREE.Object3D();
      items.forEach((it, i) => {
        o.position.set(it.x, it.s * 0.4 - 0.4, it.z);
        o.scale.set(it.s * 1.2, it.s, it.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} material={toon('#2c5a4e')}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  );
}
