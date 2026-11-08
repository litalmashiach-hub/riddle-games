import { useFrame } from '@react-three/fiber';
import { toon, type Mood } from '@riddle/props';
import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { brass, iron } from './Gear';
import { roleOf, type Person, type Role } from './rules';

/** Standing height of each role, used to place name tags and bubbles. */
export const HEIGHT: Record<Role, number> = { father: 1.38, mother: 1.22, son: 0.82, daughter: 0.82, guard: 1.38, thief: 1.08 };

const Eye = ({ x, y, z, r }: { x: number; y: number; z: number; r: number }) => (
  <group position={[x, y, z]}>
    <mesh material={toon('#ffffff', { flat: false, rough: 0.3 })}>
      <sphereGeometry args={[r, 10, 10]} />
    </mesh>
    <mesh position={[0, 0, r * 0.62]} material={toon('#141414', { flat: false, rough: 0.2 })}>
      <sphereGeometry args={[r * 0.55, 8, 8]} />
    </mesh>
  </group>
);

interface HumanoidProps {
  mood: Mood;
  seed: number;
  skin?: string;
  top: string;
  bottom: string;
  shoes?: string;
  /** A skirt or dress instead of trousers. */
  skirt?: string;
  kid?: boolean;
  /** Lean forward (sneaky). */
  hunch?: number;
  /** Fixed raise of the right arm (holding something up). */
  holdRight?: number;
  /** The head darts left and right. */
  shifty?: boolean;
  head?: ReactNode;
  body?: ReactNode;
  leftHand?: ReactNode;
  rightHand?: ReactNode;
}

