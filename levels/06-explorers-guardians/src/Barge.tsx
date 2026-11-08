import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

const LENGTH = 2.3;

/** Carved serpent head that decorates each end of the barge. */
function Prow({ dir }: { dir: 1 | -1 }) {
  const wood = toon('#5d3b2a');
  const gold = toon('#e3b04b', { metal: 0.6, rough: 0.35 });
  const eye = toon('#3ff5b8', { emissive: '#3ff5b8', emissiveIntensity: 3.5, flat: false });
  return (
    <group position={[dir * (LENGTH / 2 - 0.05), 0.2, 0]} rotation-y={dir > 0 ? 0 : Math.PI}>
      <mesh position={[0.08, 0.14, 0]} rotation-z={-0.5} material={wood} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.38, 6]} />
      </mesh>
      <mesh position={[0.2, 0.33, 0]} scale={[1.4, 0.9, 0.9]} material={wood} castShadow>
        <icosahedronGeometry args={[0.1, 0]} />
      </mesh>
      <mesh position={[0.32, 0.31, 0]} rotation-z={-Math.PI / 2} material={gold} castShadow>
        <coneGeometry args={[0.06, 0.12, 5]} />
      </mesh>
      {[0.06, -0.06].map((z) => (
        <mesh key={z} position={[0.24, 0.37, z]} material={eye}>
          <sphereGeometry args={[0.022, 8, 8]} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.43, 0]} rotation-z={0.6} material={gold}>
        <coneGeometry args={[0.035, 0.14, 4]} />
      </mesh>
    </group>
  );
}

/**
 * An old temple barge, long axis along x, origin at the waterline. It glides by itself
 * when someone is aboard, with a ring of glowing runes under it.
 */
export function Barge({ sailing, children }: { sailing: boolean; children?: ReactNode }) {
  const bob = useRef<THREE.Group>(null);
  const runes = useRef<THREE.Mesh>(null);
  const lantern = useRef<THREE.PointLight>(null);
  const glow = useRef(0);

  const hull = useMemo(() => {
    const pts = [
      new THREE.Vector2(0, -0.22),
      new THREE.Vector2(0.26, -0.2),
      new THREE.Vector2(0.43, -0.1),
      new THREE.Vector2(0.5, 0.05),
      new THREE.Vector2(0.52, 0.17),
    ];
    return new THREE.LatheGeometry(pts, 16);
  }, []);
  const sx = LENGTH / 1.04;

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    glow.current += ((sailing ? 1 : 0) - glow.current) * Math.min(1, dt * 4);
    const g = glow.current;
    if (bob.current) {
      bob.current.position.y = Math.sin(t * 1.4) * 0.025 + g * 0.04;
      bob.current.rotation.z = Math.sin(t * 1.0) * 0.02;
      bob.current.rotation.x = Math.sin(t * 1.2 + 1) * 0.02;
    }
    if (runes.current) {
      runes.current.rotation.z = t * 0.6;
      runes.current.scale.setScalar(0.85 + g * 0.25);
      (runes.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + g * 0.75;
    }
    if (lantern.current) lantern.current.intensity = 2.2 + g * 2.5 + Math.sin(t * 7) * 0.2;
  });

  const wood = toon('#7a4a2e');
  const plank = toon('#a8744a');
  const gold = toon('#e3b04b', { metal: 0.6, rough: 0.35 });
  const lamp = toon('#bfffe8', { emissive: '#3ff5b8', emissiveIntensity: 3.2, flat: false });

  return (
    <group>
      {/* rune circle on the water under the barge */}
      <mesh ref={runes} position-y={0.03} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.25, 1.4, 6, 1]} />
        <meshBasicMaterial color={new THREE.Color('#5ff6d8').multiplyScalar(2.2)} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={bob}>
        <group position-y={0.1}>
          <mesh geometry={hull} scale={[sx, 1, 1]} castShadow receiveShadow>
            <meshStandardMaterial color="#5a3324" roughness={0.75} side={THREE.DoubleSide} flatShading />
          </mesh>
          <mesh geometry={hull} scale={[sx * 0.93, 0.95, 0.9]} position-y={0.02} receiveShadow>
            <meshStandardMaterial color="#a8744a" roughness={0.9} side={THREE.BackSide} flatShading />
          </mesh>
          <mesh position-y={0.17} rotation-x={Math.PI / 2} scale={[sx, 1, 1]} material={gold} castShadow>
            <torusGeometry args={[0.52, 0.03, 5, 32]} />
          </mesh>
          {/* deck */}
          <mesh position={[0, -0.04, 0]} material={plank} receiveShadow>
            <boxGeometry args={[LENGTH * 0.78, 0.04, 0.62]} />
          </mesh>
          {/* jade band */}
          <mesh position-y={0.06} rotation-x={Math.PI / 2} scale={[sx * 1.01, 1.03, 1]} material={lamp}>
            <torusGeometry args={[0.49, 0.012, 3, 32]} />
          </mesh>
          <Prow dir={1} />
          <Prow dir={-1} />
          {/* lantern mast in the middle */}
          <group position={[0, 0, -0.36]}>
            <mesh position-y={0.4} material={wood} castShadow>
              <cylinderGeometry args={[0.025, 0.03, 0.8, 5]} />
            </mesh>
            <mesh position={[0, 0.78, 0.08]} rotation-x={Math.PI / 2} material={wood}>
              <cylinderGeometry args={[0.015, 0.015, 0.18, 4]} />
            </mesh>
            <mesh position={[0, 0.7, 0.16]} material={lamp}>
              <octahedronGeometry args={[0.07, 0]} />
            </mesh>
            <pointLight ref={lantern} position={[0, 0.7, 0.25]} color="#5ff6d8" intensity={2.2} distance={4} decay={1.8} />
          </group>
          {children}
        </group>
      </group>
    </group>
  );
}
