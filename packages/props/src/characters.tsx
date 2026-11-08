import { useFrame } from '@react-three/fiber';
import { forwardRef, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { toon } from './materials';

export type Mood = 'idle' | 'happy' | 'scared' | 'angry' | 'riding';

/** Every character faces +z and stands on y = 0. Wrap it in a group to place it. */
export interface CharacterProps {
  mood?: Mood;
  /** Different per character so idle animations are not in sync. */
  seed?: number;
  scale?: number;
  children?: ReactNode;
}

const Eye = ({ x, y, z, r = 0.03, glow }: { x: number; y: number; z: number; r?: number; glow?: string }) => (
  <group position={[x, y, z]}>
    {glow ? (
      <mesh material={toon(glow, { emissive: glow, emissiveIntensity: 4, flat: false })}>
        <sphereGeometry args={[r, 12, 12]} />
      </mesh>
    ) : (
      <>
        <mesh material={toon('#ffffff', { flat: false, rough: 0.3 })}>
          <sphereGeometry args={[r, 12, 12]} />
        </mesh>
        <mesh position={[0, 0, r * 0.6]} material={toon('#141414', { flat: false, rough: 0.2 })}>
          <sphereGeometry args={[r * 0.55, 10, 10]} />
        </mesh>
      </>
    )}
  </group>
);

/** Idle breathing, happy bouncing and scared trembling, shared by all animals. */
function useMoodMotion(root: React.RefObject<THREE.Group | null>, mood: Mood, seed: number) {
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + seed * 1.7;
    g.position.y = 0;
    g.rotation.z = 0;
    g.scale.set(1, 1, 1);
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6));
      g.position.y = b * 0.35;
      g.scale.set(1 + (1 - b) * 0.08, 1 - (1 - b) * 0.1, 1 + (1 - b) * 0.08);
    } else if (mood === 'scared') {
      g.rotation.z = Math.sin(t * 40) * 0.06;
      g.position.y = Math.abs(Math.sin(t * 9)) * 0.12;
    } else if (mood === 'angry') {
      g.scale.y = 1 + Math.sin(t * 12) * 0.04;
    } else {
      const breathe = Math.sin(t * 2.2) * 0.025;
      g.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    }
  });
}

export const Sheep = forwardRef<THREE.Group, CharacterProps>(function Sheep({ mood = 'idle', seed = 0, scale = 1, children }, ref) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  useMoodMotion(root, mood, seed);
  useFrame(({ clock }) => {
    if (!head.current) return;
    const t = clock.elapsedTime + seed * 3.1;
    // Occasional grazing nod when idle.
    const graze = mood === 'idle' ? Math.max(0, Math.sin(t * 0.7)) ** 6 : 0;
    head.current.rotation.x = graze * 0.6 + (mood === 'scared' ? -0.3 : 0);
    head.current.rotation.y = Math.sin(t * 0.9) * 0.15;
  });
  const wool = toon('#f6f1e6', { rough: 1 });
  const dark = toon('#3b2f2b');
  const puffs: [number, number, number, number][] = [
    [0, 0.62, 0, 0.2], [0.17, 0.56, 0.12, 0.17], [-0.17, 0.56, 0.12, 0.17], [0.17, 0.56, -0.14, 0.17],
    [-0.17, 0.56, -0.14, 0.17], [0, 0.55, -0.24, 0.16], [0, 0.56, 0.2, 0.15], [0.22, 0.42, 0, 0.15], [-0.22, 0.42, 0, 0.15],
  ];
  return (
    <group ref={ref} scale={scale}>
      <group ref={root}>
        <mesh position={[0, 0.45, 0]} scale={[1, 0.85, 1.25]} material={wool} castShadow>
          <icosahedronGeometry args={[0.3, 1]} />
        </mesh>
        {puffs.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} material={wool} castShadow>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
        ))}
        <group ref={head} position={[0, 0.56, 0.34]}>
          <mesh scale={[0.85, 0.95, 1.2]} material={dark} castShadow>
            <icosahedronGeometry args={[0.14, 1]} />
          </mesh>
          <mesh position={[0, 0.12, -0.02]} material={wool}>
            <icosahedronGeometry args={[0.09, 1]} />
          </mesh>
          <mesh position={[0.13, 0.03, -0.03]} rotation={[0, 0, -0.9]} scale={[1, 0.45, 0.7]} material={dark}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
          <mesh position={[-0.13, 0.03, -0.03]} rotation={[0, 0, 0.9]} scale={[1, 0.45, 0.7]} material={dark}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
          <Eye x={0.06} y={0.04} z={0.12} r={mood === 'scared' ? 0.04 : 0.03} />
          <Eye x={-0.06} y={0.04} z={0.12} r={mood === 'scared' ? 0.04 : 0.03} />
        </group>
        {[[0.12, 0.15], [-0.12, 0.15], [0.12, -0.18], [-0.12, -0.18]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.13, z]} material={dark} castShadow>
            <cylinderGeometry args={[0.04, 0.035, 0.28, 6]} />
          </mesh>
        ))}
        {children}
      </group>
    </group>
  );
});