/** A chunky toy-like person. Faces +z, feet on y = 0. */
function Humanoid({ mood, seed, skin = '#f1c19a', top, bottom, shoes = '#3b2f2b', skirt, kid, hunch = 0, holdRight, shifty, head, body, leftHand, rightHand }: HumanoidProps) {
  const root = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.37;
    const g = root.current;
    if (!g) return;
    g.position.y = 0;
    g.rotation.z = 0;
    g.scale.set(1, 1, 1);
    let aL = -0.12 + Math.sin(t * 1.6) * 0.06;
    let aR = -0.12 - Math.sin(t * 1.6) * 0.06;
    let zL = 0.12;
    let zR = -0.12;
    let headX = 0;
    let headY = Math.sin(t * 0.6) * 0.35 * Math.max(0, Math.sin(t * 0.23));
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6.5));
      g.position.y = b * (kid ? 0.32 : 0.22);
      g.scale.set(1 + (1 - b) * 0.06, 1 - (1 - b) * 0.08, 1 + (1 - b) * 0.06);
      aL = -2.7 + Math.sin(t * 13) * 0.3;
      aR = -2.7 - Math.sin(t * 13) * 0.3;
      zL = 0.35;
      zR = -0.35;
      headX = -0.15;
      headY = 0;
    } else if (mood === 'scared') {
      g.rotation.z = Math.sin(t * 42) * 0.05;
      g.position.y = Math.abs(Math.sin(t * 9)) * 0.08;
      aL = -2.2;
      aR = -2.2;
      zL = -0.35;
      zR = 0.35;
      headX = 0.2;
      headY = Math.sin(t * 20) * 0.08;
    } else if (mood === 'angry') {
      g.position.y = Math.abs(Math.sin(t * 10)) * 0.05;
      g.scale.y = 1 + Math.sin(t * 14) * 0.03;
      aL = -0.3;
      aR = -0.3;
      zL = 0.9;
      zR = -0.9;
      headX = 0.12;
      headY = Math.sin(t * 7) * 0.25;
    } else {
      const breathe = Math.sin(t * 2.1) * 0.02;
      g.scale.set(1 + breathe * 0.4, 1 + breathe, 1 + breathe * 0.4);
      if (shifty) headY = Math.sign(Math.sin(t * 1.3)) * 0.55 * Math.min(1, Math.abs(Math.sin(t * 1.3)) * 6);
    }
    if (holdRight != null && mood !== 'happy') {
      aR = holdRight;
      zR = -0.15;
    }
    const k = 0.25;
    if (armL.current) {
      armL.current.rotation.x += (aL - armL.current.rotation.x) * k;
      armL.current.rotation.z += (zL - armL.current.rotation.z) * k;
    }
    if (armR.current) {
      armR.current.rotation.x += (aR - armR.current.rotation.x) * k;
      armR.current.rotation.z += (zR - armR.current.rotation.z) * k;
    }
    if (headRef.current) {
      headRef.current.rotation.x += (headX - headRef.current.rotation.x) * 0.2;
      headRef.current.rotation.y += (headY - headRef.current.rotation.y) * 0.2;
    }
    if (eyes.current) {
      const blink = (t * 0.5) % 4 < 0.08 ? 0.1 : mood === 'scared' ? 1.35 : 1;
      eyes.current.scale.set(mood === 'scared' ? 1.25 : 1, blink, 1);
    }
  });

  const skinM = toon(skin);
  const topM = toon(top);
  const bottomM = toon(bottom);
  const shoeM = toon(shoes);
  const headR = kid ? 0.19 : 0.155;
  const legH = kid ? 0.2 : 0.36;
  const torsoH = kid ? 0.26 : 0.36;
  const hip = legH;
  const shoulder = hip + torsoH - 0.04;
  const headY = shoulder + headR + 0.06;
  const armLen = kid ? 0.2 : 0.26;

  return (
    <group ref={root}>
      {/* legs or a skirt */}
      {skirt ? (
        <>
          <mesh position-y={hip / 2 + 0.06} material={toon(skirt)} castShadow>
            <cylinderGeometry args={[0.12, kid ? 0.24 : 0.3, hip + 0.1, 10]} />
          </mesh>
          {[0.07, -0.07].map((x) => (
            <mesh key={x} position={[x, 0.03, 0.04]} scale={[1, 0.6, 1.4]} material={shoeM} castShadow>
              <sphereGeometry args={[0.055, 8, 6]} />
            </mesh>
          ))}
        </>
      ) : (
        [0.075, -0.075].map((x) => (
          <group key={x} position-x={x}>
            <mesh position-y={legH / 2 + 0.03} material={bottomM} castShadow>
              <cylinderGeometry args={[0.065, 0.06, legH, 7]} />
            </mesh>
            <mesh position={[0, 0.035, 0.04]} scale={[1, 0.6, 1.5]} material={shoeM} castShadow>
              <sphereGeometry args={[0.065, 8, 6]} />
            </mesh>
          </group>
        ))
      )}
      <group ref={upper} position-y={hip} rotation-x={hunch}>
        {/* torso */}
        <mesh position-y={torsoH / 2} scale={[1.05, 1, 0.85]} material={topM} castShadow>
          <capsuleGeometry args={[kid ? 0.13 : 0.165, torsoH - 0.12, 4, 10]} />
        </mesh>
        {!skirt && (
          <mesh position-y={0.04} scale={[1.05, 1, 0.85]} material={bottomM} castShadow>
            <cylinderGeometry args={[kid ? 0.135 : 0.17, kid ? 0.14 : 0.175, 0.1, 10]} />
          </mesh>
        )}
        {body}
        {/* arms */}
        <group ref={armL} position={[kid ? 0.16 : 0.2, shoulder - hip, 0]}>
          <mesh position-y={-armLen / 2 - 0.02} material={topM} castShadow>
            <capsuleGeometry args={[0.048, armLen, 4, 6]} />
          </mesh>
          <mesh position-y={-armLen - 0.06} material={skinM}>
            <icosahedronGeometry args={[0.05, 0]} />
          </mesh>
          <group position-y={-armLen - 0.08}>{leftHand}</group>
        </group>
        <group ref={armR} position={[kid ? -0.16 : -0.2, shoulder - hip, 0]}>
          <mesh position-y={-armLen / 2 - 0.02} material={topM} castShadow>
            <capsuleGeometry args={[0.048, armLen, 4, 6]} />
          </mesh>
          <mesh position-y={-armLen - 0.06} material={skinM}>
            <icosahedronGeometry args={[0.05, 0]} />
          </mesh>
          <group position-y={-armLen - 0.08}>{rightHand}</group>
        </group>
        {/* head */}
        <group ref={headRef} position-y={headY - hip}>
          <mesh material={skinM} castShadow>
            <icosahedronGeometry args={[headR, 2]} />
          </mesh>
          <mesh position={[0, -headR * 0.12, headR * 0.95]} material={toon('#e7a07c')}>
            <sphereGeometry args={[headR * 0.2, 8, 8]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * headR * 0.55, -headR * 0.3, headR * 0.75]} material={toon('#f29a8e', { flat: false })}>
              <sphereGeometry args={[headR * 0.16, 8, 6]} />
            </mesh>
          ))}
          <group ref={eyes} position={[0, headR * 0.22, 0]}>
            <Eye x={headR * 0.36} y={0} z={headR * 0.84} r={headR * 0.17} />
            <Eye x={-headR * 0.36} y={0} z={headR * 0.84} r={headR * 0.17} />
          </group>
          {head}
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The eight characters

