import { useFrame } from '@react-three/fiber';
import { reducedMotion } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type Mood = 'idle' | 'happy' | 'puzzled' | 'curl' | 'dizzy';

const FUR = '#d9a06c';
const SPIKE = '#8a5c3e';
const FACE = '#f3dcc0';
const SPIKES: [number, number, number][] = [
  [0, 0.62, -0.05], [-0.2, 0.55, -0.02], [0.2, 0.55, -0.02], [0, 0.55, -0.3], [-0.22, 0.46, -0.26], [0.22, 0.46, -0.26],
  [0, 0.4, -0.46], [-0.3, 0.4, -0.08], [0.3, 0.4, -0.08],
];

/**
 * Bramble the hedgehog. Faces +z. The parent group moves him around; this handles breathing, a happy dance,
 * a head shake when a tap makes no sense (`nope` counts up), and the stranded gag: look around, curl up and spin, flop over dizzy.
 */
export function Hedgehog({ mood, nope }: { mood: Mood; nope: number }) {
  const body = useRef<THREE.Group>(null);
  const moodAt = useRef(0);
  const nopeAt = useRef(-1e9);
  useEffect(() => {
    moodAt.current = performance.now();
  }, [mood]);
  useEffect(() => {
    if (nope) nopeAt.current = performance.now();
  }, [nope]);

  useFrame(({ clock }) => {
    const b = body.current;
    if (!b) return;
    const t = clock.elapsedTime;
    const e = (performance.now() - moodAt.current) / 1000;
    const breathe = Math.sin(t * 2.4) * 0.03;
    let y = 0;
    let rx = 0;
    let ry = 0;
    let rz = 0;
    let sy = 1 + breathe;
    if (mood === 'happy') {
      const hop = Math.abs(Math.sin(t * 6));
      y = hop * 0.4;
      ry = t * 4;
      sy = 1 + hop * 0.1;
    } else if (mood === 'puzzled') {
      // With Reduce Motion on, he holds one glance to the side instead of looking back and forth.
      ry = reducedMotion() ? 0.6 : Math.sin(e * 6) * 1.1;
    } else if (mood === 'curl') {
      // Rolls up into a ball and spins on the spot (with Reduce Motion on, he curls up and keeps still).
      const calm = reducedMotion();
      y = 0.12 + (calm ? 0 : Math.abs(Math.sin(e * 9)) * 0.12);
      rx = calm ? 0 : e * 14;
      sy = 0.92;
    } else if (mood === 'dizzy') {
      // Flopped on his back, feet in the air, wobbling.
      const k = Math.min(1, e / 0.25);
      rx = -k * 1.35;
      y = k * 0.22;
      rz = Math.sin(t * 5) * 0.12;
    }
    const n = (performance.now() - nopeAt.current) / 1000;
    if (n < 0.45) ry += Math.sin(n * 28) * 0.5 * (1 - n / 0.45);
    b.position.y = y;
    b.rotation.set(rx, ry, rz);
    b.scale.set(1, sy, 1);
  });

  return (
    <group ref={body}>
      {/* pivot at the middle of the body, so the curl spins nicely */}
      <group position-y={-0.02}>
        <mesh position={[0, 0.3, -0.04]} scale={[0.34, 0.3, 0.42]} material={toon(FUR)} castShadow>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        <mesh position={[0, 0.36, -0.12]} scale={[0.37, 0.31, 0.4]} material={toon(SPIKE)} castShadow>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
        {SPIKES.map((p, i) => (
          <mesh key={i} position={p} rotation={[-0.5 - (p[2] < -0.2 ? 0.5 : 0), 0, -p[0] * 2]} material={toon(SPIKE)}>
            <coneGeometry args={[0.07, 0.22, 4]} />
          </mesh>
        ))}
        {/* face */}
        <mesh position={[0, 0.26, 0.3]} scale={[0.2, 0.18, 0.2]} material={toon(FACE, { flat: false })}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        <mesh position={[0, 0.25, 0.5]} material={toon('#2b1d16', { rough: 0.3, flat: false })}>
          <sphereGeometry args={[0.045, 8, 6]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.1, 0.34, 0.42]} material={toon('#1b1410', { rough: 0.2, flat: false })}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
            <mesh position={[s * 0.19, 0.44, 0.2]} material={toon(FUR)}>
              <sphereGeometry args={[0.07, 6, 5]} />
            </mesh>
            <mesh position={[s * 0.17, 0.04, 0.2]} material={toon(FACE)}>
              <sphereGeometry args={[0.07, 6, 5]} />
            </mesh>
            <mesh position={[s * 0.19, 0.04, -0.2]} material={toon(FACE)}>
              <sphereGeometry args={[0.07, 6, 5]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
