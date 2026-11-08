import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Traveller } from './rules';

export type FolkMood = 'idle' | 'happy' | 'scared';

/** Shared, mutable motion info written by the actor each frame (how fast it is moving). */
export interface MotionInfo {
  speed: number;
}

interface FolkProps {
  kind: Traveller;
  mood: FolkMood;
  motion: RefObject<MotionInfo>;
  seed: number;
}

/** Height of each character's head top, used to place speed badges and bubbles. */
export const FOLK_HEIGHT: Record<Traveller, number> = { zip: 0.95, mira: 0.95, bo: 1.0, elm: 0.95, tuk: 0.78 };

const PUPIL = () => toon('#141414', { flat: false, rough: 0.2 });
const WHITE = () => toon('#ffffff', { flat: false, rough: 0.3 });

function Eyes({ y, z, spread, r = 0.028, blinkRef }: { y: number; z: number; spread: number; r?: number; blinkRef?: RefObject<THREE.Group | null> }) {
  return (
    <group ref={blinkRef} position={[0, y, z]}>
      {[spread, -spread].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={WHITE()}>
            <sphereGeometry args={[r, 10, 10]} />
          </mesh>
          <mesh position={[0, 0, r * 0.62]} material={PUPIL()}>
            <sphereGeometry args={[r * 0.55, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * One of the five sky travellers. Each faces +z and stands on y = 0.
 * Breathes when idle, waddles while walking, bounces when happy and trembles when scared.
 */
export function Folk({ kind, mood, motion, seed }: FolkProps) {
  const root = useRef<THREE.Group>(null);
  const blink = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const extra = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + seed * 1.37;
    const walk = Math.min(1, (motion.current?.speed ?? 0) * 1.4);
    // Slow folk take slow steps.
    const stepRate = kind === 'tuk' ? 7 : kind === 'elm' ? 9 : 13;
    g.position.y = 0;
    g.rotation.set(0, 0, 0);
    g.scale.set(1, 1, 1);
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6));
      g.position.y = b * 0.32;
      g.scale.set(1 + (1 - b) * 0.08, 1 - (1 - b) * 0.1, 1 + (1 - b) * 0.08);
    } else if (mood === 'scared') {
      g.rotation.z = Math.sin(t * 42) * 0.07;
      g.position.y = Math.abs(Math.sin(t * 9)) * 0.08;
    } else if (walk > 0.05) {
      g.rotation.z = Math.sin(t * stepRate) * 0.14 * walk;
      g.position.y = Math.abs(Math.sin(t * stepRate)) * 0.07 * walk;
    } else {
      const br = Math.sin(t * 2.2) * 0.025;
      g.scale.set(1 + br * 0.5, 1 + br, 1 + br * 0.5);
      // Zip can't stand still: an impatient bounce on the toes.
      if (kind === 'zip') g.position.y = Math.max(0, Math.sin(t * 4.5)) ** 3 * 0.06;
    }
    if (kind === 'elm') g.rotation.x = 0.12;

    // Blink every few seconds.
    if (blink.current) {
      const ph = (t * 0.37) % 1;
      blink.current.scale.y = ph > 0.965 ? 0.15 : 1;
    }
    // Arms: swing while walking, wave when happy, up in the air when scared.
    const swing = walk > 0.05 ? Math.sin(t * stepRate) * 0.8 * walk : Math.sin(t * 1.6) * 0.06;
    if (armL.current) armL.current.rotation.x = mood === 'happy' ? -2.6 + Math.sin(t * 11) * 0.3 : mood === 'scared' ? -2.9 : swing;
    if (armR.current) armR.current.rotation.x = mood === 'happy' ? -2.6 + Math.sin(t * 11 + 1) * 0.3 : mood === 'scared' ? -2.9 : -swing;
    // Per-character flourishes.
    if (extra.current) {
      if (kind === 'zip') extra.current.rotation.x = -0.6 - Math.sin(t * 9) * 0.25 - walk * 0.5; // scarf flutters
      if (kind === 'bo') extra.current.rotation.z = Math.sin(t * 1.3) * 0.08; // plant sways
    }
    if (head.current) {
      if (kind === 'tuk') {
        // A frightened tortoise hides in its shell.
        const hide = mood === 'scared' ? 1 : 0;
        const s = THREE.MathUtils.lerp(head.current.scale.x, hide ? 0.15 : 1, Math.min(1, dt * 8));
        head.current.scale.setScalar(s);
        head.current.position.z = 0.22 + 0.18 * s;
        head.current.rotation.x = Math.sin(t * 1.1) * 0.12;
      } else {
        head.current.rotation.y = Math.sin(t * 0.7) * 0.22;
        head.current.rotation.z = Math.sin(t * 0.9) * 0.05;
      }
    }
  });

  const arms = (color: string, skin: string, y: number, x: number, len = 0.16) => (
    <>
      <group ref={armL} position={[x, y, 0]}>
        <mesh position={[0, -len * 0.6, 0]} material={toon(color)} castShadow>
          <capsuleGeometry args={[0.042, len, 3, 6]} />
        </mesh>
        <mesh position={[0, -len * 1.2, 0]} material={toon(skin)}>
          <icosahedronGeometry args={[0.045, 0]} />
        </mesh>
      </group>
      <group ref={armR} position={[-x, y, 0]}>
        <mesh position={[0, -len * 0.6, 0]} material={toon(color)} castShadow>
          <capsuleGeometry args={[0.042, len, 3, 6]} />
        </mesh>
        <mesh position={[0, -len * 1.2, 0]} material={toon(skin)}>
          <icosahedronGeometry args={[0.045, 0]} />
        </mesh>
      </group>
    </>
  );

  return <group ref={root}>{body()}</group>;

  function body() {
    switch (kind) {
      case 'zip': {
        // Tiny sky courier: aviator cap, glowing goggles, red scarf. 1 minute.
        const suit = '#20a99a';
        const skin = '#f6c9a0';
        return (
          <>
            {[0.07, -0.07].map((x) => (
              <mesh key={x} position={[x, 0.1, 0]} material={toon('#17675f')} castShadow>
                <capsuleGeometry args={[0.05, 0.1, 3, 6]} />
              </mesh>
            ))}
            <mesh position={[0, 0.33, 0]} material={toon(suit)} castShadow>
              <capsuleGeometry args={[0.15, 0.14, 4, 8]} />
            </mesh>
            {arms(suit, skin, 0.42, 0.18, 0.14)}
            <mesh position={[0, 0.49, 0]} rotation-x={Math.PI / 2} material={toon('#ef476f')} castShadow>
              <torusGeometry args={[0.11, 0.04, 6, 12]} />
            </mesh>
            <group ref={extra} position={[0.05, 0.5, -0.1]}>
              <mesh position={[0, 0, -0.12]} material={toon('#ef476f')} castShadow>
                <boxGeometry args={[0.07, 0.025, 0.24]} />
              </mesh>
            </group>
            <group ref={head} position={[0, 0.67, 0]}>
              <mesh material={toon(skin)} castShadow>
                <icosahedronGeometry args={[0.17, 2]} />
              </mesh>
              <mesh position={[0, 0.03, -0.01]} scale={[1.08, 1, 1.1]} material={toon('#8b5a2b')} castShadow>
                <sphereGeometry args={[0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
              </mesh>
              {[0.065, -0.065].map((x) => (
                <mesh key={x} position={[x, 0.11, 0.13]} rotation-x={Math.PI / 2 - 0.5} material={toon('#7df9ff', { emissive: '#5ee7ff', emissiveIntensity: 2.5, flat: false })}>
                  <cylinderGeometry args={[0.045, 0.045, 0.04, 10]} />
                </mesh>
              ))}
              <Eyes y={-0.005} z={0.145} spread={0.06} blinkRef={blink} />
              <mesh position={[0, -0.075, 0.15]} scale={[1.6, 0.6, 0.6]} material={toon('#a8553b')}>
                <sphereGeometry args={[0.025, 8, 6]} />
              </mesh>
            </group>
          </>
        );
      }
      case 'mira': {
        // Balloon courier with a beret and satchel. 3 minutes.
        const dress = '#ff7b6b';
        const skin = '#dfa07a';
        return (
          <>
            {[0.06, -0.06].map((x) => (
              <mesh key={x} position={[x, 0.07, 0]} material={toon('#5b3a2e')} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.14, 6]} />
              </mesh>
            ))}
            <mesh position={[0, 0.3, 0]} material={toon(dress)} castShadow>
              <cylinderGeometry args={[0.1, 0.22, 0.38, 9]} />
            </mesh>
            <mesh position={[0, 0.47, 0]} material={toon('#fff3e0')} castShadow>
              <icosahedronGeometry args={[0.1, 1]} />
            </mesh>
            {arms(dress, skin, 0.47, 0.13, 0.15)}
            <group ref={extra}>
              <mesh position={[-0.16, 0.24, 0.05]} rotation-y={0.3} material={toon('#9a5b2f')} castShadow>
                <boxGeometry args={[0.1, 0.12, 0.06]} />
              </mesh>
              <mesh position={[0, 0.38, 0]} rotation={[0, 0, 0.75]} scale={[1, 1.35, 0.9]} material={toon('#6e3f1f')}>
                <torusGeometry args={[0.17, 0.012, 4, 16]} />
              </mesh>
            </group>
            <group ref={head} position={[0, 0.66, 0]}>
              <mesh material={toon(skin)} castShadow>
                <icosahedronGeometry args={[0.16, 2]} />
              </mesh>
              <mesh position={[0, 0.03, -0.04]} scale={[1.05, 1, 1]} material={toon('#4a2a1d')} castShadow>
                <icosahedronGeometry args={[0.16, 1]} />
              </mesh>
              <mesh position={[0, 0.02, -0.2]} material={toon('#4a2a1d')} castShadow>
                <icosahedronGeometry args={[0.07, 1]} />
              </mesh>
              <mesh position={[0.04, 0.15, 0]} rotation={[0.1, 0, -0.25]} material={toon('#ffd166')} castShadow>
                <cylinderGeometry args={[0.15, 0.17, 0.05, 12]} />
              </mesh>
              <Eyes y={0.0} z={0.14} spread={0.058} blinkRef={blink} />
              {[0.1, -0.1].map((x) => (
                <mesh key={x} position={[x, -0.05, 0.11]} material={toon('#ff9a8b')}>
                  <sphereGeometry args={[0.025, 6, 6]} />
                </mesh>
              ))}
            </group>
          </>
        );
      }
      case 'bo': {
        // Round island gardener carrying a seedling. 6 minutes.
        const overalls = '#4f9e46';
        const skin = '#c98b64';
        return (
          <>
            {[0.09, -0.09].map((x) => (
              <mesh key={x} position={[x, 0.07, 0]} material={toon('#3b2a20')} castShadow>
                <cylinderGeometry args={[0.06, 0.05, 0.14, 6]} />
              </mesh>
            ))}
            <mesh position={[0, 0.33, 0]} scale={[1.05, 1, 0.95]} material={toon(overalls)} castShadow>
              <icosahedronGeometry args={[0.24, 1]} />
            </mesh>
            <mesh position={[0, 0.47, 0.06]} scale={[1, 0.6, 0.8]} material={toon('#f4d35e')} castShadow>
              <icosahedronGeometry args={[0.16, 1]} />
            </mesh>
            {arms('#f4d35e', skin, 0.46, 0.25, 0.15)}
            <group ref={extra} position={[0, 0.28, 0.26]}>
              <mesh material={toon('#c8643b')} castShadow>
                <cylinderGeometry args={[0.07, 0.05, 0.1, 8]} />
              </mesh>
              <mesh position={[0, 0.1, 0]} material={toon('#6fcf5a')} castShadow>
                <icosahedronGeometry args={[0.08, 0]} />
              </mesh>
              <mesh position={[0.02, 0.18, 0.02]} material={toon('#ff8fd8', { emissive: '#ff6fcf', emissiveIntensity: 1.5 })}>
                <icosahedronGeometry args={[0.03, 0]} />
              </mesh>
            </group>
            <group ref={head} position={[0, 0.7, 0]}>
              <mesh material={toon(skin)} castShadow>
                <icosahedronGeometry args={[0.17, 2]} />
              </mesh>
              {[0.04, -0.04].map((x) => (
                <mesh key={x} position={[x, -0.06, 0.155]} rotation-z={x > 0 ? -0.3 : 0.3} scale={[1.5, 0.6, 0.6]} material={toon('#3a2618')}>
                  <sphereGeometry args={[0.035, 8, 6]} />
                </mesh>
              ))}
              <mesh position={[0, 0.0, 0.17]} material={toon('#b8744f')}>
                <sphereGeometry args={[0.03, 8, 6]} />
              </mesh>
              <mesh position={[0, 0.11, 0]} material={toon('#e8c26a', { rough: 1 })} castShadow>
                <cylinderGeometry args={[0.32, 0.32, 0.025, 14]} />
              </mesh>
              <mesh position={[0, 0.18, 0]} material={toon('#e8c26a', { rough: 1 })} castShadow>
                <cylinderGeometry args={[0.13, 0.16, 0.13, 10]} />
              </mesh>
              <mesh position={[0, 0.14, 0]} material={toon('#3d8bd9')}>
                <cylinderGeometry args={[0.162, 0.162, 0.035, 10]} />
              </mesh>
              <Eyes y={0.04} z={0.14} spread={0.06} blinkRef={blink} />
            </group>
          </>
        );
      }
      case 'elm': {
        // Granny Elm, with round glasses and a cane. 8 minutes.
        const shawl = '#8e6bbf';
        const skin = '#f1c7a8';
        const hair = '#dcdce6';
        return (
          <>
            <mesh position={[0, 0.2, 0]} material={toon('#5c4b8a')} castShadow>
              <cylinderGeometry args={[0.13, 0.2, 0.4, 9]} />
            </mesh>
            <mesh position={[0, 0.44, 0]} scale={[1.1, 0.8, 1]} material={toon(shawl)} castShadow>
              <icosahedronGeometry args={[0.16, 1]} />
            </mesh>
            {arms(shawl, skin, 0.47, 0.16, 0.14)}
            <group ref={extra} position={[-0.2, 0, 0.08]}>
              <mesh position={[0, 0.27, 0]} material={toon('#7a4a2a')} castShadow>
                <cylinderGeometry args={[0.018, 0.018, 0.54, 5]} />
              </mesh>
              <mesh position={[0.04, 0.54, 0]} rotation-z={0} material={toon('#7a4a2a')}>
                <torusGeometry args={[0.04, 0.018, 4, 8, Math.PI]} />
              </mesh>
            </group>
            <group ref={head} position={[0, 0.64, 0.02]}>
              <mesh material={toon(skin)} castShadow>
                <icosahedronGeometry args={[0.15, 2]} />
              </mesh>
              <mesh position={[0, 0.04, -0.03]} scale={[1.08, 1, 1.05]} material={toon(hair)} castShadow>
                <sphereGeometry args={[0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.17, -0.05]} material={toon(hair)} castShadow>
                <icosahedronGeometry args={[0.075, 1]} />
              </mesh>
              <Eyes y={0.01} z={0.13} spread={0.055} r={0.022} blinkRef={blink} />
              {[0.055, -0.055].map((x) => (
                <mesh key={x} position={[x, 0.01, 0.15]} material={toon('#d4a64a', { metal: 0.8, rough: 0.3 })}>
                  <torusGeometry args={[0.038, 0.007, 4, 12]} />
                </mesh>
              ))}
              <mesh position={[0, -0.06, 0.14]} scale={[1.4, 0.5, 0.5]} material={toon('#c0707a')}>
                <sphereGeometry args={[0.025, 8, 6]} />
              </mesh>
            </group>
          </>
        );
      }
      case 'tuk': {
        // Tuk the explorer tortoise. 12 very slow minutes.
        const shell = '#3f8a52';
        const skin = '#9cc27a';
        return (
          <>
            {[[0.18, 0.15], [-0.18, 0.15], [0.18, -0.15], [-0.18, -0.15]].map(([x, z], i) => (
              <mesh key={i} position={[x, 0.07, z]} material={toon(skin)} castShadow>
                <cylinderGeometry args={[0.06, 0.07, 0.14, 6]} />
              </mesh>
            ))}
            <mesh position={[0, 0.19, 0]} material={toon('#d9c48a')} castShadow>
              <cylinderGeometry args={[0.34, 0.3, 0.07, 10]} />
            </mesh>
            <mesh position={[0, 0.27, 0]} scale={[1, 0.62, 1.12]} material={toon(shell)} castShadow>
              <icosahedronGeometry args={[0.33, 0]} />
            </mesh>
            <mesh position={[0, 0.46, -0.02]} scale={[1, 0.45, 1.1]} material={toon('#5fb36c')} castShadow>
              <icosahedronGeometry args={[0.14, 0]} />
            </mesh>
            <mesh position={[0, 0.2, -0.38]} rotation-x={-Math.PI / 2.4} material={toon(skin)}>
              <coneGeometry args={[0.04, 0.1, 5]} />
            </mesh>
            <group ref={head} position={[0, 0.3, 0.4]}>
              <mesh scale={[0.95, 0.9, 1.1]} material={toon(skin)} castShadow>
                <icosahedronGeometry args={[0.12, 1]} />
              </mesh>
              <Eyes y={0.04} z={0.09} spread={0.06} r={0.026} blinkRef={blink} />
              <mesh position={[0, 0.11, -0.01]} material={toon('#c9a66b')} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 0.018, 12]} />
              </mesh>
              <mesh position={[0, 0.16, -0.01]} material={toon('#c9a66b')} castShadow>
                <cylinderGeometry args={[0.07, 0.09, 0.09, 10]} />
              </mesh>
              <mesh position={[0, 0.135, -0.01]} material={toon('#8a5a32')}>
                <cylinderGeometry args={[0.092, 0.092, 0.025, 10]} />
              </mesh>
            </group>
          </>
        );
      }
    }
  }
}