/** Brass steampunk goggles, for hats. */
function Goggles({ y, r }: { y: number; r: number }) {
  return (
    <group position={[0, y, r]}>
      {[1, -1].map((s) => (
        <group key={s} position-x={s * r * 0.42}>
          <mesh material={brass()}>
            <torusGeometry args={[r * 0.26, r * 0.07, 6, 14]} />
          </mesh>
          <mesh position-z={0.005}>
            <circleGeometry args={[r * 0.24, 14]} />
            <meshStandardMaterial color="#7ff3ff" emissive="#38d6f0" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Father({ mood, seed }: { mood: Mood; seed: number }) {
  const r = 0.155;
  return (
    <Humanoid
      mood={mood}
      seed={seed}
      top="#2f6b4f"
      bottom="#4a4a58"
      head={
        <>
          {/* top hat with goggles */}
          <mesh position-y={r * 0.85} material={toon('#26222b')} castShadow>
            <cylinderGeometry args={[0.27, 0.27, 0.025, 16]} />
          </mesh>
          <mesh position-y={r * 0.85 + 0.17} material={toon('#26222b')} castShadow>
            <cylinderGeometry args={[0.15, 0.14, 0.32, 14]} />
          </mesh>
          <mesh position-y={r * 0.85 + 0.06} material={brass()}>
            <cylinderGeometry args={[0.145, 0.145, 0.05, 14]} />
          </mesh>
          <group position-y={r * 0.85 + 0.08}>
            <Goggles y={0} r={0.15} />
          </group>
          {/* curly mustache */}
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * 0.05, -0.05, r * 0.9]} rotation-z={s * 0.5} material={toon('#5a3420')}>
              <capsuleGeometry args={[0.022, 0.06, 3, 6]} />
            </mesh>
          ))}
          {/* sideburns */}
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * r * 0.92, 0.0, 0.02]} scale={[0.5, 1.2, 0.8]} material={toon('#5a3420')}>
              <sphereGeometry args={[0.05, 6, 6]} />
            </mesh>
          ))}
        </>
      }
      body={
        <>
          {/* coat tails and brass buttons and a pocket watch */}
          <mesh position={[0, -0.06, -0.1]} rotation-x={0.25} material={toon('#2f6b4f')} castShadow>
            <boxGeometry args={[0.3, 0.26, 0.06]} />
          </mesh>
          <mesh position={[0, 0.2, 0.135]} material={toon('#efe6d6')}>
            <boxGeometry args={[0.1, 0.18, 0.02]} />
          </mesh>
          <mesh position={[0.07, 0.07, 0.135]} rotation-x={Math.PI / 2} material={brass()}>
            <cylinderGeometry args={[0.035, 0.035, 0.015, 10]} />
          </mesh>
        </>
      }
    />
  );
}

