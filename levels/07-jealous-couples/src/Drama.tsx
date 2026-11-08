import { useFrame } from '@react-three/fiber';
import { sfx, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Comic effects for the "jealousy!" fail scene: a little storm cloud over the fuming gent,
 * music notes for the innocent whistler, a sweat drop, and a puff of ruffled feathers.
 */

const BOLT = (() => {
  const s = new THREE.Shape();
  [[0, 0], [0.12, 0], [0.04, -0.2], [0.14, -0.2], [-0.06, -0.52], [0.0, -0.27], [-0.1, -0.27]].forEach(([x, y], i) =>
    i ? s.lineTo(x, y) : s.moveTo(x, y),
  );
  return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
})();

/** A grumpy rain cloud with lightning, hovering over someone's head. */
export function StormCloud({ position }: { position: [number, number, number] }) {
  const root = useRef<THREE.Group>(null);
  const bolt = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const rain = useRef<THREE.InstancedMesh>(null);
  const high = useSettings((s) => s.quality) === 'high';
  const drops = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.3, o: i / 14 })), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const lastStrike = useRef(-1);
  const born = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (born.current === null) born.current = t;
    const age = t - born.current;
    const g = root.current;
    if (g) {
      const grow = Math.min(1, age * 3);
      const pop = grow < 1 ? grow * (1 + Math.sin(grow * Math.PI) * 0.4) : 1;
      g.scale.setScalar(pop);
      g.position.x = position[0] + Math.sin(t * 2.2) * 0.04;
      g.rotation.z = Math.sin(t * 3) * 0.05;
    }
    // Lightning every ~0.9 s, a quick double flicker.
    const phase = (age % 0.9) / 0.9;
    const on = age > 0.35 && (phase < 0.08 || (phase > 0.14 && phase < 0.2));
    const strike = Math.floor(age / 0.9);
    if (on && strike !== lastStrike.current && age > 0.35) {
      lastStrike.current = strike;
      sfx.denied();
    }
    if (bolt.current) bolt.current.visible = on;
    if (flash.current) flash.current.intensity = on ? 8 : 0;
    const m = rain.current;
    if (m) {
      drops.forEach((d, i) => {
        const p = (t * 1.8 + d.o) % 1;
        o.position.set(d.x, -0.15 - p * 0.55, d.z);
        o.scale.setScalar(1 - p * 0.5);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  });

  const cloud = toon('#5b5f73', { rough: 1 });
  const cloudDark = toon('#43465a', { rough: 1 });
  return (
    <group ref={root} position={position}>
      {[
        [0, 0.05, 0, 0.2, cloud],
        [0.2, 0, 0.02, 0.15, cloudDark],
        [-0.2, -0.01, 0, 0.16, cloud],
        [0.08, 0.15, -0.04, 0.14, cloud],
        [-0.1, 0.12, 0.03, 0.12, cloudDark],
      ].map(([x, y, z, r, mat], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} material={mat as THREE.Material}>
          <icosahedronGeometry args={[r as number, 1]} />
        </mesh>
      ))}
      {/* angry little cloud eyes */}
      {[0.07, -0.07].map((x) => (
        <mesh key={x} position={[x, 0.07, 0.19]} rotation-z={x > 0 ? 0.4 : -0.4} material={toon('#ffe066', { emissive: '#ffd23f', emissiveIntensity: 2 })}>
          <boxGeometry args={[0.06, 0.018, 0.01]} />
        </mesh>
      ))}
      <mesh ref={bolt} geometry={BOLT} position={[0.03, -0.08, 0.05]} visible={false}>
        <meshBasicMaterial color={new THREE.Color('#fff36b').multiplyScalar(4)} toneMapped={false} />
      </mesh>
      {high && <pointLight ref={flash} position={[0, -0.3, 0.3]} color="#fff6b0" distance={3} intensity={0} />}
      <instancedMesh ref={rain} args={[undefined, undefined, drops.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.012, 0.07, 2, 4]} />
        <meshStandardMaterial color="#8fd3ff" emissive="#4fb3ff" emissiveIntensity={0.6} />
      </instancedMesh>
    </group>
  );
}

/** Music notes drifting up from a whistling beak. */
export function MusicNotes({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((n, i) => {
      const p = (t * 0.55 + i / g.children.length) % 1;
      n.position.set(0.15 + p * 0.45 + Math.sin(p * 9 + i) * 0.06, p * 0.8, 0);
      n.rotation.z = Math.sin(t * 5 + i) * 0.3;
      n.scale.setScalar(Math.sin(Math.PI * p) * 1.1);
    });
  });
  const ink = toon('#6a4cff', { emissive: '#7b5cff', emissiveIntensity: 0.6 });
  return (
    <group ref={ref} position={position}>
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <mesh position={[0, 0, 0]} scale={[1.25, 1, 0.6]} rotation-z={0.4} material={ink}>
            <sphereGeometry args={[0.045, 10, 8]} />
          </mesh>
          <mesh position={[0.04, 0.09, 0]} material={ink}>
            <boxGeometry args={[0.012, 0.18, 0.012]} />
          </mesh>
          {i % 2 === 0 && (
            <mesh position={[0.075, 0.165, 0]} rotation-z={-0.5} material={ink}>
              <boxGeometry args={[0.07, 0.025, 0.012]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** A nervous sweat drop sliding down the side of a head, again and again. */
export function SweatDrop({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const p = (clock.elapsedTime * 0.8) % 1;
    m.position.set(position[0], position[1] - p * 0.18, position[2]);
    m.scale.set(1, 1 + p * 0.4, 1);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 10, 8]} />
      <meshStandardMaterial color="#9be3ff" emissive="#5cc8ff" emissiveIntensity={0.8} roughness={0.1} transparent opacity={0.9} />
    </mesh>
  );
}

/** A puff of ruffled feathers in the bird's color, flung out once when it appears. */
export function FeatherPuff({ color, position = [0, 0.5, 0], delayMs = 0 }: { color: string; position?: [number, number, number]; delayMs?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 16;
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const a = Math.random() * Math.PI * 2;
        const s = 1.2 + Math.random() * 1.4;
        return {
          v: new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 2, Math.sin(a) * s * 0.7),
          spin: (Math.random() - 0.5) * 12,
          phase: Math.random() * 6,
        };
      }),
    [],
  );
  const start = useRef<number | null>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    if (start.current === null) start.current = clock.elapsedTime + delayMs / 1000;
    const age = clock.elapsedTime - start.current;
    parts.forEach((p, i) => {
      if (age < 0) {
        o.scale.setScalar(0);
      } else {
        // Burst out, then float down like a feather: drag plus a side-to-side swing.
        const k = 1 - Math.exp(-age * 3);
        o.position.set(
          position[0] + (p.v.x / 3) * k + Math.sin(age * 4 + p.phase) * 0.08 * Math.min(1, age),
          position[1] + (p.v.y / 3) * k - age * 0.35,
          position[2] + (p.v.z / 3) * k,
        );
        o.rotation.set(Math.sin(age * 3 + p.phase) * 0.8, age * p.spin, Math.sin(age * 4 + p.phase));
        const k2 = Math.max(0, 1 - age / 2.6);
        o.scale.set(k2, k2 * 0.25, k2 * 2.2);
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[0.06, 0]} />
      <meshStandardMaterial color={color} flatShading roughness={0.8} />
    </instancedMesh>
  );
}
