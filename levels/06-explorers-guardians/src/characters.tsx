import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useRef } from 'react';
import * as THREE from 'three';

export type ExplorerMood = 'idle' | 'happy' | 'scared' | 'stone';
export type GuardianMood = 'idle' | 'happy' | 'angry';

/** Looks of the three explorers, so each one is easy to tell apart. */
export const EXPLORER_LOOKS = [
  { scarf: '#ef476f', skin: '#f1c19a', pack: '#7a4a2a', shirt: '#e9cf94' },
  { scarf: '#1fa3c9', skin: '#c68a5a', pack: '#5c6b3a', shirt: '#dcc287' },
  { scarf: '#ffb703', skin: '#8d5a3b', pack: '#8a3b2a', shirt: '#e6d3a3' },
];

const STONE = '#9c968c';

/**
 * A small adventurer with a pith helmet, scarf, backpack and a glowing lantern.
 * Faces +z, stands on y = 0, about 0.85 tall.
 */
export function Explorer({ look, mood = 'idle', seed = 0, riding = false }: { look: number; mood?: ExplorerMood; seed?: number; riding?: boolean }) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const L = EXPLORER_LOOKS[look % EXPLORER_LOOKS.length];
  const stone = mood === 'stone';
  // Petrified explorers keep their pose but every part turns to grey stone.
  const m = (c: string) => (stone ? toon(STONE, { rough: 1 }) : toon(c));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.9;
    const g = root.current;
    if (!g) return;
    if (stone) return;
    g.position.y = 0;
    g.rotation.z = 0;
    g.scale.set(1, 1, 1);
    let aL = -0.15 + Math.sin(t * 1.6) * 0.06;
    let aR = -0.5 + Math.sin(t * 1.6 + 1) * 0.05; // holds the lantern out a little
    let headX = Math.sin(t * 0.7) * 0.05;
    let headY = Math.sin(t * 0.45) * 0.35;
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6));
      g.position.y = b * 0.3;
      g.scale.set(1 + (1 - b) * 0.06, 1 - (1 - b) * 0.08, 1 + (1 - b) * 0.06);
      aL = -2.7 + Math.sin(t * 12) * 0.25;
      aR = -2.5 + Math.sin(t * 12 + 1) * 0.25;
      headY = 0;
      headX = -0.15;
    } else if (mood === 'scared') {
      g.rotation.z = Math.sin(t * 40) * 0.05;
      g.position.y = Math.abs(Math.sin(t * 9)) * 0.08;
      aL = -2.9;
      aR = -2.9;
      headX = -0.25;
      headY = 0;
    } else if (riding) {
      headY = Math.sin(t * 0.9) * 0.5;
      aR = -1.1;
    } else {
      const breathe = Math.sin(t * 2.4) * 0.02;
      g.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    }
    if (armL.current) armL.current.rotation.x = aL;
    if (armR.current) armR.current.rotation.x = aR;
    if (head.current) {
      head.current.rotation.x = headX;
      head.current.rotation.y = headY;
    }
  });

  const boots = m('#4a3326');
  const pants = m('#8a7350');
  const shirt = m(L.shirt);
  const skin = m(L.skin);
  const helmet = m('#f2e6c4');
  const band = m(L.scarf);
  const glass = stone ? toon(STONE, { rough: 1 }) : toon('#ffd27a', { emissive: '#ffb340', emissiveIntensity: 3.5, flat: false });

  return (
    <group ref={root}>
      {[0.075, -0.075].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.16, 0]} material={pants} castShadow>
            <cylinderGeometry args={[0.055, 0.06, 0.26, 6]} />
          </mesh>
          <mesh position={[x, 0.04, 0.03]} scale={[1, 0.7, 1.4]} material={boots} castShadow>
            <icosahedronGeometry args={[0.065, 0]} />
          </mesh>
        </group>
      ))}
      {/* body */}
      <mesh position={[0, 0.4, 0]} material={shirt} castShadow>
        <capsuleGeometry args={[0.14, 0.16, 4, 8]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={m('#5b4330')}>
        <cylinderGeometry args={[0.152, 0.152, 0.04, 10]} />
      </mesh>
      {/* scarf */}
      <mesh position={[0, 0.55, 0.01]} rotation-x={Math.PI / 2} material={band} castShadow>
        <torusGeometry args={[0.1, 0.035, 5, 10]} />
      </mesh>
      <mesh position={[0.06, 0.48, 0.12]} rotation={[0.3, 0, -0.3]} material={band}>
        <boxGeometry args={[0.05, 0.12, 0.02]} />
      </mesh>
      {/* backpack with bedroll */}
      <group position={[0, 0.43, -0.16]}>
        <mesh material={m(L.pack)} castShadow>
          <boxGeometry args={[0.22, 0.24, 0.12]} />
        </mesh>
        <mesh position={[0, 0.16, -0.01]} rotation-z={Math.PI / 2} material={m('#3f7f6a')} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.26, 8]} />
        </mesh>
      </group>
      {/* arms */}
      <group ref={armL} position={[0.17, 0.52, 0]}>
        <mesh position={[0, -0.12, 0]} material={shirt} castShadow>
          <capsuleGeometry args={[0.04, 0.16, 3, 6]} />
        </mesh>
        <mesh position={[0, -0.25, 0]} material={skin}>
          <icosahedronGeometry args={[0.042, 0]} />
        </mesh>
      </group>
      <group ref={armR} position={[-0.17, 0.52, 0]}>
        <mesh position={[0, -0.12, 0]} material={shirt} castShadow>
          <capsuleGeometry args={[0.04, 0.16, 3, 6]} />
        </mesh>
        {/* lantern */}
        <group position={[0, -0.31, 0]}>
          <mesh position-y={0.03} material={m('#5a4632')}>
            <torusGeometry args={[0.035, 0.008, 4, 8]} />
          </mesh>
          <mesh position-y={-0.04} material={glass}>
            <cylinderGeometry args={[0.04, 0.045, 0.08, 6]} />
          </mesh>
          <mesh position-y={-0.09} material={m('#5a4632')}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 6]} />
          </mesh>
        </group>
      </group>
      {/* head */}
      <group ref={head} position={[0, 0.7, 0]}>
        <mesh material={skin} castShadow>
          <icosahedronGeometry args={[0.15, 2]} />
        </mesh>
        <mesh position={[0, -0.015, 0.145]} material={m('#e09a72')}>
          <sphereGeometry args={[0.03, 8, 8]} />
        </mesh>
        {[0.055, -0.055].map((x) => (
          <group key={x} position={[x, 0.03, 0.125]}>
            <mesh material={stone ? toon(STONE) : toon('#ffffff', { flat: false, rough: 0.3 })}>
              <sphereGeometry args={[mood === 'scared' ? 0.032 : 0.024, 10, 10]} />
            </mesh>
            <mesh position-z={0.016} material={stone ? toon('#7d776e') : toon('#141414', { flat: false, rough: 0.2 })}>
              <sphereGeometry args={[0.013, 8, 8]} />
            </mesh>
          </group>
        ))}
        {/* pith helmet */}
        <mesh position-y={0.04} material={helmet} castShadow>
          <sphereGeometry args={[0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position-y={0.045} material={helmet} castShadow>
          <cylinderGeometry args={[0.26, 0.27, 0.02, 14]} />
        </mesh>
        <mesh position-y={0.075} material={band}>
          <cylinderGeometry args={[0.177, 0.177, 0.035, 12]} />
        </mesh>
        <mesh position-y={0.22} material={helmet}>
          <sphereGeometry args={[0.025, 6, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A friendly-but-strict stone guardian: carved block body, floating fists,
 * mossy shoulders and glowing jade eyes and chest rune. Faces +z, about 1.05 tall.
 */
export function Guardian({ mood = 'idle', seed = 0 }: { mood?: GuardianMood; seed?: number }) {
  const root = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const rune = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 2.3;
    const g = root.current;
    if (!g) return;
    g.position.y = 0;
    g.rotation.z = 0;
    g.scale.set(1, 1, 1);
    let hy = 0.5 + Math.sin(t * 1.8) * 0.05;
    let hz = 0.05;
    let hx = 0.36;
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 5));
      g.position.y = b * 0.22;
      hy = 0.9 + Math.sin(t * 10) * 0.12;
      hx = 0.42;
    } else if (mood === 'angry') {
      // Heavy stomping with fists raised.
      const s = Math.abs(Math.sin(t * 7));
      g.position.y = s * 0.12;
      g.scale.set(1 + (1 - s) * 0.05, 1 - (1 - s) * 0.06, 1 + (1 - s) * 0.05);
      hy = 0.95 + Math.sin(t * 14) * 0.08;
      hz = 0.18;
    } else {
      g.position.y = Math.sin(t * 1.2) * 0.012;
    }
    if (handL.current) handL.current.position.set(hx, hy + Math.sin(t * 2.1) * 0.03, hz);
    if (handR.current) handR.current.position.set(-hx, hy + Math.sin(t * 2.1 + 1.4) * 0.03, hz);
    if (handL.current) handL.current.rotation.set(t * 0.3, t * 0.5, 0);
    if (handR.current) handR.current.rotation.set(-t * 0.4, t * 0.3, 0);
    if (head.current) head.current.rotation.y = mood === 'idle' ? Math.sin(t * 0.35) * 0.4 : 0;
    if (rune.current) rune.current.rotation.z = t * (mood === 'angry' ? 4 : 0.6);
  });

  const body = toon('#a39780', { rough: 1 });
  const dark = toon('#7c705d', { rough: 1 });
  const moss = toon('#5f9a4a', { rough: 1 });
  const glowColor = mood === 'angry' ? '#ff4a3d' : '#3ff5b8';
  const glow = toon(glowColor, { emissive: glowColor, emissiveIntensity: mood === 'happy' ? 4.5 : 3.2, flat: false });

  return (
    <group ref={root}>
      {/* stubby legs */}
      {[0.14, -0.14].map((x) => (
        <mesh key={x} position={[x, 0.11, 0]} material={dark} castShadow>
          <boxGeometry args={[0.18, 0.22, 0.22]} />
        </mesh>
      ))}
      {/* body */}
      <mesh position={[0, 0.48, 0]} scale={[1.05, 1, 0.85]} material={body} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.33, 0]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} material={dark} castShadow>
        <cylinderGeometry args={[0.3, 0.26, 0.1, 8]} />
      </mesh>
      {/* chest rune */}
      <mesh ref={rune} position={[0, 0.5, 0.27]} material={glow}>
        <torusGeometry args={[0.075, 0.018, 4, 6]} />
      </mesh>
      <mesh position={[0, 0.5, 0.27]} material={glow}>
        <octahedronGeometry args={[0.035, 0]} />
      </mesh>
      {/* moss on the shoulders */}
      <mesh position={[0.2, 0.72, -0.02]} scale={[1, 0.5, 1]} material={moss} castShadow>
        <icosahedronGeometry args={[0.12, 0]} />
      </mesh>
      <mesh position={[-0.16, 0.74, 0.05]} scale={[1, 0.45, 1]} material={moss}>
        <icosahedronGeometry args={[0.09, 0]} />
      </mesh>
      {/* head */}
      <group ref={head} position={[0, 0.88, 0]}>
        <mesh material={body} castShadow>
          <boxGeometry args={[0.34, 0.26, 0.28]} />
        </mesh>
        <mesh position={[0, 0.06, 0.13]} material={dark} castShadow>
          <boxGeometry args={[0.38, 0.06, 0.08]} />
        </mesh>
        {[0.08, -0.08].map((x) => (
          <mesh key={x} position={[x, -0.01, 0.142]} rotation-z={x > 0 ? -0.15 : 0.15} material={glow}>
            <boxGeometry args={[0.08, mood === 'angry' ? 0.025 : 0.04, 0.01]} />
          </mesh>
        ))}
        <mesh position={[0, 0.16, -0.02]} scale={[1.2, 0.45, 1]} material={moss}>
          <icosahedronGeometry args={[0.1, 0]} />
        </mesh>
      </group>
      {/* floating fists */}
      <group ref={handL}>
        <mesh material={body} castShadow>
          <dodecahedronGeometry args={[0.11, 0]} />
        </mesh>
      </group>
      <group ref={handR}>
        <mesh material={body} castShadow>
          <dodecahedronGeometry args={[0.11, 0]} />
        </mesh>
      </group>
    </group>
  );
}