function Mother({ mood, seed, flushed }: { mood: Mood; seed: number; flushed: boolean }) {
  const r = 0.155;
  const hair = toon('#a0462a');
  return (
    <Humanoid
      mood={mood}
      seed={seed}
      skin={flushed ? '#ff7a6b' : undefined}
      top="#9b59b6"
      bottom="#9b59b6"
      skirt="#7d3c98"
      holdRight={-0.75}
      head={
        <>
          <mesh position={[0, 0.03, -0.03]} scale={[1.08, 1.02, 1.05]} material={hair} castShadow>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
          <mesh position={[0, r + 0.04, -0.04]} material={hair} castShadow>
            <icosahedronGeometry args={[0.085, 1]} />
          </mesh>
          {/* fringe so the face shows */}
          <mesh position={[0, r * 0.55, r * 0.6]} scale={[1.3, 0.45, 0.6]} material={hair}>
            <sphereGeometry args={[0.1, 8, 6]} />
          </mesh>
          {/* tiny hat with a feather */}
          <group position={[0.06, r + 0.02, 0.02]} rotation-z={-0.3}>
            <mesh material={toon('#3a2342')}>
              <cylinderGeometry args={[0.08, 0.09, 0.05, 10]} />
            </mesh>
            <mesh position={[-0.05, 0.08, -0.02]} rotation-z={0.6} scale={[0.35, 1, 0.2]} material={toon('#5fd0b5')}>
              <sphereGeometry args={[0.08, 6, 6]} />
            </mesh>
          </group>
        </>
      }
      body={
        <>
          <mesh position={[0, 0.27, 0.12]} material={toon('#f6e7f8')}>
            <boxGeometry args={[0.12, 0.08, 0.03]} />
          </mesh>
          {/* parasol over the shoulder */}
          <group position={[-0.29, 0.06, 0.14]} rotation={[-0.25, 0, 0.18]}>
            <mesh position-y={0.42} material={toon('#5a3a22')}>
              <cylinderGeometry args={[0.012, 0.012, 0.9, 5]} />
            </mesh>
            <mesh position-y={0.86} material={toon('#f78fb3')} castShadow>
              <coneGeometry args={[0.36, 0.17, 8, 1, true]} />
            </mesh>
            <mesh position-y={0.97} material={toon('#ffffff')}>
              <sphereGeometry args={[0.025, 6, 6]} />
            </mesh>
          </group>
        </>
      }
    />
  );
}

function Son({ mood, seed, variant }: { mood: Mood; seed: number; variant: number }) {
  const r = 0.19;
  const cap = variant ? '#c0392b' : '#6b4f2a';
  return (
    <Humanoid
      mood={mood}
      seed={seed}
      kid
      top={variant ? '#2a9d8f' : '#3d7cc9'}
      bottom="#7a5230"
      head={
        <>
          <mesh position={[0, r * 0.6, -0.01]} scale={[1.08, 0.55, 1.1]} material={toon(cap)} castShadow>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
          <mesh position={[0, r * 0.55, r * 0.95]} rotation-x={0.25} material={toon(cap)}>
            <boxGeometry args={[0.2, 0.025, 0.12]} />
          </mesh>
          <group position-y={r * 0.72}>
            <Goggles y={0} r={r * 0.95} />
          </group>
          {/* freckles */}
          {[0.06, -0.06].map((x) => (
            <mesh key={x} position={[x, -0.04, r * 0.96]} material={toon('#b5653f')}>
              <sphereGeometry args={[0.008, 4, 4]} />
            </mesh>
          ))}
        </>
      }
      body={
        <mesh position-y={0.22} rotation-x={Math.PI / 2} material={toon(variant ? '#f4a261' : '#e63946')}>
          <torusGeometry args={[0.1, 0.035, 6, 12]} />
        </mesh>
      }
      rightHand={
        // a little wrench
        <group rotation-x={Math.PI / 2}>
          <mesh position-y={0.07} material={iron()}>
            <boxGeometry args={[0.025, 0.14, 0.02]} />
          </mesh>
          <mesh position-y={0.15} material={iron()}>
            <torusGeometry args={[0.03, 0.012, 4, 8, Math.PI * 1.5]} />
          </mesh>
        </group>
      }
    />
  );
}

