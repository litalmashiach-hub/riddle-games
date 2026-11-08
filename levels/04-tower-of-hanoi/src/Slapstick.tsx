import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Level-only cartoon bits for the funny moments: disc faces and a dust puff (the rest comes from @riddle/fx). */

export type FaceMood = 'none' | 'angry' | 'dizzy' | 'happy';

const white = () => toon('#ffffff', { flat: false, rough: 0.3 });
const ink = () => toon('#1a1210', { flat: false, rough: 0.4 });

/**
 * A little face that pops out on the front rim of a disc.
 * `y` is the middle of the rim, `z` the rim's front.
 */
export function DiscFace({ mood, y, z }: { mood: FaceMood; y: number; z: number }) {
  const root = useRef<THREE.Group>(null);
  const pupils = useRef<(THREE.Group | null)[]>([]);
  const shown = useRef(0);
  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    // Pop in with an overshoot, shrink away when the mood ends.
    const want = mood === 'none' ? 0 : 1;
    shown.current += (want - shown.current) * Math.min(1, dt * (want ? 14 : 10));
    const s = shown.current;
    const pop = 1.6 * s * (1 + Math.sin(s * Math.PI) * 0.35);
    g.scale.setScalar(Math.max(pop, 0.0001));
    g.visible = s > 0.02;
    const t = clock.elapsedTime;
    pupils.current.forEach((p, i) => {
      if (!p) return;
      if (mood === 'dizzy') {
        const a = t * 14 * (i ? -1 : 1);
        p.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0.03);
      } else if (mood === 'angry') p.position.set(i ? -0.012 : 0.012, -0.008, 0.03);
      else p.position.set(0, 0, 0.03);
    });
  });

  const eyeX = 0.11;
  return (
    <group ref={root} position={[0, y, z]} visible={false}>
      {mood === 'happy' ? (
        // Happy closed eyes: little upside-down arcs.
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * eyeX, 0.0, 0.01]} material={ink()}>
            <torusGeometry args={[0.04, 0.012, 6, 12, Math.PI]} />
          </mesh>
        ))
      ) : (
        [-1, 1].map((s, i) => (
          <group key={s} position={[s * eyeX, 0.005, 0]}>
            <mesh scale={[1, 1, 0.55]} material={white()}>
              <sphereGeometry args={[0.058, 14, 12]} />
            </mesh>
            <group ref={(el) => void (pupils.current[i] = el)}>
              <mesh material={ink()}>
                <sphereGeometry args={[0.028, 10, 10]} />
              </mesh>
            </group>
            {mood === 'angry' && (
              <mesh position={[0, 0.075, 0.02]} rotation-z={s * -0.45} material={ink()}>
                <boxGeometry args={[0.1, 0.022, 0.02]} />
              </mesh>
            )}
          </group>
        ))
      )}
      {/* Mouth */}
      {mood === 'happy' && (
        <mesh position={[0, -0.05, 0.01]} rotation-z={Math.PI} material={toon('#7a2a2a', { flat: false })}>
          <torusGeometry args={[0.05, 0.014, 6, 14, Math.PI]} />
        </mesh>
      )}
      {mood === 'angry' && (
        <mesh position={[0, -0.075, 0.01]} material={ink()}>
          <torusGeometry args={[0.035, 0.011, 6, 12, Math.PI]} />
        </mesh>
      )}
      {mood === 'dizzy' && (
        <mesh position={[0.02, -0.06, 0.01]} material={toon('#7a2a2a', { flat: false })}>
          <torusGeometry args={[0.025, 0.011, 6, 12]} />
        </mesh>
      )}
    </group>
  );
}

const PUFFS = 16;

/** A ring of sandy dust clouds bursting out from `position` when `at` changes. */
export function DustPuff({ at, position, radius }: { at: number; position: [number, number, number]; radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dirs = useMemo(
    () =>
      Array.from({ length: PUFFS }, (_, i) => {
        const a = (i / PUFFS) * Math.PI * 2 + (i % 3) * 0.2;
        return { x: Math.cos(a), z: Math.sin(a), up: 0.3 + (i % 4) * 0.12, size: 0.13 + (i % 5) * 0.03, speed: 0.8 + (i % 3) * 0.25 };
      }),
    [],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = (performance.now() - at) / 1000;
    const live = at > 0 && t >= 0 && t < 0.9;
    m.visible = live;
    if (!live) return;
    const e = 1 - Math.pow(1 - t / 0.9, 3);
    dirs.forEach((d, i) => {
      const r = radius + e * d.speed * 1.1;
      o.position.set(position[0] + d.x * r, position[1] + e * d.up, position[2] + d.z * r);
      o.scale.setScalar(d.size * (0.6 + e * 1.6) * (1 - Math.pow(t / 0.9, 2)));
      o.rotation.set(i, i * 2 + e, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PUFFS]} visible={false} frustumCulled={false} material={toon('#f6e2bb', { rough: 1 })}>
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}
