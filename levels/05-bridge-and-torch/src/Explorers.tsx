import { toon, type Mood } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Explorer } from './rules';

/** Live motion info the scene writes every frame and the character reads, so limbs match the walk. */
export interface Motion {
  /** Ground speed in units per second. */
  speed: number;
  /** Raise the right hand to hold the torch. */
  carrying: boolean;
}

interface Look {
  skin: string;
  shirt: string;
  pants: string;
  scale: number;
  /** Forward lean (old Grandpa Mo stoops). */
  hunch: number;
  /** How bouncy the walk is. */
  bounce: number;
}

const LOOKS: Record<Explorer, Look> = {
  pip: { skin: '#f3c9a0', shirt: '#ff7a3d', pants: '#5b3a8c', scale: 0.82, hunch: 0, bounce: 1.4 },
  juno: { skin: '#c98a5c', shirt: '#4caf6e', pants: '#8a6a3f', scale: 0.95, hunch: 0, bounce: 1 },
  bram: { skin: '#e8b48a', shirt: '#3a74c9', pants: '#3b3f52', scale: 1.08, hunch: 0.05, bounce: 0.7 },
  mo: { skin: '#e9c2a2', shirt: '#8b5cc7', pants: '#4a3b5c', scale: 0.98, hunch: 0.32, bounce: 0.4 },
};

/** Where the torch sits when this explorer holds it up, in the explorer's own space (facing +z). */
export const torchGrip = (kind: Explorer): [number, number, number] => {
  const k = LOOKS[kind].scale;
  return [-0.22 * k, 0.74 * k, 0.27 * k];
};

const Eye = ({ x, y, z, r }: { x: number; y: number; z: number; r: number }) => (
  <group position={[x, y, z]}>
    <mesh material={toon('#ffffff', { flat: false, rough: 0.3 })}>
      <sphereGeometry args={[r, 10, 10]} />
    </mesh>
    <mesh position={[0, 0, r * 0.62]} material={toon('#151515', { flat: false, rough: 0.2 })}>
      <sphereGeometry args={[r * 0.55, 8, 8]} />
    </mesh>
  </group>
);

/**
 * One of the four explorers. Faces +z and stands on y = 0.
 * Walk cycle, cheering and trembling are all procedural.
 */
