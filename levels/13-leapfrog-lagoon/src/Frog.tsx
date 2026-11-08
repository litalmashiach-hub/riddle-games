import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { forwardRef, useRef } from 'react';
import * as THREE from 'three';

export type FrogTeam = 'G' | 'O';
export type FrogMood = 'idle' | 'happy' | 'dizzy' | 'duck';

const LOOK: Record<FrogTeam, { skin: string; dark: string; belly: string; cheek: string; crest: string }> = {
  G: { skin: '#5fe07a', dark: '#2fa552', belly: '#eefbb8', cheek: '#ff9eb5', crest: '#7ee0ff' },
  O: { skin: '#ff9a45', dark: '#e0672c', belly: '#fff0c4', cheek: '#ff6f91', crest: '#ffd166' },
};

const white = () => toon('#fbfdf7', { flat: false, rough: 0.4 });
const pupil = () => toon('#1d1a24', { flat: false, rough: 0.2 });
const glint = () => toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 2.5, flat: false });

/**
 * A chubby cartoon frog, about 0.7 units tall, facing +z.
 * Green frogs wear a little blue flower, orange frogs a tiny gold crown, so the teams are easy to tell apart.
 */
export const Frog = forwardRef<THREE.Group, { team: FrogTeam; mood?: FrogMood; seed?: number }>(function Frog({ team, mood = 'idle', seed = 0 }, ref) {
  const c = LOOK[team];
  // A soft self-glow keeps the teams bright and readable in the twilight.
  const skin = toon(c.skin, { emissive: c.skin, emissiveIntensity: 0.22 });
  const dark = toon(c.dark, { emissive: c.dark, emissiveIntensity: 0.15 });
  const belly = toon(c.belly, { emissive: c.belly, emissiveIntensity: 0.18 });
  const body = useRef<THREE.Group>(null);
  const eyes = useRef<(THREE.Group | null)[]>([]);
  const pupils = useRef<(THREE.Mesh | null)[]>([]);
  const throat = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const m = moodRef.current;
    const b = body.current;
    if (b) {
      // Breathing, and a happy wiggle when celebrating.
      const breathe = 1 + Math.sin(t * 2.4) * 0.025;
      b.scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe));
      b.rotation.z = m === 'happy' ? Math.sin(t * 9) * 0.12 : m === 'dizzy' ? Math.sin(t * 3) * 0.18 : 0;
    }
    // Throat pouch puffs now and then (ribbit!).
    if (throat.current) {
      const cyc = (t * 0.45) % 1;
      const puff = m === 'happy' ? 0.5 + 0.5 * Math.abs(Math.sin(t * 7)) : cyc > 0.82 ? Math.sin(((cyc - 0.82) / 0.18) * Math.PI) : 0;
      throat.current.scale.setScalar(0.6 + puff * 0.55);
    }
    // Blink every few seconds; dizzy eyes roll around.
    const blink = (t * 0.31) % 1 > 0.965 ? 0.12 : 1;
    eyes.current.forEach((e, i) => {
      if (e) e.scale.y = m === 'duck' ? 0.25 : m === 'happy' ? 0.55 : blink;
      const p = pupils.current[i];
      if (p) {
        if (m === 'dizzy') {
          const a = t * 9 * (i ? 1 : -1);
          p.position.set(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0.085);
        } else p.position.set(Math.sin(t * 0.7 + i) * 0.012, 0, 0.09);
      }
    });
    if (mouth.current) mouth.current.scale.set(1, m === 'happy' ? 1.6 : m === 'dizzy' ? 0.6 : 1, 1);
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        {/* Body: a chubby squashed ball, a little wider at the back. */}
        <mesh position={[0, 0.27, -0.02]} scale={[1.05, 0.78, 1.12]} material={skin} castShadow>
          <icosahedronGeometry args={[0.3, 1]} />
        </mesh>
        {/* Belly */}
        <mesh position={[0, 0.2, 0.12]} scale={[0.78, 0.6, 0.6]} material={belly}>
          <icosahedronGeometry args={[0.3, 1]} />
        </mesh>
        {/* Back spots */}
        {[
          [0.12, 0.47, -0.12, 0.06],
          [-0.1, 0.45, -0.2, 0.05],
          [0.0, 0.5, 0.02, 0.045],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={[1, 0.4, 1]} material={dark}>
            <icosahedronGeometry args={[r, 0]} />
          </mesh>
        ))}
        {/* Throat pouch */}
        <mesh ref={throat} position={[0, 0.16, 0.27]} scale={0.6} material={toon(c.belly, { flat: false })}>
          <sphereGeometry args={[0.1, 12, 10]} />
        </mesh>
        {/* Smile */}
        <mesh ref={mouth} position={[0, 0.31, 0.3]} rotation={[0.25, 0, Math.PI]} material={toon('#5a1e2c')}>
          <torusGeometry args={[0.12, 0.016, 5, 14, Math.PI]} />
        </mesh>
        {/* Cheeks */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.2, 0.3, 0.24]} scale={[1, 0.6, 0.4]} material={toon(c.cheek, { flat: false })}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
        ))}
        {/* Big eyes on top */}
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * 0.13, 0.5, 0.13]}>
            <mesh material={skin} castShadow>
              <sphereGeometry args={[0.11, 12, 10]} />
            </mesh>
            <group ref={(g) => void (eyes.current[i] = g)} position={[0, 0.02, 0.03]}>
              <mesh material={white()}>
                <sphereGeometry args={[0.088, 14, 12]} />
              </mesh>
              <mesh ref={(m) => void (pupils.current[i] = m)} position={[0, 0, 0.09]} scale={[1, 1.15, 0.5]} material={pupil()}>
                <sphereGeometry args={[0.042, 10, 8]} />
              </mesh>
              <mesh position={[0.025, 0.03, 0.115]} material={glint()}>
                <sphereGeometry args={[0.013, 6, 5]} />
              </mesh>
            </group>
          </group>
        ))}
        {/* Team badge: flower (green) or crown (orange). */}
        {team === 'G' ? (
          <group position={[0.2, 0.58, 0.06]} rotation={[0.2, 0, -0.4]}>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[Math.cos((k / 5) * Math.PI * 2) * 0.045, Math.sin((k / 5) * Math.PI * 2) * 0.045, 0]} scale={[1, 1, 0.4]} material={toon(c.crest, { emissive: c.crest, emissiveIntensity: 0.6 })}>
                <icosahedronGeometry args={[0.035, 0]} />
              </mesh>
            ))}
            <mesh position-z={0.01} material={toon('#ffe066', { emissive: '#ffd23f', emissiveIntensity: 1.2 })}>
              <icosahedronGeometry args={[0.025, 0]} />
            </mesh>
          </group>
        ) : (
          <group position={[0, 0.6, -0.04]} rotation-x={-0.15}>
            <mesh material={toon('#ffcc33', { metal: 0.7, rough: 0.3, emissive: '#ffb000', emissiveIntensity: 0.35 })} castShadow>
              <cylinderGeometry args={[0.075, 0.085, 0.06, 7, 1, true]} />
            </mesh>
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <mesh key={k} position={[Math.cos((k / 7) * Math.PI * 2) * 0.078, 0.05, Math.sin((k / 7) * Math.PI * 2) * 0.078]} material={toon('#ffcc33', { metal: 0.7, rough: 0.3 })}>
                <coneGeometry args={[0.018, 0.05, 4]} />
              </mesh>
            ))}
            <mesh position={[0, 0.0, 0.08]} material={toon('#ff4f8b', { emissive: '#ff2f6f', emissiveIntensity: 2 })}>
              <octahedronGeometry args={[0.02, 0]} />
            </mesh>
          </group>
        )}
        {/* Folded back legs */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.27, 0.12, -0.1]}>
            <mesh rotation={[0.9, 0, s * 0.3]} scale={[0.8, 1, 1]} material={skin} castShadow>
              <capsuleGeometry args={[0.09, 0.16, 3, 8]} />
            </mesh>
            <mesh position={[s * 0.03, -0.09, 0.12]} scale={[1.2, 0.3, 1.6]} material={dark}>
              <icosahedronGeometry args={[0.07, 0]} />
            </mesh>
          </group>
        ))}
        {/* Front legs */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.15, 0.08, 0.2]}>
            <mesh rotation-x={0.3} material={skin} castShadow>
              <capsuleGeometry args={[0.04, 0.1, 3, 6]} />
            </mesh>
            <mesh position={[0, -0.07, 0.04]} scale={[1.4, 0.35, 1.2]} material={dark}>
              <icosahedronGeometry args={[0.05, 0]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
});
