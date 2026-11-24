import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type ChefMood = 'idle' | 'happy' | 'worried' | 'dizzy';

const GREEN = '#6ccf74';
const DARK = '#3f9a55';
const BELLY = '#eaf7b0';

/**
 * Chef Pom the toad, with a tall hat and a spatula. Faces +z, turned a little toward the stack.
 * He swings the spatula on every flip (`swing` counts up), shakes his head at a tap that does nothing (`nope`),
 * dances on a win, and wobbles under his new pancake hat when the tower topples.
 */
export function Chef({ mood, swing, nope }: { mood: ChefMood; swing: number; nope: number }) {
  const body = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const throat = useRef<THREE.Mesh>(null);
  const swingAt = useRef(-1e9);
  const nopeAt = useRef(-1e9);
  useEffect(() => {
    if (swing) swingAt.current = performance.now();
  }, [swing]);
  useEffect(() => {
    if (nope) nopeAt.current = performance.now();
  }, [nope]);

  useFrame(({ clock }) => {
    const b = body.current;
    if (!b) return;
    const t = clock.elapsedTime;
    const now = performance.now();
    const breathe = Math.sin(t * 2.2) * 0.025;
    let y = 0;
    let ry = 0.45;
    let rz = 0;
    if (mood === 'happy') {
      y = Math.abs(Math.sin(t * 6)) * 0.35;
      ry = 0.45 + Math.sin(t * 6) * 0.5;
    } else if (mood === 'worried') {
      rz = Math.sin(t * 16) * 0.05;
    } else if (mood === 'dizzy') {
      rz = Math.sin(t * 4) * 0.14;
      ry = 0.2 + Math.sin(t * 2.3) * 0.25;
    }
    const s = (now - swingAt.current) / 1000;
    const sw = s < 0.6 ? Math.sin((s / 0.6) * Math.PI) : 0;
    y += sw * 0.18;
    const n = (now - nopeAt.current) / 1000;
    if (n < 0.45) ry += Math.sin(n * 28) * 0.4 * (1 - n / 0.45);
    b.position.y = y;
    b.rotation.set(0, ry, rz);
    b.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
    if (arm.current) arm.current.rotation.z = -0.5 - sw * 1.5 + (mood === 'happy' ? Math.sin(t * 12) * 0.4 : 0);
    if (throat.current) throat.current.scale.setScalar(1 + Math.max(0, Math.sin(t * 3)) * 0.12);
  });

  const skin = toon(GREEN);
  const white = toon('#ffffff', { rough: 0.6 });
  return (
    <group ref={body}>
      <mesh position-y={0.42} scale={[0.52, 0.44, 0.48]} material={skin} castShadow>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={throat} position={[0, 0.32, 0.3]} scale={[1, 0.9, 0.7]} material={toon(BELLY, { flat: false })}>
        <sphereGeometry args={[0.3, 10, 8]} />
      </mesh>
      {/* warts, eyes, a wide mouth */}
      <mesh position={[0, 0.6, 0.38]} scale={[1, 0.18, 0.4]} material={toon('#2d6b3f')}>
        <boxGeometry args={[0.46, 0.1, 0.1]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.24, 0.86, 0.2]} material={skin} castShadow>
            <sphereGeometry args={[0.15, 8, 6]} />
          </mesh>
          <mesh position={[s * 0.25, 0.89, 0.31]} material={toon('#fff7d6', { flat: false })}>
            <sphereGeometry args={[0.09, 8, 6]} />
          </mesh>
          <mesh position={[s * 0.25, 0.89, 0.385]} material={toon('#1b1410', { rough: 0.2, flat: false })}>
            <sphereGeometry args={[0.04, 6, 5]} />
          </mesh>
          <mesh position={[s * 0.36, 0.1, 0.24]} scale={[1, 0.5, 1.4]} material={toon(DARK)} castShadow>
            <sphereGeometry args={[0.16, 7, 5]} />
          </mesh>
          <mesh position={[s * 0.33, 0.62, -0.25]} material={toon(DARK)}>
            <icosahedronGeometry args={[0.07, 0]} />
          </mesh>
        </group>
      ))}
      {/* chef's hat */}
      <mesh position-y={1.08} material={white} castShadow>
        <cylinderGeometry args={[0.26, 0.24, 0.34, 10]} />
      </mesh>
      <mesh position-y={1.36} scale={[1, 0.62, 1]} material={white} castShadow>
        <icosahedronGeometry args={[0.36, 1]} />
      </mesh>
      {/* the arm with the spatula, toward the stack (+x) */}
      <group ref={arm} position={[0.42, 0.5, 0.12]} rotation-z={-0.5}>
        <mesh position={[0.16, 0, 0]} rotation-z={Math.PI / 2} material={skin}>
          <capsuleGeometry args={[0.07, 0.24, 2, 6]} />
        </mesh>
        <mesh position={[0.56, 0, 0]} rotation-z={Math.PI / 2} material={toon('#7a5a3a')}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 5]} />
        </mesh>
        <mesh position={[0.98, 0, 0]} material={toon('#cfd6dc', { metal: 0.6, rough: 0.35 })} castShadow>
          <boxGeometry args={[0.36, 0.03, 0.3]} />
        </mesh>
      </group>
    </group>
  );
}