function Daughter({ mood, seed, variant }: { mood: Mood; seed: number; variant: number }) {
  const r = 0.19;
  const hair = toon(variant ? '#e0a040' : '#4a2c1f');
  return (
    <Humanoid
      mood={mood}
      seed={seed}
      kid
      top={variant ? '#ffcf56' : '#ff8fb1'}
      bottom="#ffffff"
      skirt={variant ? '#f4b400' : '#f06292'}
      head={
        <>
          <mesh position={[0, 0.04, -0.03]} scale={[1.07, 1.02, 1.04]} material={hair} castShadow>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
          <mesh position={[0, r * 0.55, r * 0.55]} scale={[1.4, 0.5, 0.7]} material={hair}>
            <sphereGeometry args={[0.11, 8, 6]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * (r + 0.05), -0.02, -0.02]} material={hair} castShadow>
              <icosahedronGeometry args={[0.075, 1]} />
            </mesh>
          ))}
          {/* bow */}
          <group position={[0, r + 0.02, 0]}>
            {[1, -1].map((s) => (
              <mesh key={s} position-x={s * 0.06} rotation-z={(s * Math.PI) / 2} material={toon('#e63946')}>
                <coneGeometry args={[0.05, 0.1, 4]} />
              </mesh>
            ))}
            <mesh material={toon('#e63946')}>
              <sphereGeometry args={[0.03, 6, 6]} />
            </mesh>
          </group>
        </>
      }
      leftHand={
        // a tiny clockwork bird toy
        <group position={[0, -0.02, 0.05]}>
          <mesh material={brass()}>
            <icosahedronGeometry args={[0.045, 0]} />
          </mesh>
          <mesh position={[0, 0.01, 0.045]} rotation-x={Math.PI / 2} material={toon('#e76f51')}>
            <coneGeometry args={[0.015, 0.035, 4]} />
          </mesh>
        </group>
      }
    />
  );
}

function Guard({ mood, seed }: { mood: Mood; seed: number }) {
  const r = 0.155;
  const navy = '#26386b';
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (glow.current) glow.current.emissiveIntensity = 3 + Math.sin(clock.elapsedTime * 11 + seed) * 0.4;
  });
  return (
    <Humanoid
      mood={mood}
      seed={seed}
      top={navy}
      bottom="#1d2747"
      shoes="#111111"
      head={
        <>
          {/* tall domed helmet with a brass spike */}
          <mesh position={[0, r * 0.75, -0.01]} scale={[1, 1.35, 1.05]} material={toon(navy)} castShadow>
            <sphereGeometry args={[r * 1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, r * 0.75, 0]} rotation-x={Math.PI / 2} material={brass()}>
            <torusGeometry args={[r * 1.02, 0.018, 5, 16]} />
          </mesh>
          <mesh position={[0, r * 0.75 + r * 1.42, 0]} material={brass()}>
            <coneGeometry args={[0.03, 0.09, 6]} />
          </mesh>
          <mesh position={[0, r * 1.2, r * 0.98]} rotation-x={0.2} material={brass()}>
            <octahedronGeometry args={[0.04, 0]} />
          </mesh>
          {/* chin strap and a stern mustache */}
          <mesh position={[0, -0.06, r * 0.9]} scale={[2.2, 0.6, 0.6]} material={toon('#2b2226')}>
            <sphereGeometry args={[0.026, 6, 6]} />
          </mesh>
        </>
      }
      body={
        <>
          {[0.25, 0.17, 0.09].map((y) => (
            <mesh key={y} position={[0, y, 0.145]} material={brass()}>
              <sphereGeometry args={[0.018, 6, 6]} />
            </mesh>
          ))}
          <mesh position-y={0.03} scale={[1.08, 1, 0.9]} material={toon('#e9e2d0')}>
            <cylinderGeometry args={[0.172, 0.172, 0.05, 12]} />
          </mesh>
          <mesh position={[0, 0.03, 0.155]} material={brass()}>
            <boxGeometry args={[0.06, 0.05, 0.02]} />
          </mesh>
          {/* shoulder epaulettes */}
          {[0.19, -0.19].map((x) => (
            <mesh key={x} position={[x, 0.3, 0]} scale={[1, 0.4, 1]} material={brass()}>
              <sphereGeometry args={[0.06, 8, 6]} />
            </mesh>
          ))}
        </>
      }
      leftHand={
        <group position-y={-0.08}>
          <mesh position-y={0.06} material={iron()}>
            <torusGeometry args={[0.03, 0.008, 4, 8]} />
          </mesh>
          <mesh position-y={-0.02} material={iron()}>
            <cylinderGeometry args={[0.05, 0.06, 0.03, 6]} />
          </mesh>
          <mesh position-y={-0.09}>
            <cylinderGeometry args={[0.045, 0.05, 0.11, 6]} />
            <meshStandardMaterial ref={glow} color="#ffd38a" emissive="#ffb347" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position-y={-0.155} material={iron()}>
            <cylinderGeometry args={[0.06, 0.05, 0.025, 6]} />
          </mesh>
        </group>
      }
      rightHand={
        <mesh position={[0, -0.05, 0.05]} rotation-x={1.2} material={toon('#3a2a20')}>
          <cylinderGeometry args={[0.018, 0.022, 0.28, 6]} />
        </mesh>
      }
    />
  );
}

