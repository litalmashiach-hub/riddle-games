import { useFrame } from '@react-three/fiber';
import { toon, type Mood } from '@riddle/props';
import { useRef } from 'react';
import * as THREE from 'three';
import type { Couple, Role } from './rules';

/** Body color, accent (hat band / bow) and belly per couple. */
export const COUPLE_COLORS: Record<Couple, { body: string; accent: string; belly: string }> = {
  0: { body: '#ff7f6e', accent: '#ffd166', belly: '#ffe6d5' },
  1: { body: '#2ec4b6', accent: '#ff8fab', belly: '#dcfbf5' },
  2: { body: '#9d74e0', accent: '#7ee0b0', belly: '#efe4ff' },
};

const ORANGE = '#ffa62b';

/**
 * A round little sky bird. Gents wear a top hat and bow tie, ladies a flower bow and blush.
 * Faces +z, stands on y = 0, about 0.8 units tall.
 */
export function Bird({ couple, role, mood = 'idle', seed = 0 }: { couple: Couple; role: Role; mood?: Mood; seed?: number }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const c = COUPLE_COLORS[couple];
  const isGent = role === 'gent';

  useFrame(({ clock }) => {
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
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
    if (head.current) head.current.rotation.z = tilt;
  });

  const body = toon(c.body);
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
              {[0.15, -0.15].map((x) => (
                <mesh key={x} position={[x, 0.42, 0.2]} scale={[1, 0.6, 0.4]} material={toon('#ff9fb2', { flat: false })}>
                  <sphereGeometry args={[0.035, 8, 6]} />
                </mesh>
              ))}
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