export function ExplorerBody({ kind, mood, motion, seed }: { kind: Explorer; mood: Mood; motion: Motion; seed: number }) {
  const look = LOOKS[kind];
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const phase = useRef(seed * 2.3);
  const stride = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + seed * 1.9;
    const d = Math.min(dt, 0.05);
    const target = Math.min(1, motion.speed * 1.1);
    stride.current += (target - stride.current) * Math.min(1, d * 10);
    const s = stride.current;
    phase.current += d * (4 + motion.speed * 7.5);
    const p = phase.current;
    const swing = Math.sin(p) * 0.75 * s;

    const g = root.current;
    if (g) {
      g.position.y = Math.abs(Math.sin(p)) * 0.06 * s * look.bounce;
      g.rotation.z = 0;
      if (mood === 'happy') g.position.y = Math.abs(Math.sin(t * 6)) * 0.3;
      if (mood === 'scared') {
        g.rotation.z = Math.sin(t * 38) * 0.05;
        g.position.y = Math.abs(Math.sin(t * 9)) * 0.06;
      }
    }
    if (torso.current) {
      const breathe = Math.sin(t * 2.1) * 0.02;
      torso.current.scale.set(1 + breathe * 0.4, 1 + breathe, 1 + breathe * 0.4);
      torso.current.rotation.x = look.hunch + s * 0.08;
    }
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;

    let aL = -swing * 0.8 - 0.1;
    let aR = swing * 0.8 - 0.1;
    if (mood === 'happy') {
      aL = -2.6 + Math.sin(t * 11) * 0.3;
      aR = -2.6 + Math.sin(t * 11 + 1) * 0.3;
    } else if (mood === 'scared') {
      aL = -2.2 + Math.sin(t * 30) * 0.15;
      aR = -2.2 + Math.sin(t * 30 + 1) * 0.15;
    }
    if (motion.carrying && mood !== 'happy') aR = -1.25 + Math.sin(p) * 0.05 * s;
    if (kind === 'mo' && !motion.carrying && mood === 'idle') aR = -0.55; // leaning on the cane
    if (armL.current) armL.current.rotation.x += (aL - armL.current.rotation.x) * Math.min(1, d * 14);
    if (armR.current) armR.current.rotation.x += (aR - armR.current.rotation.x) * Math.min(1, d * 14);

    if (head.current) {
      const look = mood === 'idle' && s < 0.2 ? Math.sin(t * 0.6) * 0.45 * Math.max(0, Math.sin(t * 0.23)) : 0;
      head.current.rotation.y = look;
      head.current.rotation.x = mood === 'scared' ? -0.25 : mood === 'happy' ? -0.2 : 0;
    }
  });

  const skin = toon(look.skin);
  const shirt = toon(look.shirt);
  const pants = toon(look.pants);
  const boot = toon('#4a3020');

  return (
    <group scale={look.scale}>
      <group ref={root}>
        {/* legs */}
        {([
          [legL, 0.085],
          [legR, -0.085],
        ] as const).map(([ref, x], i) => (
          <group key={i} ref={ref} position={[x, 0.36, 0]}>
            <mesh position={[0, -0.16, 0]} material={pants} castShadow>
              <capsuleGeometry args={[0.065, 0.2, 3, 6]} />
            </mesh>
            <mesh position={[0, -0.31, 0.04]} scale={[1, 0.7, 1.4]} material={boot} castShadow>
              <icosahedronGeometry args={[0.075, 0]} />
            </mesh>
          </group>
        ))}
        <group ref={torso} position={[0, 0.36, 0]}>
          <mesh position={[0, 0.2, 0]} material={shirt} castShadow>
            <capsuleGeometry args={[0.17, 0.2, 4, 8]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} material={toon('#5a3a22')}>
            <cylinderGeometry args={[0.178, 0.178, 0.05, 10]} />
          </mesh>
          <group ref={armL} position={[0.22, 0.34, 0]}>
            <mesh position={[0, -0.13, 0]} material={shirt} castShadow>
              <capsuleGeometry args={[0.05, 0.17, 3, 6]} />
            </mesh>
            <mesh position={[0, -0.27, 0]} material={skin}>
              <icosahedronGeometry args={[0.05, 0]} />
            </mesh>
          </group>
          <group ref={armR} position={[-0.22, 0.34, 0]}>
            <mesh position={[0, -0.13, 0]} material={shirt} castShadow>
              <capsuleGeometry args={[0.05, 0.17, 3, 6]} />
            </mesh>
            <mesh position={[0, -0.27, 0]} material={skin}>
              <icosahedronGeometry args={[0.05, 0]} />
            </mesh>
            {kind === 'mo' && (
              <mesh position={[0, -0.3, 0.02]} material={toon('#7a5233')} castShadow>
                <cylinderGeometry args={[0.018, 0.018, 0.62, 5]} />
              </mesh>
            )}
          </group>
          <Extras kind={kind} />
          <group ref={head} position={[0, 0.52, 0.02]}>
            <mesh material={skin} castShadow>
              <icosahedronGeometry args={[0.16, 2]} />
            </mesh>
            <mesh position={[0, -0.02, 0.155]} material={toon('#e09a7a')}>
              <sphereGeometry args={[0.03, 6, 6]} />
            </mesh>
            <Eye x={0.058} y={0.03} z={0.13} r={mood === 'scared' ? 0.032 : 0.024} />
            <Eye x={-0.058} y={0.03} z={0.13} r={mood === 'scared' ? 0.032 : 0.024} />
            <Hat kind={kind} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Each explorer has its own silhouette: headband, pith helmet, big backpack, beard. */
function Hat({ kind }: { kind: Explorer }) {
  switch (kind) {
    case 'pip':
      return (
        <>
          <mesh position={[0, 0.07, 0]} material={toon('#ffd23f')}>
            <cylinderGeometry args={[0.163, 0.163, 0.045, 12]} />
          </mesh>
          <mesh position={[0, 0.11, -0.03]} scale={[1, 0.75, 1]} material={toon('#5a2e1a')} castShadow>
            <icosahedronGeometry args={[0.15, 1]} />
          </mesh>
          <mesh position={[0, 0.1, -0.2]} rotation-x={0.6} material={toon('#5a2e1a')} castShadow>
            <coneGeometry args={[0.06, 0.2, 5]} />
          </mesh>
        </>
      );
    case 'juno':
      return (
        <>
          <mesh position={[0, 0.09, 0]} scale={[1, 0.7, 1]} material={toon('#efe0b4')} castShadow>
            <sphereGeometry args={[0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.09, 0]} material={toon('#e2cf98')} castShadow>
            <cylinderGeometry args={[0.27, 0.27, 0.02, 14]} />
          </mesh>
          <mesh position={[0, 0.105, 0]} material={toon('#8a5a2a')}>
            <cylinderGeometry args={[0.183, 0.183, 0.03, 12]} />
          </mesh>
        </>
      );
    case 'bram':
      return (
        <>
          <mesh position={[0, 0.1, -0.01]} scale={[1, 0.6, 1]} material={toon('#2e2018')} castShadow>
            <icosahedronGeometry args={[0.16, 1]} />
          </mesh>
          {/* round glasses */}
          {[0.06, -0.06].map((x) => (
            <mesh key={x} position={[x, 0.03, 0.155]} material={toon('#d4a64a', { metal: 0.6, rough: 0.35 })}>
              <torusGeometry args={[0.04, 0.008, 5, 12]} />
            </mesh>
          ))}
        </>
      );
    case 'mo':
      return (
        <>
          <mesh position={[0, -0.09, 0.08]} scale={[1.1, 1.2, 0.8]} material={toon('#f2f2f2', { rough: 1 })} castShadow>
            <icosahedronGeometry args={[0.12, 1]} />
          </mesh>
          <mesh position={[0, -0.2, 0.08]} rotation-x={Math.PI} material={toon('#f2f2f2', { rough: 1 })}>
            <coneGeometry args={[0.07, 0.16, 5]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} material={toon('#5a3d7a')} castShadow>
            <cylinderGeometry args={[0.13, 0.17, 0.12, 10]} />
          </mesh>
          <mesh position={[0, 0.07, 0]} material={toon('#5a3d7a')}>
            <cylinderGeometry args={[0.24, 0.24, 0.02, 12]} />
          </mesh>
        </>
      );
  }
}

function Extras({ kind }: { kind: Explorer }): ReactNode {
  if (kind === 'juno') {
    return (
      <mesh position={[-0.13, 0.14, 0.1]} rotation-z={0.3} material={toon('#a8743c')} castShadow>
        <boxGeometry args={[0.14, 0.16, 0.06]} />
      </mesh>
    );
  }
  if (kind === 'bram') {
    return (
      <group position={[0, 0.23, -0.2]}>
        <mesh material={toon('#a35a2e')} castShadow>
          <boxGeometry args={[0.3, 0.36, 0.17]} />
        </mesh>
        <mesh position={[0.08, 0.24, 0]} rotation-z={0.15} material={toon('#f0e2bf')} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.26, 6]} />
        </mesh>
        <mesh position={[-0.06, 0.22, 0.02]} rotation-z={-0.2} material={toon('#e8cf8f')}>
          <cylinderGeometry args={[0.03, 0.03, 0.22, 6]} />
        </mesh>
      </group>
    );
  }
  if (kind === 'pip') {
    return (
      <mesh position={[0, 0.26, -0.15]} rotation-x={0.3} material={toon('#ffd23f')}>
        <boxGeometry args={[0.05, 0.25, 0.02]} />
      </mesh>
    );
  }
  return null;
}