function Thief({ mood, seed, bigSack }: { mood: Mood; seed: number; bigSack: boolean }) {
  const r = 0.155;
  const sack = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const g = sack.current;
    if (!g) return;
    const target = bigSack ? 1.9 : 1;
    const s = g.scale.x + (target - g.scale.x) * Math.min(1, dt * 1.2);
    const wob = bigSack ? Math.sin(clock.elapsedTime * 14) * 0.06 : 0;
    g.scale.set(s + wob, s - wob, s + wob);
  });
  const black = toon('#1e1b22');
  return (
    <group>
      <Humanoid
        mood={mood}
        seed={seed}
        top="#f4f1ea"
        bottom="#2b2832"
        hunch={0.22}
        shifty
        head={
          <>
            {/* beanie */}
            <mesh position={[0, r * 0.45, -0.01]} scale={[1.06, 0.75, 1.06]} material={black} castShadow>
              <sphereGeometry args={[r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh position-y={r * 0.45} rotation-x={Math.PI / 2} material={black}>
              <torusGeometry args={[r * 1.04, 0.03, 5, 14]} />
            </mesh>
            {/* bandit mask across the eyes */}
            <mesh position={[0, r * 0.22, 0]} material={black}>
              <cylinderGeometry args={[r * 1.03, r * 1.03, 0.075, 14, 1, true]} />
            </mesh>
            {/* stubble */}
            <mesh position={[0, -r * 0.5, r * 0.62]} scale={[1.2, 0.6, 0.7]} material={toon('#9e8a7a')}>
              <sphereGeometry args={[0.08, 8, 6]} />
            </mesh>
          </>
        }
        body={
          <>
            {/* stripes */}
            {[0.08, 0.17, 0.26].map((y) => (
              <mesh key={y} position-y={y} scale={[1.07, 1, 0.88]} material={black}>
                <cylinderGeometry args={[0.168, 0.168, 0.04, 12]} />
              </mesh>
            ))}
            {/* loot sack */}
            <group ref={sack} position={[0.05, 0.32, -0.22]}>
              <mesh scale={[1, 0.95, 0.85]} material={toon('#a07a4a', { rough: 1 })} castShadow>
                <icosahedronGeometry args={[0.2, 1]} />
              </mesh>
              <mesh position={[0, 0.2, 0]} material={toon('#7a5a32')}>
                <coneGeometry args={[0.06, 0.1, 6]} />
              </mesh>
              <mesh position={[0, 0.02, -0.17]} material={toon('#e0b54a', { metal: 0.7, rough: 0.35 })}>
                <cylinderGeometry args={[0.035, 0.035, 0.012, 10]} />
              </mesh>
            </group>
          </>
        }
      />
      {/* ball and chain on his ankle */}
      <group position={[0.07, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.05 + i * 0.06, 0.05, -0.08 - i * 0.07]} rotation={[0, 0.8, i % 2 ? Math.PI / 2 : 0]} material={iron()}>
            <torusGeometry args={[0.03, 0.01, 4, 8]} />
          </mesh>
        ))}
        <mesh position={[0.25, 0.1, -0.33]} material={toon('#2a2730', { metal: 0.5, rough: 0.5 })} castShadow>
          <icosahedronGeometry args={[0.1, 1]} />
        </mesh>
      </group>
    </group>
  );
}

/** Draws the right character for a person. */
export function Character({ who, mood, seed, flushed = false, bigSack = false }: { who: Person; mood: Mood; seed: number; flushed?: boolean; bigSack?: boolean }) {
  const role = roleOf(who);
  const variant = who.endsWith('B') ? 1 : 0;
  switch (role) {
    case 'father':
      return <Father mood={mood} seed={seed} />;
    case 'mother':
      return <Mother mood={mood} seed={seed} flushed={flushed} />;
    case 'son':
      return <Son mood={mood} seed={seed} variant={variant} />;
    case 'daughter':
      return <Daughter mood={mood} seed={seed} variant={variant} />;
    case 'guard':
      return <Guard mood={mood} seed={seed} />;
    case 'thief':
      return <Thief mood={mood} seed={seed} bigSack={bigSack} />;
  }
}
