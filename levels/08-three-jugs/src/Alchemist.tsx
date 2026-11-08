import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useRef } from 'react';
import * as THREE from 'three';

export type AlchemistMood = 'idle' | 'happy' | 'focus' | 'facepalm' | 'shrug' | 'dizzy';

/**
 * A little sky alchemist in a starry robe and pointy hat, holding a glowing wand.
 * Faces +z, stands on y = 0, about 1.2 units tall. `lookYaw` turns the head.
 */
export function Alchemist({ mood = 'idle', lookYaw = 0 }: { mood?: AlchemistMood; lookYaw?: number }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const wandArm = useRef<THREE.Group>(null);
  const freeArm = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const g = root.current;
    if (g) {
      if (mood === 'happy') {
        const b = Math.abs(Math.sin(t * 6));
        g.position.y = b * 0.3;
        g.scale.set(1 + (1 - b) * 0.07, 1 - (1 - b) * 0.09, 1 + (1 - b) * 0.07);
        g.rotation.y = Math.sin(t * 3) * 0.3;
      } else if (mood === 'dizzy') {
        g.position.y = 0;
        g.scale.set(1, 1, 1);
        g.rotation.z = Math.sin(t * 7) * 0.16;
        g.rotation.y = Math.sin(t * 3.5) * 0.25;
      } else if (mood === 'shrug') {
        const b = Math.abs(Math.sin(t * 7));
        g.position.y = b * 0.06;
        g.scale.set(1, 1, 1);
        g.rotation.y = 0;
      } else {
        const br = Math.sin(t * 2) * 0.02;
        g.position.y = 0;
        g.scale.set(1 + br * 0.5, 1 + br, 1 + br * 0.5);
        g.rotation.y = 0;
      }
      if (mood !== 'dizzy') g.rotation.z += (0 - g.rotation.z) * Math.min(1, dt * 8);
    }
    if (head.current) {
      let d = lookYaw - head.current.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      head.current.rotation.y += d * Math.min(1, dt * 5);
      const hz = mood === 'focus' ? Math.sin(t * 2) * 0.06 : mood === 'dizzy' ? Math.sin(t * 9) * 0.3 : mood === 'shrug' ? 0.25 : 0;
      const hx = mood === 'facepalm' ? 0.35 : 0;
      head.current.rotation.z += (hz - head.current.rotation.z) * Math.min(1, dt * 10);
      head.current.rotation.x += (hx - head.current.rotation.x) * Math.min(1, dt * 10);
    }
    if (wandArm.current) {
      const target =
        mood === 'happy' ? -2.6 + Math.sin(t * 12) * 0.35
        : mood === 'focus' ? -1.5 + Math.sin(t * 8) * 0.15
        : mood === 'shrug' ? -0.7
        : mood === 'dizzy' ? -0.9 + Math.sin(t * 6) * 0.6
        : -0.5 + Math.sin(t * 1.4) * 0.08;
      const tz = mood === 'shrug' ? 1.0 + Math.sin(t * 7) * 0.1 : mood === 'dizzy' ? 0.6 : 0;
      wandArm.current.rotation.x += (target - wandArm.current.rotation.x) * Math.min(1, dt * 8);
      wandArm.current.rotation.z += (tz - wandArm.current.rotation.z) * Math.min(1, dt * 8);
    }
    if (freeArm.current) {
      const target =
        mood === 'happy' ? -2.5 + Math.sin(t * 12 + 1) * 0.35
        : mood === 'facepalm' ? -2.55
        : mood === 'shrug' ? -0.7
        : mood === 'dizzy' ? -0.9 - Math.sin(t * 6) * 0.6
        : -0.15;
      const tz = mood === 'facepalm' ? 0.55 : mood === 'shrug' ? -1.0 - Math.sin(t * 7) * 0.1 : mood === 'dizzy' ? -0.6 : 0;
      freeArm.current.rotation.x += (target - freeArm.current.rotation.x) * Math.min(1, dt * 10);
      freeArm.current.rotation.z += (tz - freeArm.current.rotation.z) * Math.min(1, dt * 10);
    }
    if (tip.current) {
      const m = tip.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = (mood === 'idle' ? 2.5 : 4) + Math.sin(t * 6) * 0.8;
    }
  });

  const robe = toon('#5b4bdb');
  const robeDark = toon('#3f2fb0');
  const skin = toon('#f6cfa8');
  const gold = toon('#f2c14e', { metal: 0.5, rough: 0.4 });
  const beard = toon('#f4f1ff');
  const star = toon('#ffe27a', { emissive: '#ffd166', emissiveIntensity: 3 });

  return (
    <group ref={root}>
      {/* robe */}
      <mesh position-y={0.36} material={robe} castShadow>
        <coneGeometry args={[0.36, 0.78, 9]} />
      </mesh>
      <mesh position-y={0.04} material={robeDark} castShadow>
        <cylinderGeometry args={[0.37, 0.4, 0.08, 9]} />
      </mesh>
      <mesh position-y={0.08} material={gold}>
        <torusGeometry args={[0.36, 0.02, 4, 18]} />
      </mesh>
      {/* stars on the robe */}
      {[
        [0.12, 0.3, 0.27],
        [-0.15, 0.18, 0.3],
        [0.02, 0.5, 0.18],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} material={star}>
          <octahedronGeometry args={[0.035, 0]} />
        </mesh>
      ))}
      {/* arms */}
      <group ref={wandArm} position={[0.22, 0.6, 0]}>
        <mesh position-y={-0.14} material={robe} castShadow>
          <capsuleGeometry args={[0.06, 0.2, 4, 6]} />
        </mesh>
        <mesh position-y={-0.3} material={skin}>
          <icosahedronGeometry args={[0.055, 0]} />
        </mesh>
        <group position={[0, -0.32, 0.02]} rotation-x={Math.PI / 2}>
          <mesh position-y={0.18} material={toon('#6b3f2a')}>
            <cylinderGeometry args={[0.015, 0.02, 0.4, 5]} />
          </mesh>
          <mesh ref={tip} position-y={0.4}>
            <octahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial color="#c4f1ff" emissive="#7df9ff" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <group ref={freeArm} position={[-0.22, 0.6, 0]}>
        <mesh position-y={-0.14} material={robe} castShadow>
          <capsuleGeometry args={[0.06, 0.2, 4, 6]} />
        </mesh>
        <mesh position-y={-0.3} material={skin}>
          <icosahedronGeometry args={[0.055, 0]} />
        </mesh>
      </group>
      {/* head */}
      <group ref={head} position-y={0.86}>
        <mesh material={skin} castShadow>
          <icosahedronGeometry args={[0.2, 2]} />
        </mesh>
        <mesh position={[0, -0.1, 0.1]} rotation-x={Math.PI} material={beard} castShadow>
          <coneGeometry args={[0.15, 0.3, 7]} />
        </mesh>
        <mesh position={[0, -0.01, 0.19]} material={toon('#f0a98a')}>
          <sphereGeometry args={[0.04, 8, 8]} />
        </mesh>
        {[0.075, -0.075].map((x) => (
          <group key={x} position={[x, 0.05, 0.16]}>
            <mesh material={toon('#ffffff', { flat: false, rough: 0.3 })}>
              <sphereGeometry args={[0.04, 12, 12]} />
            </mesh>
            <mesh position-z={0.025} material={toon('#1d1b3a', { flat: false, rough: 0.2 })}>
              <sphereGeometry args={[0.024, 10, 10]} />
            </mesh>
          </group>
        ))}
        {/* pointy hat */}
        <mesh position-y={0.15} material={robeDark} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 14]} />
        </mesh>
        <mesh position={[0, 0.42, -0.03]} rotation-x={-0.18} material={robe} castShadow>
          <coneGeometry args={[0.2, 0.55, 9]} />
        </mesh>
        <mesh position-y={0.19} material={gold}>
          <cylinderGeometry args={[0.205, 0.205, 0.05, 12]} />
        </mesh>
        <mesh position={[0, 0.7, -0.08]} material={star}>
          <octahedronGeometry args={[0.06, 0]} />
        </mesh>
      </group>
    </group>
  );
}
