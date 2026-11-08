import { toon } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

/**
 * Pose knobs the scene animates every frame. All 0..1 unless noted.
 * The otter faces +z and stands on y = 0, about 0.85 tall.
 */
export interface OtterRig {
  /** 0 standing up, 1 lying on its belly like a toboggan. */
  lie: number;
  /** Windmilling arms and wide eyes (teetering over the hole). */
  flail: number;
  /** Bouncing with joy, eyes closed in a smile. */
  happy: number;
  /** Teeth-chattering shiver after a dip. */
  shiver: number;
  /** Squash and stretch: <1 squashed flat, >1 stretched. */
  squash: number;
  /** Dripping wet: darker fur and a lily-pad hat. */
  wet: number;
  /** Holding a fish up in its paws. */
  fish: number;
}

export const newRig = (): OtterRig => ({ lie: 0, flail: 0, happy: 0, shiver: 0, squash: 1, wet: 0, fish: 0 });

const FUR = '#9a643d';
const FUR_WET = '#5e3a22';
const CREAM = '#f3d9b5';
const DARK = '#2a1a12';
const SCARF = '#ff5d73';
const SCARF2 = '#ffe0e6';

const fur = toon(FUR, { flat: false, rough: 0.85 });
const furWet = toon(FUR_WET, { flat: false, rough: 0.35 });
const cream = toon(CREAM, { flat: false, rough: 0.9 });
const dark = toon(DARK, { flat: false, rough: 0.3 });
const white = toon('#ffffff', { flat: false, rough: 0.2 });
const scarf = toon(SCARF, { rough: 0.9 });
const scarfStripe = toon(SCARF2, { rough: 0.9 });
const blush = toon('#ff9aa8', { flat: false, rough: 0.9 });
const pad = toon('#3fae6a', { rough: 0.7 });
const lotus = toon('#ffb3d1', { emissive: '#ff7eb6', emissiveIntensity: 0.6 });
const fishMat = toon('#ff9f43', { rough: 0.5, emissive: '#ff7a1a', emissiveIntensity: 0.25 });

const lerp = THREE.MathUtils.lerp;

