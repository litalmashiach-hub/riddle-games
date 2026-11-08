import { useFrame } from '@react-three/fiber';
import { toon, type Mood } from '@riddle/props';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Couple, Role } from './rules';

/** Body color, accent (hat band / bow) and belly per couple. */
export const COUPLE_COLORS: Record<Couple, { body: string; accent: string; belly: string }> = {
  0: { body: '#ff7f6e', accent: '#ffd166', belly: '#ffe6d5' },
  1: { body: '#2ec4b6', accent: '#ff8fab', belly: '#dcfbf5' },
  2: { body: '#9d74e0', accent: '#7ee0b0', belly: '#efe4ff' },
};

const ORANGE = '#ffa62b';
const RED = new THREE.Color('#ff3b2f');

/**
 * A round little sky bird. Gents wear a top hat and bow tie, ladies a flower bow and blush.
 * Faces +z, stands on y = 0, about 0.8 units tall.
 */
/**
 * `act` adds a comic pose on top of the mood: 'whistle' looks away and sways innocently,
 * 'fluster' hides the face behind the wings and blushes hard.
 */
export function Bird({ couple, role, mood = 'idle', seed = 0, act }: { couple: Couple; role: Role; mood?: Mood; seed?: number; act?: 'whistle' | 'fluster' }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const c = COUPLE_COLORS[couple];
  const isGent = role === 'gent';
  const angry = mood === 'angry';
  // Own body material, so a fuming bird can turn tomato-red without recoloring the others.
  const fumeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.8, flatShading: true }), [c.body]);
  const fume = useRef(0);
  const blushRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + seed * 1.37;
    const g = root.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.set(1, 1, 1);
    let flap = Math.max(0, Math.sin(t * 0.9)) ** 12 * Math.sin(t * 30) * 0.5; // an occasional flutter
    let tilt = Math.sin(t * 0.7) * 0.12;
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6));
      g.position.y = b * 0.32;
      g.scale.set(1 + (1 - b) * 0.1, 1 - (1 - b) * 0.12, 1 + (1 - b) * 0.1);
      flap = 0.6 + Math.sin(t * 24) * 0.5;
    } else if (mood === 'angry') {
      // Stomping and puffing up.
      const stomp = Math.abs(Math.sin(t * 9));
      g.position.y = stomp * 0.12;
      g.rotation.z = Math.sin(t * 18) * 0.08;
      g.scale.setScalar(1.08 + Math.sin(t * 9) * 0.04);
      flap = 0.9 + Math.sin(t * 18) * 0.6;
      tilt = 0;
    } else if (mood === 'scared') {
      g.rotation.z = Math.sin(t * 40) * 0.06;
      g.position.y = Math.abs(Math.sin(t * 8)) * 0.08;
      flap = 0.3 + Math.sin(t * 40) * 0.2;
      tilt = 0.25;
    } else {
      const breathe = Math.sin(t * 2.4) * 0.03;
      g.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    }
    let turn = 0;
    let wingX = 0;
    if (act === 'whistle') {
      // Looking away, swaying to a tune nobody else hears.
      turn = 0.9 + Math.sin(t * 2) * 0.1;
      tilt = Math.sin(t * 4) * 0.18;
      g.rotation.z = Math.sin(t * 4) * 0.06;
      g.position.y = Math.abs(Math.sin(t * 4)) * 0.04;
    } else if (act === 'fluster') {
      // Wings over the face, peeking out now and then.
      const peek = Math.max(0, Math.sin(t * 1.3)) ** 8;
      flap = 1.9 - peek * 1.1 + Math.sin(t * 30) * 0.05;
      wingX = -0.9 + peek * 0.6;
      tilt = Math.sin(t * 2.5) * 0.12;
    }
    if (wingL.current) {
      wingL.current.rotation.z = flap;
      wingL.current.rotation.x = wingX;
    }
    if (wingR.current) {
      wingR.current.rotation.z = -flap;
      wingR.current.rotation.x = wingX;
    }
    if (head.current) {
      head.current.rotation.z = tilt;
      head.current.rotation.y = turn;
    }
    // Fuming: slowly go red and glow a little, cool down again afterwards.
    fume.current += ((angry ? 1 : 0) - fume.current) * Math.min(1, dt * (angry ? 0.9 : 3));
    fumeMat.color.set(c.body).lerp(RED, fume.current * 0.85);
    fumeMat.emissive.set('#ff2a00').multiplyScalar(fume.current * (0.25 + Math.sin(t * 10) * 0.08));
    const k = act === 'fluster' ? 1.8 + Math.sin(t * 6) * 0.2 : 1;
    blushRef.current?.children.forEach((m) => m.scale.set(k, k * 0.6, k * 0.4));
  });

  const body = fumeMat;
  const belly = toon(c.belly);
  const orange = toon(ORANGE);
  const eye = toon('#1b1530', { flat: false, rough: 0.12 });
  const hat = toon('#2b2440', { rough: 0.5 });

  return (
    <group scale={isGent ? 1.08 : 1}>
      <group ref={root}>
        {/* body and belly */}
        <mesh position={[0, 0.36, 0]} scale={[1, 1.12, 0.95]} material={body} castShadow>
          <icosahedronGeometry args={[0.27, 1]} />
        </mesh>
        <mesh position={[0, 0.3, 0.12]} scale={[0.95, 1.05, 0.7]} material={belly}>
          <icosahedronGeometry args={[0.2, 1]} />
        </mesh>
        {/* wings */}
        <group ref={wingL} position={[0.23, 0.44, -0.02]}>
          <mesh position={[0.04, -0.12, 0]} rotation-z={0.25} scale={[0.32, 0.8, 0.85]} material={body} castShadow>
            <icosahedronGeometry args={[0.17, 0]} />
          </mesh>
        </group>
        <group ref={wingR} position={[-0.23, 0.44, -0.02]}>
          <mesh position={[-0.04, -0.12, 0]} rotation-z={-0.25} scale={[0.32, 0.8, 0.85]} material={body} castShadow>
            <icosahedronGeometry args={[0.17, 0]} />
          </mesh>
        </group>
        {/* tail */}
        <mesh position={[0, 0.3, -0.27]} rotation-x={-2.0} material={body} castShadow>
          <coneGeometry args={[0.09, 0.22, 4]} />
        </mesh>
        {/* feet */}
        {[0.09, -0.09].map((x) => (
          <mesh key={x} position={[x, 0.035, 0.05]} scale={[1, 0.5, 1.6]} material={orange} castShadow>
            <icosahedronGeometry args={[0.055, 0]} />
          </mesh>
        ))}
        <group ref={head}>
          {/* face */}
          <mesh position={[0, 0.44, 0.27]} rotation-x={Math.PI / 2} material={orange} castShadow>
            <coneGeometry args={[0.055, 0.14, 5]} />
          </mesh>
          {[0.095, -0.095].map((x) => (
            <mesh key={x} position={[x, 0.5, 0.21]} scale={mood === 'scared' ? 1.35 : mood === 'angry' ? [1.1, 0.6, 1] : 1} material={eye}>
              <sphereGeometry args={[0.042, 10, 10]} />
            </mesh>
          ))}
          {angry &&
            [0.095, -0.095].map((x) => (
              <mesh key={x} position={[x, 0.565, 0.235]} rotation-z={x > 0 ? 0.5 : -0.5} material={eye}>
                <boxGeometry args={[0.09, 0.022, 0.02]} />
              </mesh>
            ))}
          {act === 'whistle' && (
            <mesh position={[0, 0.4, 0.33]} material={toon('#1b1530', { flat: false })}>
              <torusGeometry args={[0.022, 0.009, 6, 10]} />
            </mesh>
          )}
          {isGent ? (
            <>
              {/* top hat */}
              <group position={[0.02, 0.72, -0.01]} rotation-z={-0.12}>
                <mesh material={hat} castShadow>
                  <cylinderGeometry args={[0.15, 0.15, 0.02, 14]} />
                </mesh>
                <mesh position-y={0.1} material={hat} castShadow>
                  <cylinderGeometry args={[0.09, 0.1, 0.19, 12]} />
                </mesh>
                <mesh position-y={0.035} material={toon(c.accent)}>
                  <cylinderGeometry args={[0.102, 0.102, 0.04, 12]} />
                </mesh>
              </group>
              {/* bow tie */}
              {[0.05, -0.05].map((x) => (
                <mesh key={x} position={[x, 0.33, 0.27]} rotation-z={x > 0 ? -Math.PI / 2 : Math.PI / 2} material={toon(c.accent)}>
                  <coneGeometry args={[0.04, 0.09, 3]} />
                </mesh>
              ))}
            </>
          ) : (
            <>
              {/* flower bow */}
              <group position={[0.1, 0.66, 0.04]} rotation-z={-0.4}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.06, Math.sin((i / 5) * Math.PI * 2) * 0.06, 0]} material={toon(c.accent)} castShadow>
                    <icosahedronGeometry args={[0.045, 0]} />
                  </mesh>
                ))}
                <mesh position-z={0.02} material={toon('#fff4b8', { emissive: '#ffe066', emissiveIntensity: 0.6 })}>
                  <icosahedronGeometry args={[0.035, 0]} />
                </mesh>
              </group>
              {/* blush */}
              <group ref={blushRef} position={[0, 0.42, 0.2]}>
                {[0.15, -0.15].map((x) => (
                  <mesh key={x} position={[x, 0, 0]} scale={[1, 0.6, 0.4]} material={toon('#ff7a9a', { flat: false, emissive: '#ff4f7a', emissiveIntensity: act === 'fluster' ? 0.8 : 0 })}>
                    <sphereGeometry args={[0.035, 8, 6]} />
                  </mesh>
                ))}
              </group>
            </>
          )}
          {/* little head tuft */}
          <mesh position={[-0.05, 0.69, 0.02]} rotation-z={0.5} material={body}>
            <coneGeometry args={[0.03, 0.1, 4]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Puffs of angry steam rising from a head. */
export function Steam({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.children.forEach((m, i) => {
      const p = (clock.elapsedTime * 1.2 + i / g.children.length) % 1;
      m.position.set(Math.sin(i * 2.3 + p * 3) * 0.15 * (i % 2 ? 1 : -1), p * 0.7, 0);
      m.scale.setScalar(0.4 + p * 1.1);
      ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 1 - p;
    });
  });
  return (
    <group ref={ref} position={position}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[0.08, 1]} />
          <meshStandardMaterial color="#ffffff" transparent depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
