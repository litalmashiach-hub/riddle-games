import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GROUND, PLATE_TOP } from './layout';
import { MAX_FLIPS } from './rules';

const LIT = new THREE.Color('#ffe27a');
const OUT = new THREE.Color('#3b3658');
/** Where the string of lanterns hangs: one lantern per flip that is left. */
const bulbPos = (i: number): [number, number, number] => {
  const f = i / (MAX_FLIPS - 1);
  return [1.75 + f * 2.5, 2.25 - Math.sin(f * Math.PI) * 0.32, -0.7];
};

/** The islet kitchen: a stump table with a plate, a campfire with a pan, and a string of lanterns that counts the flips left. */
export function Kitchen({ flips, party }: { flips: number; party: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const flame = useRef<THREE.Mesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    for (let i = 0; i < MAX_FLIPS; i++) {
      o.position.set(...bulbPos(i));
      o.updateMatrix();
      bulbs.current!.setMatrixAt(i, o.matrix);
    }
    bulbs.current!.instanceMatrix.needsUpdate = true;
  }, [o]);
  // Lanterns go out from the right, one per flip.
  useLayoutEffect(() => {
    const m = bulbs.current!;
    for (let i = 0; i < MAX_FLIPS; i++) m.setColorAt(i, i < MAX_FLIPS - flips ? LIT : OUT);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [flips]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (flame.current) flame.current.scale.set(1 + Math.sin(t * 11) * 0.12, 1 + Math.sin(t * 9) * 0.2 + (party ? 0.4 : 0), 1 + Math.cos(t * 10) * 0.12);
  });
  const wood = toon('#6b4a33');
  return (
    <group>
      {/* islet */}
      <mesh position-y={GROUND - 0.35} material={toon('#bfa878')} castShadow receiveShadow>
        <cylinderGeometry args={[4.6, 4.9, 0.7, 16]} />
      </mesh>
      <mesh position-y={GROUND + 0.005} rotation-y={0.2} material={toon('#5fbf7a')} receiveShadow>
        <cylinderGeometry args={[4.45, 4.52, 0.05, 16]} />
      </mesh>
      {/* stump table and plate */}
      <mesh position-y={GROUND + (PLATE_TOP - 0.08 - GROUND) / 2} material={wood} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.4, PLATE_TOP - 0.08 - GROUND, 10]} />
      </mesh>
      <mesh position-y={PLATE_TOP - 0.04} material={toon('#f4f1ea', { rough: 0.4 })} receiveShadow>
        <cylinderGeometry args={[1.42, 1.25, 0.08, 20]} />
      </mesh>
      {/* a stool for the chef's honey pot */}
      <group position={[-3.35, GROUND, -0.9]}>
        <mesh position-y={0.2} material={wood} castShadow>
          <cylinderGeometry args={[0.3, 0.36, 0.4, 8]} />
        </mesh>
        <mesh position-y={0.58} material={toon('#ffb52e', { emissive: '#ff9a1f', emissiveIntensity: 0.8 })} castShadow>
          <cylinderGeometry args={[0.2, 0.24, 0.36, 9]} />
        </mesh>
        <mesh position-y={0.79} material={toon('#8a5a3c')}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 9]} />
        </mesh>
      </group>
      {/* campfire with the pan, behind the lanterns */}
      <group position={[3.1, GROUND, -1.5]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position-y={0.08} rotation={[Math.PI / 2, 0, (k / 3) * Math.PI]} material={wood} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.8, 5]} />
          </mesh>
        ))}
        <mesh ref={flame} position-y={0.3} material={toon('#ffb347', { emissive: '#ff7a1f', emissiveIntensity: 3 })}>
          <coneGeometry args={[0.2, 0.5, 5]} />
        </mesh>
        <mesh position-y={0.62} material={toon('#3a3f47', { metal: 0.5, rough: 0.5 })} castShadow>
          <cylinderGeometry args={[0.46, 0.4, 0.08, 12]} />
        </mesh>
        <mesh position={[0.72, 0.64, 0]} rotation-z={Math.PI / 2} material={toon('#3a3f47', { metal: 0.5, rough: 0.5 })}>
          <cylinderGeometry args={[0.035, 0.035, 0.6, 5]} />
        </mesh>
        {high && <pointLight position-y={0.6} color="#ffb060" intensity={6} distance={6} decay={1.6} />}
      </group>
      {/* the string of lanterns between two poles */}
      {[bulbPos(0), bulbPos(MAX_FLIPS - 1)].map((p, i) => (
        <mesh key={i} position={[p[0] + (i ? 0.18 : -0.18), GROUND + (p[1] + 0.15 - GROUND) / 2, p[2]]} material={wood} castShadow>
          <cylinderGeometry args={[0.04, 0.06, p[1] + 0.15 - GROUND, 5]} />
        </mesh>
      ))}
      <instancedMesh ref={bulbs} args={[undefined, undefined, MAX_FLIPS]} frustumCulled={false}>
        <icosahedronGeometry args={[0.095, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