export const Wolf = forwardRef<THREE.Group, CharacterProps>(function Wolf({ mood = 'idle', seed = 0, scale = 1, children }, ref) {
  const root = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  useMoodMotion(root, mood, seed);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (tail.current) tail.current.rotation.y = Math.sin(t * (mood === 'happy' ? 14 : mood === 'angry' ? 2 : 4)) * (mood === 'angry' ? 0.1 : 0.45);
    if (head.current) {
      head.current.rotation.x = mood === 'angry' ? 0.25 : Math.sin(t * 0.8) * 0.06;
      head.current.rotation.y = mood === 'angry' ? 0 : Math.sin(t * 0.5) * 0.3;
    }
  });
  const fur = toon('#6f7480');
  const light = toon('#c9ccd3');
  const dark = toon('#3a3d45');
  return (
    <group ref={ref} scale={scale}>
      <group ref={root}>
        <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} material={fur} castShadow>
          <capsuleGeometry args={[0.19, 0.42, 4, 8]} />
        </mesh>
        <mesh position={[0, 0.5, 0.22]} scale={[1, 1.05, 0.9]} material={light} castShadow>
          <icosahedronGeometry args={[0.18, 1]} />
        </mesh>
        <group ref={head} position={[0, 0.76, 0.38]}>
          <mesh scale={[1, 0.95, 1.05]} material={fur} castShadow>
            <icosahedronGeometry args={[0.18, 1]} />
          </mesh>
          <mesh position={[0, -0.05, 0.19]} rotation-x={Math.PI / 2} material={light} castShadow>
            <coneGeometry args={[0.09, 0.24, 7]} />
          </mesh>
          <mesh position={[0, -0.03, 0.31]} material={toon('#151515', { flat: false, rough: 0.3 })}>
            <sphereGeometry args={[0.03, 8, 8]} />
          </mesh>
          <mesh position={[0.09, 0.19, -0.02]} rotation={[-0.15, 0, -0.25]} material={dark} castShadow>
            <coneGeometry args={[0.055, 0.17, 4]} />
          </mesh>
          <mesh position={[-0.09, 0.19, -0.02]} rotation={[-0.15, 0, 0.25]} material={dark} castShadow>
            <coneGeometry args={[0.055, 0.17, 4]} />
          </mesh>
          <Eye x={0.075} y={0.05} z={0.14} r={0.026} glow={mood === 'angry' ? '#ff5533' : '#ffd23f'} />
          <Eye x={-0.075} y={0.05} z={0.14} r={0.026} glow={mood === 'angry' ? '#ff5533' : '#ffd23f'} />
        </group>
        <group ref={tail} position={[0, 0.58, -0.36]}>
          <mesh position={[0, 0.06, -0.16]} rotation-x={-1.0} material={fur} castShadow>
            <capsuleGeometry args={[0.06, 0.28, 4, 6]} />
          </mesh>
          <mesh position={[0, 0.17, -0.3]} material={light}>
            <icosahedronGeometry args={[0.065, 0]} />
          </mesh>
        </group>
        {[[0.1, 0.2], [-0.1, 0.2], [0.1, -0.2], [-0.1, -0.2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.17, z]} material={dark} castShadow>
            <cylinderGeometry args={[0.05, 0.04, 0.36, 6]} />
          </mesh>
        ))}
        {children}
      </group>
    </group>
  );
});

