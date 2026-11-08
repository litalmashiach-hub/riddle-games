import { toon } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Shelly, the lagoon turtle whose portrait the mosaic shows. Low-poly, about 1 unit long.
 * Her head points along +z. All motion (idle, impatient, party, the sleepy tumble) is done here
 * from `mode` and `since` (performance.now() when the mode started).
 */
export type ShellyMode = 'idle' | 'impatient' | 'happy' | 'tumble';

const SKIN = '#8fd46a';
const SKIN_DARK = '#5fae4a';
const SHELL = '#3a9d4c';
const RIM = '#d29a3c';
const BELLY = '#f3e2a9';

/** Where she lands in the water when she tumbles (relative to her home spot, in world axes). */
export interface TumblePath {
  home: [number, number, number];
  edge: [number, number, number];
  splash: [number, number, number];
}

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tumble timing in seconds: yawn, roll over, spin across the moss, splash, float. */
export const TUMBLE = { yawn: 1.0, flip: 1.5, spinEnd: 2.7, sink: 3.0, float: 3.5 };

export function Shelly({ mode, since, path, yaw }: { mode: ShellyMode; since: number; path: TumblePath; yaw: number }) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const roll = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const flippers = useRef<(THREE.Group | null)[]>([]);
  const hat = useRef<THREE.Group>(null);
  const spinAngle = useRef(0);

  // Hexagon plates on the dome, each turned to face out from the shell.
  const plates = useMemo(() => {
    const out: { pos: THREE.Vector3; quat: THREE.Quaternion; s: number; color: string }[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const add = (polar: number, az: number, s: number, color: string) => {
      const n = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
      const pos = new THREE.Vector3(n.x * 0.5, n.y * 0.5 * 0.72, n.z * 0.5 * 1.12);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, n);
      out.push({ pos, quat, s, color });
    };
    add(0, 0, 1.1, '#9ad86e');
    for (let i = 0; i < 6; i++) add(0.85, (i / 6) * Math.PI * 2, 0.9, i % 2 ? '#7cc85c' : '#a6dc72');
    return out;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const r = root.current;
    const sp = spin.current;
    const rl = roll.current;
    const b = body.current;
    const h = head.current;
    if (!r || !sp || !rl || !b || !h) return;
    const age = (performance.now() - since) / 1000;
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.1 : 1;
    let lid = 1 - blink; // 0 open, 1 closed
    let mouthOpen = 0;
    let paddle = Math.sin(t * 2.2) * 0.15;
    let paddleFast = 0;
    let headPitch = Math.sin(t * 1.3) * 0.05;
    let headTilt = 0;
    let breathe = 1 + Math.sin(t * 2) * 0.02;
    let x = path.home[0];
    let y = path.home[1];
    let z = path.home[2];
    let rollZ = 0;
    let spinY = 0;
    let hatOn = false;

    if (mode === 'impatient') {
      paddleFast = Math.max(0, Math.sin(t * 14)) * 0.5;
      headTilt = Math.sin(t * 1.5) * 0.25;
      lid = Math.max(lid, 0.35);
    } else if (mode === 'happy') {
      const hop = Math.abs(Math.sin(age * 5));
      y += hop * 0.45;
      spinY = age > 0.6 && age < 1.6 ? (age - 0.6) * Math.PI * 2 : 0;
      paddle = Math.sin(t * 16) * 0.6;
      headPitch = -0.25;
      mouthOpen = 0.6;
      lid = 0;
    } else if (mode === 'tumble') {
      const T = TUMBLE;
      if (age < T.yawn) {
        // A huge, wobbly yawn.
        const k = Math.sin((age / T.yawn) * Math.PI);
        mouthOpen = k * 1.4;
        headPitch = -0.6 * k;
        breathe = 1 + k * 0.12;
        lid = 0.4 + 0.6 * ease(age / T.yawn);
      } else {
        lid = 1;
        if (age < T.flip) {
          // Roll over backwards with a little hop.
          const k = ease((age - T.yawn) / (T.flip - T.yawn));
          rollZ = Math.PI * k;
          y += Math.sin(k * Math.PI) * 0.5 + k * 0.25;
          paddle = Math.sin(t * 20) * 0.7;
        } else if (age < T.spinEnd) {
          // Spin on her shell like a top, skidding off to the water.
          const k = (age - T.flip) / (T.spinEnd - T.flip);
          rollZ = Math.PI;
          spinAngle.current += 0.4 * (1 - k * 0.5);
          spinY = spinAngle.current;
          const e = ease(k);
          x = lerp(path.home[0], path.edge[0], e);
          z = lerp(path.home[2], path.edge[2], e);
          y = lerp(path.home[1], path.edge[1], e) + 0.25 + Math.abs(Math.sin(k * 12)) * 0.08;
          if (k > 0.7) {
            const f = (k - 0.7) / 0.3;
            x = lerp(path.edge[0], path.splash[0], f);
            z = lerp(path.edge[2], path.splash[2], f);
            y = lerp(path.edge[1] + 0.25, path.splash[1] + 0.4, f) + Math.sin(f * Math.PI) * 0.6;
          }
          paddle = Math.sin(t * 24) * 0.8;
        } else {
          // Plop! Sink, then bob back up, floating belly-up and fast asleep under a lily pad.
          rollZ = Math.PI;
          spinY = spinAngle.current + Math.sin(age * 0.8) * 0.2;
          x = path.splash[0];
          z = path.splash[2];
          const sinkK = ease((age - T.spinEnd) / (T.sink - T.spinEnd));
          const upK = ease((age - T.sink) / (T.float - T.sink));
          y = path.splash[1] + 0.4 - sinkK * 0.9 + upK * 0.65 + Math.sin(age * 2.2) * 0.04;
          paddle = Math.sin(t * 3) * 0.35;
          hatOn = age > T.spinEnd + 0.05;
          breathe = 1 + Math.sin(t * 1.6) * 0.05;
        }
      }
    }

    r.position.set(x, y, z);
    r.rotation.y = yaw;
    sp.rotation.y = spinY;
    rl.rotation.z = rollZ;
    b.scale.set(1, breathe, 1);
    h.rotation.x = headPitch;
    h.rotation.z = headTilt;
    if (lids.current) lids.current.scale.y = Math.max(0.05, lid);
    if (mouth.current) {
      mouth.current.visible = mouthOpen > 0.05;
      mouth.current.scale.set(1, Math.max(0.05, mouthOpen), 1);
    }
    if (smile.current) smile.current.visible = mouthOpen <= 0.05;
    flippers.current.forEach((f, i) => {
      if (!f) return;
      const side = i % 2 ? -1 : 1;
      const front = i < 2;
      f.rotation.y = side * (front ? paddle + paddleFast : -paddle * 0.7);
      f.rotation.z = front && i === 0 ? -paddleFast * 0.8 : 0;
    });
    if (hat.current) hat.current.visible = hatOn;
  });

  return (
    <group ref={root} scale={1.3}>
      <group ref={spin}>
        {/* roll pivots around the shell's middle so she flips in place */}
        <group position-y={0.3}>
          <group ref={roll}>
            <group position-y={-0.3}>
              <group ref={body}>
                {/* shell dome */}
                <mesh position-y={0.18} scale={[1, 0.72, 1.12]} castShadow material={toon(SHELL)}>
                  <sphereGeometry args={[0.5, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
                </mesh>
                <group position-y={0.18}>
                  {plates.map((p, i) => (
                    <mesh key={i} position={p.pos} quaternion={p.quat} scale={p.s} material={toon(p.color)}>
                      <cylinderGeometry args={[0.13, 0.15, 0.05, 6]} />
                    </mesh>
                  ))}
                </group>
                {/* rim and belly */}
                <mesh position-y={0.18} rotation-x={Math.PI / 2} scale={[1, 1.12, 1]} castShadow material={toon(RIM)}>
                  <torusGeometry args={[0.5, 0.07, 6, 18]} />
                </mesh>
                <mesh position-y={0.1} scale={[1, 1, 1.12]} material={toon(BELLY)}>
                  <cylinderGeometry args={[0.48, 0.4, 0.14, 14]} />
                </mesh>
                {/* tail */}
                <mesh position={[0, 0.12, -0.62]} rotation-x={-Math.PI / 2 - 0.3} material={toon(SKIN)}>
                  <coneGeometry args={[0.07, 0.2, 5]} />
                </mesh>
              </group>
              {/* flippers: front right, front left, back right, back left */}
              {(
                [
                  [0.46, 0.38],
                  [-0.46, 0.38],
                  [0.4, -0.4],
                  [-0.4, -0.4],
                ] as const
              ).map(([fx, fz], i) => (
                <group key={i} position={[fx, 0.1, fz]} ref={(el) => void (flippers.current[i] = el)}>
                  <mesh position={[Math.sign(fx) * 0.14, 0, fz > 0 ? 0.06 : -0.03]} rotation-y={Math.sign(fx) * (fz > 0 ? -0.5 : 0.6)} scale={fz > 0 ? [0.28, 0.06, 0.13] : [0.2, 0.06, 0.11]} castShadow material={toon(SKIN_DARK)}>
                    <sphereGeometry args={[1, 8, 5]} />
                  </mesh>
                </group>
              ))}
              {/* head */}
              <group ref={head} position={[0, 0.24, 0.6]}>
                <mesh position={[0, 0, -0.08]} rotation-x={Math.PI / 2 - 0.3} material={toon(SKIN)}>
                  <capsuleGeometry args={[0.11, 0.18, 3, 8]} />
                </mesh>
                <mesh position={[0, 0.06, 0.14]} castShadow material={toon(SKIN)}>
                  <icosahedronGeometry args={[0.24, 1]} />
                </mesh>
                {[-1, 1].map((s) => (
                  <group key={s} position={[s * 0.1, 0.15, 0.32]}>
                    <mesh material={toon('#ffffff', { rough: 0.4 })}>
                      <sphereGeometry args={[0.085, 10, 8]} />
                    </mesh>
                    <mesh position={[0, -0.005, 0.055]} material={toon('#1b2433', { rough: 0.3 })}>
                      <sphereGeometry args={[0.045, 8, 6]} />
                    </mesh>
                    <mesh position={[-s * 0.012, 0.02, 0.092]} material={toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 2 })}>
                      <sphereGeometry args={[0.014, 6, 4]} />
                    </mesh>
                    {/* cheek */}
                    <mesh position={[s * 0.06, -0.11, -0.01]} scale={[1, 0.6, 0.5]} material={toon('#ff9bb3')}>
                      <sphereGeometry args={[0.04, 6, 4]} />
                    </mesh>
                  </group>
                ))}
                {/* sleepy eyelids: scale y from 0 (open) to 1 (shut) */}
                <group ref={lids} position={[0, 0.235, 0.32]}>
                  {[-1, 1].map((s) => (
                    <mesh key={s} position={[s * 0.1, -0.045, 0]} scale={[1, 1, 1]} material={toon(SKIN_DARK)}>
                      <sphereGeometry args={[0.092, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    </mesh>
                  ))}
                </group>
                <mesh ref={smile} position={[0, -0.04, 0.36]} rotation-z={Math.PI} material={toon('#2d4a2a')}>
                  <torusGeometry args={[0.05, 0.012, 4, 10, Math.PI]} />
                </mesh>
                <mesh ref={mouth} position={[0, -0.05, 0.34]} scale={[1, 0.1, 1]} material={toon('#7a2638')}>
                  <sphereGeometry args={[0.065, 10, 8]} />
                </mesh>
                {/* little pink flower behind one eye */}
                <group position={[0.13, 0.27, 0.1]} rotation-z={-0.4}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.045, 0, Math.sin((i / 5) * Math.PI * 2) * 0.045]} material={toon('#ff7eb6')}>
                      <sphereGeometry args={[0.035, 6, 4]} />
                    </mesh>
                  ))}
                  <mesh position-y={0.02} material={toon('#ffe066', { emissive: '#ffcc33', emissiveIntensity: 0.6 })}>
                    <sphereGeometry args={[0.025, 6, 4]} />
                  </mesh>
                </group>
              </group>
              {/* lily-pad blanket on her belly, only seen once she floats belly-up */}
              <group ref={hat} position={[0, 0.02, 0]} rotation-x={Math.PI} visible={false}>
                <mesh rotation-x={-Math.PI / 2} material={toon('#4fbf55', { flat: false })}>
                  <circleGeometry args={[0.6, 20, 0.2, Math.PI * 2 - 0.4]} />
                </mesh>
                {Array.from({ length: 6 }, (_, i) => (
                  <mesh key={i} position={[0.12 + Math.cos((i / 6) * Math.PI * 2) * 0.07, 0.05, -0.1 + Math.sin((i / 6) * Math.PI * 2) * 0.07]} material={toon('#ff8fc8', { emissive: '#ff5fae', emissiveIntensity: 0.5 })}>
                    <sphereGeometry args={[0.06, 6, 4]} />
                  </mesh>
                ))}
                <mesh position={[0.12, 0.08, -0.1]} material={toon('#ffe066', { emissive: '#ffcc33', emissiveIntensity: 1.5 })}>
                  <sphereGeometry args={[0.045, 6, 4]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
