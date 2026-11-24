import { useFrame } from '@react-three/fiber';
import { seeded } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { ISLET_R, ISLET_XZ, SPANS, TOP } from './layout';
import { BRIDGES } from './rules';

/** What stands at the back of each islet, so the hint can name it. Same order as ISLAND_NAMES. */
const LANDMARKS: (() => ReactNode)[] = [
  // lantern
  () => (
    <group>
      <mesh position-y={0.5} material={toon('#4a3326')} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1, 6]} />
      </mesh>
      <mesh position-y={1.12} scale={[1, 1.25, 1]} material={toon('#ffe1a8', { emissive: '#ffb347', emissiveIntensity: 2.8, flat: false })}>
        <sphereGeometry args={[0.17, 12, 8]} />
      </mesh>
      <mesh position-y={1.36} material={toon('#4a3326')}>
        <coneGeometry args={[0.16, 0.12, 6]} />
      </mesh>
    </group>
  ),
  // mushroom
  () => (
    <group>
      <mesh position-y={0.25} material={toon('#efe6d2')} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.5, 7]} />
      </mesh>
      <mesh position-y={0.5} material={toon('#7ff3ff', { emissive: '#35d8ee', emissiveIntensity: 1.8 })} castShadow>
        <sphereGeometry args={[0.36, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  ),
  // willow
  () => (
    <group>
      <mesh position-y={0.45} rotation-z={0.1} material={toon('#5a4332')} castShadow>
        <cylinderGeometry args={[0.06, 0.11, 0.9, 6]} />
      </mesh>
      <mesh position-y={1.05} scale={[1.25, 0.8, 1.1]} material={toon('#5fbf7a')} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((k) => {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        return (
          <mesh key={k} position={[Math.cos(a) * 0.42, 0.78, Math.sin(a) * 0.36]} material={toon(k % 2 ? '#4aa868' : '#3d9460')}>
            <coneGeometry args={[0.13, 0.6, 5]} />
          </mesh>
        );
      })}
    </group>
  ),
  // boulder
  () => (
    <group>
      <mesh position={[0, 0.26, 0]} scale={[1.2, 0.9, 1]} rotation={[0.3, 0.8, 0]} material={toon('#7d8a92')} castShadow>
        <dodecahedronGeometry args={[0.34, 0]} />
      </mesh>
      <mesh position={[0.36, 0.12, 0.12]} rotation={[1, 0.3, 0]} material={toon('#64727b')} castShadow>
        <dodecahedronGeometry args={[0.17, 0]} />
      </mesh>
    </group>
  ),
  // stump
  () => (
    <group>
      <mesh position-y={0.2} material={toon('#6b4a33')} castShadow>
        <cylinderGeometry args={[0.26, 0.32, 0.4, 8]} />
      </mesh>
      <mesh position-y={0.405} material={toon('#d8b98a')}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 8]} />
      </mesh>
      <mesh position={[0.16, 0.5, 0.05]} rotation-z={-0.5} material={toon('#8be28f')}>
        <coneGeometry args={[0.05, 0.22, 4]} />
      </mesh>
    </group>
  ),
  // lotus
  () => (
    <group position-y={0.02}>
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2;
        return (
          <mesh key={k} position={[Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17]} rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]} material={toon('#ff9ed0', { emissive: '#ff6fb8', emissiveIntensity: 0.8 })}>
            <coneGeometry args={[0.12, 0.42, 4]} />
          </mesh>
        );
      })}
      <mesh position-y={0.22} material={toon('#fff2a8', { emissive: '#ffe066', emissiveIntensity: 2.6 })}>
        <icosahedronGeometry args={[0.09, 0]} />
      </mesh>
    </group>
  ),
  // reed
  () => (
    <group>
      {[-0.22, -0.07, 0.1, 0.24].map((x, k) => (
        <group key={k} position={[x, 0, (k % 2) * 0.12]} rotation-z={(k - 1.5) * 0.09}>
          <mesh position-y={0.5 + k * 0.05} material={toon('#6fb356')} castShadow>
            <coneGeometry args={[0.035, 1 + k * 0.1, 4]} />
          </mesh>
          {k % 2 === 0 && (
            <mesh position-y={0.95 + k * 0.08} material={toon('#7a4a2a')}>
              <capsuleGeometry args={[0.055, 0.2, 2, 6]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  ),
  // shell
  () => (
    <group rotation-y={-0.5}>
      <mesh position={[0, 0.26, 0]} scale={[1, 1, 0.7]} material={toon('#ffd9ec', { rough: 0.45 })} castShadow>
        <icosahedronGeometry args={[0.28, 1]} />
      </mesh>
      <mesh position={[0.2, 0.2, 0.04]} scale={[1, 1, 0.75]} material={toon('#ffb3d4', { rough: 0.45 })}>
        <icosahedronGeometry args={[0.18, 1]} />
      </mesh>
      <mesh position={[0.34, 0.13, 0.07]} material={toon('#f58fbe', { rough: 0.45 })}>
        <icosahedronGeometry args={[0.1, 0]} />
      </mesh>
    </group>
  ),
];

/** The eight mossy islets with their landmarks. */
export function Islets() {
  return (
    <group>
      {ISLET_XZ.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={TOP - 0.3} rotation-y={i * 0.7} material={toon('#bfa878')} castShadow receiveShadow>
            <cylinderGeometry args={[ISLET_R, ISLET_R + 0.12, 0.6, 9]} />
          </mesh>
          <mesh position-y={TOP + 0.005} rotation-y={i * 0.7 + 0.3} material={toon(i % 2 ? '#74d68c' : '#82e09a')} receiveShadow>
            <cylinderGeometry args={[ISLET_R - 0.1, ISLET_R - 0.04, 0.05, 9]} />
          </mesh>
          <group position={[0, TOP, -0.42]}>{LANDMARKS[i]()}</group>
        </group>
      ))}
    </group>
  );
}

/**
 * The reed bridges and the glow-berry over each one.
 * `used` says which bridges are crossed. `holdUntil[i]` delays bridge i's sinking (and half of it, the berry's pop)
 * until Bramble has walked over it. Everything is drawn in two instanced meshes.
 */
export function Bridges({ used, holdUntil, party }: { used: number; holdUntil: MutableRefObject<number[]>; party: boolean }) {
  const planks = useRef<THREE.InstancedMesh>(null);
  const berries = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(() => {
    const rnd = seeded(77);
    return SPANS.map((sp) => {
      const n = Math.max(3, Math.round(sp.length / 0.3));
      return Array.from({ length: n }, (_, k) => ({ f: (k + 0.5) / n, tilt: (rnd() - 0.5) * 1.6, lag: rnd() * 0.5, skew: (rnd() - 0.5) * 0.12 }));
    });
  }, []);
  const total = layout.reduce((a, b) => a + b.length, 0);
  const sink = useRef(BRIDGES.map(() => 0));
  const berry = useRef(BRIDGES.map(() => 1));
  const o = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, dt) => {
    const now = performance.now();
    const t = clock.elapsedTime;
    let n = 0;
    SPANS.forEach((sp, i) => {
      const isUsed = ((used >> i) & 1) === 1;
      const hold = holdUntil.current[i] ?? 0;
      sink.current[i] = THREE.MathUtils.damp(sink.current[i], isUsed && now >= hold ? 1 : 0, isUsed ? 4.5 : 9, dt);
      // The berry is picked halfway across, a little before the bridge goes under.
      berry.current[i] = THREE.MathUtils.damp(berry.current[i], isUsed && now >= hold - 330 ? 0 : 1, 14, dt);
      const s = sink.current[i];
      layout[i].forEach((p) => {
        const k = Math.min(1, Math.max(0, s * 1.5 - p.lag));
        o.position.set(sp.a[0] + (sp.b[0] - sp.a[0]) * p.f, TOP - 0.06 + Math.sin(p.f * Math.PI) * 0.07 - k * 0.75, sp.a[1] + (sp.b[1] - sp.a[1]) * p.f);
        o.rotation.set(k * p.tilt, sp.yaw + p.skew, k * p.tilt * 0.7);
        o.scale.setScalar(k > 0.98 ? 0.001 : 1);
        o.updateMatrix();
        planks.current?.setMatrixAt(n++, o.matrix);
      });
      const b = berry.current[i];
      const bounce = party ? Math.abs(Math.sin(t * 6 + i)) * 0.3 : 0;
      o.position.set(sp.mid[0], TOP + 0.62 + Math.sin(t * 2.2 + i * 1.3) * 0.06 + (1 - b) * 0.5 + bounce, sp.mid[1]);
      o.rotation.set(0, t * 1.5 + i, 0);
      o.scale.setScalar(Math.max(0.001, b));
      o.updateMatrix();
      berries.current?.setMatrixAt(i, o.matrix);
    });
    if (planks.current) planks.current.instanceMatrix.needsUpdate = true;
    if (berries.current) berries.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, total]} material={toon('#c9a26a')} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[0.62, 0.07, 0.24]} />
      </instancedMesh>
      <instancedMesh ref={berries} args={[undefined, undefined, BRIDGES.length]} material={toon('#ff5fae', { emissive: '#ff2f92', emissiveIntensity: 2.4 })} frustumCulled={false}>
        <icosahedronGeometry args={[0.17, 1]} />
      </instancedMesh>
    </group>
  );
}