/** A cheerful farmer, sitting (for boats) or standing. */
export const Farmer = forwardRef<THREE.Group, CharacterProps & { rowing?: boolean; seated?: boolean }>(function Farmer(
  { mood = 'idle', seed = 0, scale = 1, rowing = false, seated = true, children },
  ref,
) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const g = root.current;
    if (g) {
      g.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * 0.15 : 0;
      g.rotation.x = rowing ? Math.sin(t * 6) * 0.12 : 0;
    }
    const swing = rowing ? Math.sin(t * 6) * 0.7 : mood === 'happy' ? -2.4 + Math.sin(t * 10) * 0.3 : -0.2 + Math.sin(t * 1.5) * 0.05;
    if (armL.current) armL.current.rotation.x = rowing ? -1.2 + swing : swing;
    if (armR.current) armR.current.rotation.x = rowing ? -1.2 + swing : mood === 'happy' ? swing : -0.2;
  });
  const skin = toon('#f1c19a');
  const shirt = toon('#d9483b');
  const denim = toon('#2f6db5');
  const straw = toon('#e8c26a', { rough: 1 });
  return (
    <group ref={ref} scale={scale}>
      <group ref={root}>
        {!seated && (
          <>
            <mesh position={[0.08, 0.2, 0]} material={denim} castShadow><cylinderGeometry args={[0.07, 0.07, 0.4, 6]} /></mesh>
            <mesh position={[-0.08, 0.2, 0]} material={denim} castShadow><cylinderGeometry args={[0.07, 0.07, 0.4, 6]} /></mesh>
          </>
        )}
        <group position={[0, seated ? 0 : 0.38, 0]}>
          <mesh position={[0, 0.24, 0]} material={denim} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.4, 8]} />
          </mesh>
          <mesh position={[0, 0.44, 0]} scale={[1.1, 0.6, 0.9]} material={shirt} castShadow>
            <icosahedronGeometry args={[0.17, 1]} />
          </mesh>
          <group ref={armL} position={[0.2, 0.42, 0]}>
            <mesh position={[0, -0.14, 0]} material={shirt} castShadow><capsuleGeometry args={[0.05, 0.2, 4, 6]} /></mesh>
            <mesh position={[0, -0.3, 0]} material={skin}><icosahedronGeometry args={[0.05, 0]} /></mesh>
          </group>
          <group ref={armR} position={[-0.2, 0.42, 0]}>
            <mesh position={[0, -0.14, 0]} material={shirt} castShadow><capsuleGeometry args={[0.05, 0.2, 4, 6]} /></mesh>
            <mesh position={[0, -0.3, 0]} material={skin}><icosahedronGeometry args={[0.05, 0]} /></mesh>
          </group>
          <group position={[0, 0.66, 0]}>
            <mesh material={skin} castShadow><icosahedronGeometry args={[0.15, 2]} /></mesh>
            <mesh position={[0, -0.01, 0.15]} material={toon('#e7a07c')}><sphereGeometry args={[0.035, 8, 8]} /></mesh>
            <mesh position={[0, -0.06, 0.13]} scale={[1.6, 0.5, 0.6]} material={toon('#7a4a2a')}><sphereGeometry args={[0.04, 8, 6]} /></mesh>
            <Eye x={0.055} y={0.04} z={0.13} r={0.022} />
            <Eye x={-0.055} y={0.04} z={0.13} r={0.022} />
            <mesh position={[0, 0.11, 0]} material={straw} castShadow><cylinderGeometry args={[0.3, 0.3, 0.025, 14]} /></mesh>
            <mesh position={[0, 0.18, 0]} material={straw} castShadow><cylinderGeometry args={[0.12, 0.15, 0.13, 10]} /></mesh>
            <mesh position={[0, 0.14, 0]} material={toon('#c0392b')}><cylinderGeometry args={[0.152, 0.152, 0.035, 10]} /></mesh>
          </group>
        </group>
        {children}
      </group>
    </group>
  );
});
