import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Traveller } from './rules';

/*
 * The "lights out" gag when the lantern dies: the world goes dark, only the travellers'
 * big cartoon eyes are left blinking and darting around, and a few curious fireflies drift in.
 * Everything here draws on top of the darkness (depthTest off, high renderOrder).
 */

const VEIL_ORDER = 20;
const ON_TOP = VEIL_ORDER + 1;

/** A huge dark dome around the camera that fades in, dimming the whole world. */
export function DarkVeil() {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#070a24',
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.82, Math.min(1, dt * 5));
  });
  return (
    <mesh renderOrder={VEIL_ORDER} material={mat}>
      <sphereGeometry args={[45, 16, 12]} />
    </mesh>
  );
}

const glow = (color: string) =>
  new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false, transparent: true, fog: false });

/** Where each traveller's eyes are in the dark. Tuk peeks out from inside its shell. */
const EYE_Y: Record<Traveller, number> = { zip: 0.68, mira: 0.67, bo: 0.75, elm: 0.66, tuk: 0.32 };

/** Two big glowing cartoon eyes that blink and look around nervously. */
export function GlowEyes({ kind, seed }: { kind: Traveller; seed: number }) {
  const lids = useRef<THREE.Group>(null);
  const pupils = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const white = useMemo(() => glow('#fffbe6'), []);
  const dark = useMemo(() => glow('#11132b'), []);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 0.77;
    if (born.current == null) born.current = clock.elapsedTime;
    const age = clock.elapsedTime - born.current;
    // Pop open, then blink every so often (sometimes a double blink).
    const ph = (t * 0.8) % 2.2;
    const blink = ph > 2.05 || (seed % 2 === 0 && ph > 1.75 && ph < 1.85) ? 0.08 : 1;
    if (lids.current) lids.current.scale.y = Math.min(1, age * 5) * blink;
    // Pupils dart left, right, up: quick snaps with pauses, like someone peering into the dark.
    const look = Math.floor(t * 1.6 + seed);
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, 0.6], [1, -0.4], [-1, 0.5], [0, 0]];
    const [dx, dy] = dirs[look % dirs.length];
    if (pupils.current) {
      pupils.current.position.x = THREE.MathUtils.lerp(pupils.current.position.x, dx * 0.022, 0.35);
      pupils.current.position.y = THREE.MathUtils.lerp(pupils.current.position.y, dy * 0.022, 0.35);
    }
    if (root.current) root.current.position.x = Math.sin(t * 38) * 0.006; // teeth-chattering shiver
  });
  const s = kind === 'tuk' ? 1.3 : 1.6;
  return (
    <Billboard position={[0, EYE_Y[kind], kind === 'tuk' ? 0.3 : 0.1]}>
      <group ref={root} scale={s}>
        <group ref={lids}>
          {[0.065, -0.065].map((x) => (
            <mesh key={x} position={[x, 0, 0]} scale={[0.055, 0.075, 0.01]} renderOrder={ON_TOP} material={white}>
              <sphereGeometry args={[1, 14, 10]} />
            </mesh>
          ))}
          <group ref={pupils} position-z={0.02}>
            {[0.065, -0.065].map((x) => (
              <mesh key={x} position={[x, 0, 0]} scale={[0.024, 0.03, 0.01]} renderOrder={ON_TOP + 1} material={dark}>
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </Billboard>
  );
}

/** A handful of fireflies that spiral in from the dark and circle the stranded walkers. */
export function Fireflies({ count = 9 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => glow('#e8ff7a'), []);
  const halo = useMemo(() => {
    const m = glow('#d4ff4a');
    m.opacity = 0.25;
    return m;
  }, []);
  const flies = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        a: (i / count) * Math.PI * 2,
        r: 0.55 + (i % 3) * 0.22,
        sp: 0.9 + (i % 4) * 0.25,
        y: -0.55 + (i % 5) * 0.16,
        delay: 0.3 + i * 0.12,
      })),
    [count],
  );
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (born.current == null) born.current = clock.elapsedTime;
    const age = clock.elapsedTime - born.current;
    const t = clock.elapsedTime;
    g.children.forEach((c, i) => {
      const f = flies[i];
      const k = Math.min(1, Math.max(0, (age - f.delay) / 1.4));
      const ease = 1 - Math.pow(1 - k, 3);
      const r = THREE.MathUtils.lerp(4.5, f.r, ease);
      const a = f.a + t * f.sp;
      c.position.set(Math.cos(a) * r, f.y + Math.sin(t * 3 + i) * 0.12 + (1 - ease) * 1.5, Math.sin(a) * r * 0.7);
      const pulse = 0.6 + 0.4 * Math.sin(t * 7 + i * 1.3);
      c.scale.setScalar(k > 0 ? pulse : 0.0001);
    });
  });
  return (
    <group ref={group}>
      {flies.map((_, i) => (
        <group key={i}>
          <mesh renderOrder={ON_TOP} material={mat}>
            <sphereGeometry args={[0.035, 6, 6]} />
          </mesh>
          <mesh renderOrder={ON_TOP} material={halo}>
            <sphereGeometry args={[0.12, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
