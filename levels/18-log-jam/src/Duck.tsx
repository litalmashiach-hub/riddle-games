import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useRef } from 'react';
import * as THREE from 'three';

export type DuckMood = 'idle' | 'grumpy' | 'huff' | 'happy' | 'flail' | 'soggy';

/**
 * Dottie, a plump white duck in a blue scarf. Faces local +z.
 * `grump` (0 to 1) is how impatient she is: she taps a foot, then goes red and puffs steam.
 */
export function Dottie({ mood, grump = 0, scale = 1 }: { mood: DuckMood; grump?: number; scale?: number }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const footL = useRef<THREE.Mesh>(null);
  const cheeks = useRef<THREE.Group>(null);
  const steam = useRef<THREE.Group>(null);
  const brows = useRef<THREE.Group>(null);

  const white = toon('#fffaf0', { rough: 0.75, emissive: '#fff1d6', emissiveIntensity: 0.18 });
  const shade = toon('#efe6d6', { rough: 0.8 });
  const orange = toon('#ff9a2e', { rough: 0.6 });
  const scarf = toon('#4f8dff', { rough: 0.7 });
  const eye = toon('#151515', { flat: false, rough: 0.2 });
  const shine = toon('#ffffff', { flat: false, emissive: '#ffffff', emissiveIntensity: 1 });
  const blush = toon('#ff6f91', { emissive: '#ff3d6e', emissiveIntensity: 0.6 });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const b = body.current;
    if (!b) return;
    let bob = Math.sin(t * 2) * 0.015;
    let tilt = 0;
    let flap = Math.sin(t * 1.5) * 0.05;
    let headX = Math.sin(t * 1.2) * 0.08;
    let headZ = 0;
    if (mood === 'happy') {
      bob = Math.abs(Math.sin(t * 7)) * 0.18;
      flap = 0.6 + Math.sin(t * 24) * 0.6;
      headX = -0.25;
    } else if (mood === 'huff') {
      headZ = Math.sin(t * 30) * 0.18;
      flap = 0.9 + Math.sin(t * 26) * 0.5;
      tilt = Math.sin(t * 15) * 0.08;
    } else if (mood === 'flail') {
      flap = 1.1 + Math.sin(t * 34) * 0.9;
      headX = -0.5;
    } else if (mood === 'soggy') {
      headX = 0.35;
      flap = 0.1;
      tilt = Math.sin(t * 1.6) * 0.15;
    } else if (grump > 0.4) {
      headX = 0.15;
      headZ = Math.sin(t * 3) * 0.06 * grump;
    }
    b.position.y = bob;
    b.rotation.z = tilt;
    if (wingL.current) wingL.current.rotation.z = -flap;
    if (wingR.current) wingR.current.rotation.z = flap;
    if (head.current) head.current.rotation.set(headX, 0, headZ);
    // A foot that taps faster the grumpier she gets.
    if (footL.current) footL.current.rotation.x = grump > 0.25 && mood === 'idle' ? -Math.abs(Math.sin(t * (5 + grump * 8))) * 0.6 : 0;
    const red = mood === 'huff' ? 1 : mood === 'idle' ? Math.max(0, (grump - 0.5) * 2) : 0;
    if (cheeks.current) cheeks.current.scale.setScalar(Math.max(0.001, red));
    if (brows.current) brows.current.visible = red > 0.2 || mood === 'huff';
    if (steam.current) {
      steam.current.visible = red > 0.6;
      steam.current.children.forEach((c, i) => {
        const k = (t * 1.2 + i / 3) % 1;
        c.position.set((i - 1) * 0.08, 0.2 + k * 0.4, 0);
        c.scale.setScalar(0.4 + k);
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
      });
    }
  });

  return (
    <group scale={scale}>
      <group ref={body}>
        {/* Body and tail. */}
        <mesh position-y={0.22} scale={[1, 0.82, 1.3]} material={white} castShadow>
          <icosahedronGeometry args={[0.22, 2]} />
        </mesh>
        <mesh position={[0, 0.33, -0.27]} rotation-x={-1} material={white} castShadow>
          <coneGeometry args={[0.08, 0.18, 5]} />
        </mesh>
        <group ref={wingL} position={[0.2, 0.27, -0.02]}>
          <mesh position-x={0.02} scale={[0.35, 0.75, 1.25]} material={shade}>
            <icosahedronGeometry args={[0.14, 1]} />
          </mesh>
        </group>
        <group ref={wingR} position={[-0.2, 0.27, -0.02]}>
          <mesh position-x={-0.02} scale={[0.35, 0.75, 1.25]} material={shade}>
            <icosahedronGeometry args={[0.14, 1]} />
          </mesh>
        </group>
        {/* Feet. */}
        <mesh ref={footL} position={[0.08, 0.03, 0.08]} scale={[1, 0.3, 1.4]} material={orange}>
          <sphereGeometry args={[0.06, 6, 4]} />
        </mesh>
        <mesh position={[-0.08, 0.03, 0.08]} scale={[1, 0.3, 1.4]} material={orange}>
          <sphereGeometry args={[0.06, 6, 4]} />
        </mesh>
        {/* Scarf. */}
        <mesh position={[0, 0.4, 0.13]} rotation-x={Math.PI / 2 - 0.3} material={scarf}>
          <torusGeometry args={[0.11, 0.04, 6, 14]} />
        </mesh>
        <mesh position={[0.08, 0.32, 0.22]} rotation={[0.3, 0, -0.3]} material={scarf}>
          <boxGeometry args={[0.07, 0.16, 0.03]} />
        </mesh>
        <group ref={head} position={[0, 0.52, 0.17]}>
          <mesh material={white} castShadow>
            <icosahedronGeometry args={[0.15, 2]} />
          </mesh>
          {/* Head tuft. */}
          <mesh position={[0, 0.15, -0.02]} rotation-x={-0.4} material={white}>
            <coneGeometry args={[0.03, 0.09, 4]} />
          </mesh>
          <mesh position={[0, -0.03, 0.15]} scale={[1.25, 0.42, 1.1]} material={orange}>
            <sphereGeometry args={[0.07, 10, 6]} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s} position={[s * 0.065, 0.035, 0.115]}>
              <mesh material={eye}>
                <sphereGeometry args={[0.03, 10, 8]} />
              </mesh>
              <mesh position={[s * -0.008, 0.012, 0.024]} material={shine}>
                <sphereGeometry args={[0.009, 6, 4]} />
              </mesh>
            </group>
          ))}
          <group ref={brows}>
            {[1, -1].map((s) => (
              <mesh key={s} position={[s * 0.065, 0.085, 0.12]} rotation-z={s * 0.45} material={eye}>
                <boxGeometry args={[0.06, 0.014, 0.01]} />
              </mesh>
            ))}
          </group>
          <group ref={cheeks}>
            {[1, -1].map((s) => (
              <mesh key={s} position={[s * 0.1, -0.03, 0.08]} scale={[1, 0.6, 0.4]} material={blush}>
                <sphereGeometry args={[0.035, 6, 4]} />
              </mesh>
            ))}
          </group>
          <group ref={steam}>
            {[0, 1, 2].map((i) => (
              <mesh key={i}>
                <sphereGeometry args={[0.05, 6, 4]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/** A fluffy yellow duckling. Faces local +z. */
export function Duckling({ mood, seed }: { mood: 'idle' | 'happy' | 'giggle'; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const yellow = toon('#ffe14d', { rough: 0.8 });
  const orange = toon('#ff9a2e');
  const eye = toon('#151515', { flat: false });
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.3;
    if (!g.current) return;
    if (mood === 'happy') {
      g.current.position.y = Math.abs(Math.sin(t * 8)) * 0.22;
      g.current.rotation.y = Math.sin(t * 4) * 0.4;
    } else if (mood === 'giggle') {
      g.current.position.y = Math.abs(Math.sin(t * 14)) * 0.05;
      g.current.rotation.z = Math.sin(t * 18) * 0.15;
    } else {
      g.current.position.y = Math.sin(t * 2.4) * 0.012;
      g.current.rotation.set(0, Math.sin(t * 0.7) * 0.3, 0);
    }
    if (head.current) head.current.rotation.x = mood === 'giggle' ? -0.3 + Math.sin(t * 20) * 0.2 : Math.sin(t * 1.9) * 0.1;
  });
  return (
    <group ref={g}>
      <mesh position-y={0.09} scale={[1, 0.85, 1.2]} material={yellow} castShadow>
        <icosahedronGeometry args={[0.1, 1]} />
      </mesh>
      <group ref={head} position={[0, 0.2, 0.06]}>
        <mesh material={yellow} castShadow>
          <icosahedronGeometry args={[0.075, 1]} />
        </mesh>
        <mesh position={[0, -0.01, 0.075]} scale={[1.2, 0.45, 1]} material={orange}>
          <sphereGeometry args={[0.035, 8, 5]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * 0.035, 0.02, 0.06]} material={eye}>
            <sphereGeometry args={[0.014, 6, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
