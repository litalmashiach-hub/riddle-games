import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAP_TOP, GROUND, capPos } from './layout';
import { CELLS } from './rules';

/** Cap colours: a cricket is home when it sits on a toadstool of its own colour. */
const AMBER_CAP = '#ffc85e';
const BLUE_CAP = '#4fb8ff';
const PLAIN_CAP = '#f1e7d6';
export const capColour = (cell: number) => (cell === 0 || cell === 2 ? BLUE_CAP : cell === 6 || cell === 8 ? AMBER_CAP : PLAIN_CAP);

/** The mossy islet with its nine toadstools. The middle one holds a firefly jar: no cricket can ever land there. */
export function Patch({ party }: { party: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const jar = useRef<THREE.Mesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < CELLS; i++) {
      const [x, , z] = capPos(i);
      o.position.set(x, (GROUND + CAP_TOP - 0.16) / 2, z);
      o.rotation.set(0, i * 0.9, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      stems.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, CAP_TOP - 0.09, z);
      o.updateMatrix();
      caps.current!.setMatrixAt(i, o.matrix);
      caps.current!.setColorAt(i, c.set(capColour(i)));
    }
    stems.current!.instanceMatrix.needsUpdate = true;
    caps.current!.instanceMatrix.needsUpdate = true;
    if (caps.current!.instanceColor) caps.current!.instanceColor.needsUpdate = true;
  }, [o]);
  useFrame(({ clock }) => {
    const m = jar.current;
    if (!m) return;
    const k = party ? 4.5 + Math.sin(clock.elapsedTime * 12) * 1.5 : 2.6 + Math.sin(clock.elapsedTime * 2.5) * 0.5;
    (m.material as THREE.MeshStandardMaterial).emissiveIntensity = k;
  });
  const [mx, , mz] = capPos(4);
  const jarGlow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4ffb0', emissive: '#d8ff5a', emissiveIntensity: 2.6, roughness: 0.4 }), []);
  return (
    <group>
      {/* islet */}
      <mesh position-y={GROUND - 0.35} material={toon('#bfa878')} castShadow receiveShadow>
        <cylinderGeometry args={[3.5, 3.75, 0.7, 14]} />
      </mesh>
      <mesh position-y={GROUND + 0.005} rotation-y={0.2} material={toon('#5fbf7a')} receiveShadow>
        <cylinderGeometry args={[3.35, 3.42, 0.05, 14]} />
      </mesh>
      <instancedMesh ref={stems} args={[undefined, undefined, CELLS]} material={toon('#efe6d2')} castShadow>
        <cylinderGeometry args={[0.17, 0.26, CAP_TOP - 0.16 - GROUND, 8]} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, CELLS]} material={toon('#ffffff', { rough: 0.6 })} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.66, 0.18, 10]} />
      </instancedMesh>
      {/* firefly jar on the middle toadstool */}
      <group position={[mx, CAP_TOP, mz]}>
        <mesh ref={jar} position-y={0.2} material={jarGlow}>
          <cylinderGeometry args={[0.17, 0.19, 0.36, 10]} />
        </mesh>
        <mesh position-y={0.42} material={toon('#7a5a3a')}>
          <cylinderGeometry args={[0.13, 0.13, 0.07, 10]} />
        </mesh>
        {high && <pointLight position-y={0.4} color="#e6ff8a" intensity={5} distance={5} decay={1.6} />}
      </group>
      {/* a few reeds and pebbles around the rim */}
      {[[-2.9, -0.9], [2.85, -1.2], [-2.7, 1.3], [2.8, 1.1], [0.2, -2.9]].map(([x, z], i) => (
        <group key={i} position={[x, GROUND, z]}>
          <mesh position-y={0.45} rotation-z={(i - 2) * 0.07} material={toon('#6fb356')} castShadow>
            <coneGeometry args={[0.05, 0.9, 4]} />
          </mesh>
          <mesh position={[0.22, 0.08, 0.1]} rotation={[i, i * 2, 0]} material={toon(i % 2 ? '#7d8a92' : '#64727b')}>
            <dodecahedronGeometry args={[0.14, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