export function Otter({ rig, seed = 0 }: { rig: MutableRefObject<OtterRig>; seed?: number }) {
  const bounce = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const footL = useRef<THREE.Group>(null);
  const footR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const scarfTail = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const hat = useRef<THREE.Group>(null);
  const fish = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const headMesh = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const r = rig.current;
    const t = clock.elapsedTime + seed;
    const b = bounce.current;
    const p = pivot.current;
    if (!b || !p) return;

    // Whole-body bounce and squash.
    const hop = r.happy * Math.abs(Math.sin(t * 7)) * 0.3;
    const breathe = Math.sin(t * 2.3) * 0.02 * (1 - r.lie);
    b.position.y = hop;
    const sq = r.squash * (1 + breathe) * (1 - r.happy * (1 - Math.abs(Math.sin(t * 7))) * 0.12);
    b.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    b.rotation.z = r.shiver * Math.sin(t * 55) * 0.07 + r.flail * Math.sin(t * 9) * 0.18;

    // Tip forward onto the belly. The pivot sits at hip height so the belly lands on the ice.
    p.rotation.x = r.lie * (Math.PI / 2 - 0.08);
    p.position.y = lerp(0.2, 0.17, r.lie);
    p.position.z = lerp(0, -0.12, r.lie);

    // Head: looks up a bit when lying so the face points along the slide.
    if (head.current) {
      head.current.rotation.x = -r.lie * 0.9 + r.happy * Math.sin(t * 7) * 0.1;
      head.current.rotation.z = Math.sin(t * 1.3) * 0.06 * (1 - r.lie) + r.shiver * Math.sin(t * 60) * 0.05;
    }

    // Arms: hang (stand), point forward (slide), windmill (flail), wave up (happy).
    const sw = Math.sin(t * 2.2) * 0.08;
    const armBase = lerp(sw, -2.75, r.lie);
    const happyArm = -2.6 + Math.sin(t * 10) * 0.35;
    const fishArm = -1.1;
    const pose = (side: number, phase: number) => {
      let x = armBase;
      x = lerp(x, happyArm, r.happy * (1 - r.fish));
      x = lerp(x, fishArm, r.fish);
      x = lerp(x, -t * 16 + phase, r.flail);
      const z = side * (0.25 + r.flail * 0.5 + r.happy * 0.25 * (1 - r.fish) - r.fish * 0.35);
      return [x, z] as const;
    };
    if (armL.current) [armL.current.rotation.x, armL.current.rotation.z] = pose(1, 0);
    if (armR.current) [armR.current.rotation.x, armR.current.rotation.z] = pose(-1, Math.PI);

    // Feet paddle while flailing, tuck back while sliding.
    const kick = r.flail * Math.sin(t * 22) * 0.9;
    if (footL.current) footL.current.rotation.x = r.lie * 1.1 + kick;
    if (footR.current) footR.current.rotation.x = r.lie * 1.1 - kick;

    // Tail sways; straight out behind while sliding.
    if (tail.current) {
      tail.current.rotation.y = Math.sin(t * 3) * 0.35 * (1 - r.lie) + r.flail * Math.sin(t * 14) * 0.6;
      tail.current.rotation.x = lerp(1.2, 0.35, r.lie);
    }
    if (scarfTail.current) {
      scarfTail.current.rotation.x = lerp(0.15 + Math.sin(t * 3) * 0.08, 1.35 + Math.sin(t * 25) * 0.15, r.lie);
      scarfTail.current.rotation.z = Math.sin(t * 2) * 0.1;
    }

    // Eyes: wide in panic, happy squints, blink now and then.
    if (eyes.current) {
      const blink = (t * 0.7) % 4 < 0.12 ? 0.1 : 1;
      const wide = 1 + r.flail * 0.7;
      const sy = Math.min(blink, lerp(1, 0.2, r.happy)) * wide;
      eyes.current.scale.set(wide, sy, 1);
    }
    if (mouth.current) mouth.current.scale.setScalar(Math.max(0.001, r.flail + r.shiver * 0.6));
    if (hat.current) hat.current.scale.setScalar(Math.max(0.001, r.wet));
    if (fish.current) {
      fish.current.scale.setScalar(Math.max(0.001, r.fish));
      fish.current.rotation.z = Math.sin(t * 12) * 0.3;
    }
    const m = r.wet > 0.5 ? furWet : fur;
    if (body.current && body.current.material !== m) {
      body.current.material = m;
      if (headMesh.current) headMesh.current.material = m;
    }
  });

  return (
    <group ref={bounce}>
      <group ref={pivot}>
        {/* body */}
        <mesh ref={body} material={fur} position={[0, 0.17, 0]} castShadow>
          <capsuleGeometry args={[0.18, 0.26, 6, 14]} />
        </mesh>
        <mesh material={cream} position={[0, 0.15, 0.1]} scale={[1, 1.45, 0.62]}>
          <sphereGeometry args={[0.14, 16, 12]} />
        </mesh>

        {/* knitted scarf */}
        <mesh material={scarf} position={[0, 0.43, 0]} rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[0.15, 0.05, 8, 18]} />
        </mesh>
        <mesh material={scarfStripe} position={[0, 0.43, 0]} rotation-x={Math.PI / 2} scale={[1.02, 1.02, 0.35]}>
          <torusGeometry args={[0.15, 0.05, 6, 18]} />
        </mesh>
        <group ref={scarfTail} position={[0.07, 0.42, -0.12]}>
          <mesh material={scarf} position={[0, -0.12, -0.02]} castShadow>
            <boxGeometry args={[0.09, 0.24, 0.035]} />
          </mesh>
          <mesh material={scarfStripe} position={[0, -0.2, -0.02]}>
            <boxGeometry args={[0.095, 0.04, 0.04]} />
          </mesh>
        </group>

        {/* head */}
        <group ref={head} position={[0, 0.58, 0.02]}>
          <mesh ref={headMesh} material={fur} castShadow>
            <sphereGeometry args={[0.18, 18, 14]} />
          </mesh>
          <mesh material={cream} position={[0, -0.04, 0.13]} scale={[1.15, 0.78, 0.85]}>
            <sphereGeometry args={[0.1, 14, 10]} />
          </mesh>
          <mesh material={dark} position={[0, 0.0, 0.225]} scale={[1.3, 0.9, 1]}>
            <sphereGeometry args={[0.034, 10, 8]} />
          </mesh>
          <mesh ref={mouth} material={dark} position={[0, -0.075, 0.2]} scale={0.001}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
          <group ref={eyes} position={[0, 0.06, 0.14]}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.075, 0, 0]}>
                <mesh material={dark}>
                  <sphereGeometry args={[0.032, 12, 10]} />
                </mesh>
                <mesh material={white} position={[0.01, 0.012, 0.025]}>
                  <sphereGeometry args={[0.011, 8, 6]} />
                </mesh>
              </group>
            ))}
          </group>
          {[-1, 1].map((s) => (
            <mesh key={`b${s}`} material={blush} position={[s * 0.11, -0.04, 0.12]} scale={[1, 0.6, 0.4]}>
              <sphereGeometry args={[0.03, 8, 6]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`e${s}`} material={fur} position={[s * 0.13, 0.12, -0.02]} scale={[1, 0.85, 0.6]}>
              <sphereGeometry args={[0.05, 10, 8]} />
            </mesh>
          ))}
          {/* whiskers */}
          {[-1, 1].flatMap((s) =>
            [0, 1].map((i) => (
              <mesh key={`w${s}${i}`} material={white} position={[s * 0.14, -0.035 - i * 0.025, 0.17]} rotation={[0, 0, s * (0.15 - i * 0.25)]}>
                <boxGeometry args={[0.12, 0.006, 0.006]} />
              </mesh>
            )),
          )}
          {/* lily-pad hat after the dip */}
          <group ref={hat} position={[0.02, 0.17, -0.01]} rotation={[0.15, 0.4, -0.2]} scale={0.001}>
            <mesh material={pad} castShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.025, 14, 1, false, 0.4, Math.PI * 2 - 0.5]} />
            </mesh>
            <mesh material={lotus} position={[0.05, 0.05, 0.03]}>
              <coneGeometry args={[0.06, 0.09, 6]} />
            </mesh>
          </group>
        </group>

        {/* arms (shoulder pivots) */}
        {[
          [armL, 1],
          [armR, -1],
        ].map(([ref, s]) => (
          <group key={s as number} ref={ref as React.RefObject<THREE.Group>} position={[(s as number) * 0.17, 0.33, 0.06]}>
            <mesh material={fur} position={[0, -0.09, 0]} castShadow>
              <capsuleGeometry args={[0.045, 0.1, 4, 8]} />
            </mesh>
            <mesh material={dark} position={[0, -0.17, 0.01]}>
              <sphereGeometry args={[0.045, 8, 6]} />
            </mesh>
          </group>
        ))}

        {/* fish held up in both paws */}
        <group ref={fish} position={[0, 0.35, 0.3]} scale={0.001}>
          <mesh material={fishMat} scale={[0.55, 0.75, 1.3]}>
            <sphereGeometry args={[0.1, 12, 8]} />
          </mesh>
          <mesh material={fishMat} position={[0, 0, -0.17]} rotation-x={-Math.PI / 2} scale={[0.4, 1, 1]}>
            <coneGeometry args={[0.09, 0.12, 4]} />
          </mesh>
          <mesh material={dark} position={[0.05, 0.02, 0.07]}>
            <sphereGeometry args={[0.014, 6, 4]} />
          </mesh>
        </group>

        {/* feet */}
        {[
          [footL, 1],
          [footR, -1],
        ].map(([ref, s]) => (
          <group key={`f${s}`} ref={ref as React.RefObject<THREE.Group>} position={[(s as number) * 0.09, -0.1, 0.03]}>
            <mesh material={dark} position={[0, -0.06, 0.05]} scale={[1, 0.5, 1.5]} castShadow>
              <sphereGeometry args={[0.06, 10, 8]} />
            </mesh>
          </group>
        ))}

        {/* thick otter tail */}
        <group ref={tail} position={[0, -0.02, -0.13]}>
          <mesh material={fur} position={[0, -0.18, 0]} rotation-x={Math.PI} castShadow>
            <coneGeometry args={[0.09, 0.4, 10]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
