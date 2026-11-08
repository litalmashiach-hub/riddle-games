import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useRef } from 'react';
import * as THREE from 'three';

export type TockMood = 'idle' | 'watch' | 'no' | 'happy';

/**
 * Tock, the little wind-up keeper of the tower. Original character: a round brass robot
 * with glowing eyes, a wind-up key and an antenna bulb. Faces +z, stands on y = 0.
 */
export function Tock({ mood, lookX, scale = 1 }: { mood: TockMood; /** World x the head should turn toward. */ lookX: number | null; scale?: number }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const key = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const world = useRef(new THREE.Vector3());

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    g.position.y = 0;
    g.scale.set(1, 1, 1);
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6));
      g.position.y = b * 0.4;
      g.scale.set(1 + (1 - b) * 0.08, 1 - (1 - b) * 0.12, 1 + (1 - b) * 0.08);
    } else {
      const s = Math.sin(t * 2.4) * 0.02;
      g.scale.set(1 + s * 0.5, 1 + s, 1 + s * 0.5);
    }

    if (key.current) key.current.rotation.y += dt * (mood === 'happy' ? 12 : 1.6);

    const h = head.current;
    if (h) {
      let yaw = Math.sin(t * 0.6) * 0.25;
      if (mood === 'no') yaw = Math.sin(t * 22) * 0.45;
      else if (lookX != null) {
        g.getWorldPosition(world.current);
        yaw = Math.atan2(lookX - world.current.x, 3) - (g.parent?.rotation.y ?? 0);
        yaw = Math.max(-1, Math.min(1, yaw));
      }
      h.rotation.y += (yaw - h.rotation.y) * Math.min(1, dt * (mood === 'no' ? 30 : 6));
      h.rotation.z = mood === 'happy' ? Math.sin(t * 6) * 0.15 : 0;
    }

    const wave = mood === 'happy' ? -2.4 + Math.sin(t * 10) * 0.4 : mood === 'no' ? -0.6 : Math.sin(t * 1.5) * 0.08;
    if (armL.current) armL.current.rotation.z += (-wave - armL.current.rotation.z) * Math.min(1, dt * 8);
    if (armR.current) armR.current.rotation.z += (wave - armR.current.rotation.z) * Math.min(1, dt * 8);

    if (bulb.current) {
      const on = mood === 'no' ? Math.sin(t * 20) > 0 : true;
      bulb.current.emissiveIntensity = on ? 2.5 + Math.sin(t * 4) * 1 : 0.2;
      bulb.current.emissive.set(mood === 'no' ? '#ff3b4f' : mood === 'happy' ? '#7dffb0' : '#ffb347');
    }
  });

  const body = toon('#d6a548', { metal: 0.75, rough: 0.35 });
  const dark = toon('#4a3a40', { metal: 0.5, rough: 0.5 });
  const copper = toon('#c0703e', { metal: 0.8, rough: 0.4 });
  const eye = toon('#9ff6ff', { emissive: '#6fe9ff', emissiveIntensity: 3.5, flat: false });

  return (
    <group scale={scale}>
    <group ref={root}>
      {/* feet */}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.07, 0.04]} material={dark} castShadow>
          <boxGeometry args={[0.2, 0.14, 0.3]} />
        </mesh>
      ))}
      {/* barrel body */}
      <mesh position-y={0.48} material={body} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.6, 12]} />
      </mesh>
      <mesh position-y={0.48} rotation-x={Math.PI / 2} material={copper}>
        <torusGeometry args={[0.33, 0.035, 6, 16]} />
      </mesh>
      {/* chest dial */}
      <mesh position={[0, 0.5, 0.32]} rotation-x={Math.PI / 2} material={dark}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 12]} />
      </mesh>
      <mesh position={[0, 0.5, 0.345]} material={toon('#fff1c4', { emissive: '#ffcf6a', emissiveIntensity: 1.2, flat: false })}>
        <circleGeometry args={[0.085, 12]} />
      </mesh>
      {/* arms */}
      <group ref={armL} position={[-0.34, 0.66, 0]}>
        <mesh position-y={-0.18} material={dark} castShadow>
          <capsuleGeometry args={[0.05, 0.26, 3, 6]} />
        </mesh>
        <mesh position-y={-0.38} material={copper}>
          <sphereGeometry args={[0.08, 8, 6]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.34, 0.66, 0]}>
        <mesh position-y={-0.18} material={dark} castShadow>
          <capsuleGeometry args={[0.05, 0.26, 3, 6]} />
        </mesh>
        <mesh position-y={-0.38} material={copper}>
          <sphereGeometry args={[0.08, 8, 6]} />
        </mesh>
      </group>
      {/* wind-up key */}
      <group ref={key} position={[0, 0.55, -0.4]} rotation-x={Math.PI / 2}>
        <mesh material={copper}>
          <cylinderGeometry args={[0.03, 0.03, 0.18, 6]} />
        </mesh>
        <mesh position={[0, -0.17, 0]} scale={[1.6, 1, 1]} material={copper}>
          <torusGeometry args={[0.07, 0.03, 6, 10]} />
        </mesh>
      </group>
      {/* head */}
      <group ref={head} position-y={0.86}>
        <mesh position-y={0.18} material={body} castShadow>
          <icosahedronGeometry args={[0.27, 1]} />
        </mesh>
        <mesh position={[0, 0.17, 0.16]} material={dark}>
          <boxGeometry args={[0.36, 0.15, 0.12]} />
        </mesh>
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.17, 0.225]} material={eye}>
            <sphereGeometry args={[0.042, 10, 8]} />
          </mesh>
        ))}
        <mesh position-y={0.5} material={dark}>
          <cylinderGeometry args={[0.015, 0.015, 0.2, 5]} />
        </mesh>
        <mesh position-y={0.62}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial ref={bulb} color="#ffd38a" emissive="#ffb347" emissiveIntensity={2.5} />
        </mesh>
      </group>
    </group>
    </group>
  );
}
