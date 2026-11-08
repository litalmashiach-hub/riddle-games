import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { groundHeight, toon, type CharacterProps, type Mood } from '@riddle/props';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Idle breathing, happy bouncing and scared trembling (same feel as the shared animals). */
function useMoodMotion(root: React.RefObject<THREE.Group | null>, mood: Mood, seed: number) {
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + seed * 1.7;
    g.position.y = 0;
    g.rotation.z = 0;
    g.scale.set(1, 1, 1);
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 6));
      g.position.y = b * 0.35;
      g.scale.set(1 + (1 - b) * 0.08, 1 - (1 - b) * 0.1, 1 + (1 - b) * 0.08);
    } else if (mood === 'scared') {
      g.rotation.z = Math.sin(t * 40) * 0.06;
      g.position.y = Math.abs(Math.sin(t * 9)) * 0.12;
    } else if (mood === 'angry') {
      g.scale.y = 1 + Math.sin(t * 12) * 0.04;
    } else {
      const breathe = Math.sin(t * 2.2) * 0.025;
      g.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    }
  });
}

const Eye = ({ x, y, z, r = 0.03 }: { x: number; y: number; z: number; r?: number }) => (
  <group position={[x, y, z]}>
    <mesh material={toon('#ffffff', { flat: false, rough: 0.3 })}>
      <sphereGeometry args={[r, 12, 12]} />
    </mesh>
    <mesh position={[0, 0, r * 0.6]} material={toon('#141414', { flat: false, rough: 0.2 })}>
      <sphereGeometry args={[r * 0.55, 10, 10]} />
    </mesh>
  </group>
);

/**
 * A spunky little goat with curled horns, a beard and a stubby tail.
 * `chewing` makes the jaw work (for the munch reaction and for idle cud chewing).
 */
export const Goat = forwardRef<THREE.Group, CharacterProps & { chewing?: boolean }>(function Goat(
  { mood = 'idle', seed = 0, scale = 1, chewing = false, children },
  ref,
) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const ears = useRef<THREE.Group[]>([]);
  useMoodMotion(root, mood, seed);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 2.3;
    if (head.current) {
      // A curious head tilt now and then, or a lunge forward while munching.
      head.current.rotation.z = mood === 'idle' ? Math.sin(t * 0.6) ** 9 * 0.35 : 0;
      head.current.rotation.x = chewing ? 0.35 + Math.sin(t * 14) * 0.08 : mood === 'scared' ? -0.25 : Math.sin(t * 0.9) * 0.05;
      head.current.rotation.y = chewing ? 0 : Math.sin(t * 0.7) * 0.2;
    }
    if (jaw.current) jaw.current.rotation.x = chewing ? Math.abs(Math.sin(t * 14)) * 0.5 : Math.max(0, Math.sin(t * 3)) * 0.12;
    if (tail.current) tail.current.rotation.x = -0.6 + Math.sin(t * (mood === 'happy' ? 22 : 6)) * 0.35;
    ears.current.forEach((e, i) => {
      if (e) e.rotation.x = Math.sin(t * 2 + i) ** 12 * 0.6;
    });
  });
  const coat = toon('#efe6d6');
  const patch = toon('#b07a4f');
  const dark = toon('#4a3a33');
  const horn = toon('#d9c8a3', { rough: 0.6 });
  const pink = toon('#f2a7a0');
  return (
    <group ref={ref} scale={scale}>
      <group ref={root}>
        {/* body */}
        <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} material={coat} castShadow>
          <capsuleGeometry args={[0.2, 0.36, 4, 8]} />
        </mesh>
        <mesh position={[0.06, 0.6, -0.12]} scale={[1, 0.6, 1.1]} material={patch} castShadow>
          <icosahedronGeometry args={[0.16, 1]} />
        </mesh>
        <group ref={tail} position={[0, 0.62, -0.36]}>
          <mesh position={[0, 0.06, 0]} material={coat}>
            <coneGeometry args={[0.05, 0.14, 5]} />
          </mesh>
        </group>
        {/* neck + head */}
        <mesh position={[0, 0.7, 0.26]} rotation-x={-0.5} material={coat} castShadow>
          <cylinderGeometry args={[0.09, 0.12, 0.26, 7]} />
        </mesh>
        <group ref={head} position={[0, 0.86, 0.36]}>
          <mesh scale={[0.9, 0.95, 1.15]} material={coat} castShadow>
            <icosahedronGeometry args={[0.15, 1]} />
          </mesh>
          {/* muzzle */}
          <mesh position={[0, -0.04, 0.14]} scale={[0.85, 0.75, 1]} material={coat} castShadow>
            <icosahedronGeometry args={[0.09, 1]} />
          </mesh>
          <mesh position={[0, -0.02, 0.225]} material={pink}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
          <group ref={jaw} position={[0, -0.08, 0.1]}>
            <mesh position={[0, -0.02, 0.06]} scale={[0.8, 0.4, 1]} material={coat}>
              <icosahedronGeometry args={[0.07, 1]} />
            </mesh>
            {/* beard */}
            <mesh position={[0, -0.09, 0.05]} rotation-x={Math.PI} material={patch} castShadow>
              <coneGeometry args={[0.035, 0.13, 5]} />
            </mesh>
          </group>
          {/* curled horns */}
          {[1, -1].map((s) => (
            <group key={s} position={[s * 0.07, 0.12, -0.04]} rotation={[-0.4, 0, -s * 0.35]}>
              <mesh position={[0, 0.06, -0.02]} rotation-x={-0.5} material={horn} castShadow>
                <coneGeometry args={[0.035, 0.16, 6]} />
              </mesh>
              <mesh position={[0, 0.11, -0.09]} rotation-x={-1.6} material={horn}>
                <coneGeometry args={[0.022, 0.1, 6]} />
              </mesh>
            </group>
          ))}
          {/* floppy ears */}
          {[1, -1].map((s, i) => (
            <group key={s} position={[s * 0.13, 0.04, -0.02]} rotation={[0, 0, -s * 1.2]} ref={(g) => void (ears.current[i] = g!)}>
              <mesh position={[0, 0.07, 0]} scale={[0.5, 1, 0.25]} material={patch}>
                <sphereGeometry args={[0.07, 8, 6]} />
              </mesh>
            </group>
          ))}
          <Eye x={0.075} y={0.04} z={0.1} r={mood === 'scared' ? 0.036 : 0.028} />
          <Eye x={-0.075} y={0.04} z={0.1} r={mood === 'scared' ? 0.036 : 0.028} />
        </group>
        {/* legs with dark hooves */}
        {[[0.1, 0.18], [-0.1, 0.18], [0.1, -0.18], [-0.1, -0.18]].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.2, 0]} material={coat} castShadow>
              <cylinderGeometry args={[0.042, 0.035, 0.3, 6]} />
            </mesh>
            <mesh position={[0, 0.035, 0]} material={dark}>
              <cylinderGeometry args={[0.04, 0.045, 0.07, 6]} />
            </mesh>
          </group>
        ))}
        {children}
      </group>
    </group>
  );
});

/** A plump cabbage with big worried eyes and rosy cheeks. */
export function Cabbage({ mood = 'idle', seed = 0, scale = 1 }: CharacterProps) {
  const root = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.Group>(null);
  useMoodMotion(root, mood === 'angry' ? 'idle' : mood, seed);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (leaves.current) {
      leaves.current.children.forEach((c, i) => {
        c.rotation.x = c.userData.tilt + Math.sin(t * 2 + i) * 0.04;
      });
    }
  });
  const outer = toon('#5fb84a');
  const inner = toon('#a6dd6c');
  const vein = toon('#d8f2a8');
  const ring = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        yaw: (i / 7) * Math.PI * 2 + 0.3,
        tilt: 0.55 + (i % 2) * 0.15,
      })),
    [],
  );
  return (
    <group scale={scale}>
      <group ref={root}>
        <mesh position={[0, 0.27, 0]} scale={[1, 0.9, 1]} material={inner} castShadow>
          <icosahedronGeometry args={[0.24, 1]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={vein}>
          <icosahedronGeometry args={[0.09, 0]} />
        </mesh>
        <group ref={leaves}>
          {ring.map((l, i) => (
            <group key={i} rotation-y={l.yaw} userData={{ tilt: l.tilt }}>
              <mesh position={[0, 0.22, 0.17]} rotation-x={0.4} scale={[1, 1.15, 0.35]} material={outer} castShadow>
                <icosahedronGeometry args={[0.17, 1]} />
              </mesh>
            </group>
          ))}
        </group>
        <Eye x={0.07} y={0.3} z={0.22} r={mood === 'scared' ? 0.045 : 0.035} />
        <Eye x={-0.07} y={0.3} z={0.22} r={mood === 'scared' ? 0.045 : 0.035} />
        {/* little blush */}
        <mesh position={[0.14, 0.24, 0.19]} scale={[1, 0.6, 0.4]} material={toon('#f59aa0')}>
          <sphereGeometry args={[0.03, 8, 6]} />
        </mesh>
        <mesh position={[-0.14, 0.24, 0.19]} scale={[1, 0.6, 0.4]} material={toon('#f59aa0')}>
          <sphereGeometry args={[0.03, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/** Leaf scraps flying out of a munched cabbage. Increase `trigger` to fire. */
export function LeafBurst({ trigger, position }: { trigger: number; position: [number, number, number] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const N = 40;
  const parts = useMemo(() => Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, life: 0 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const started = useRef(0);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    if (trigger !== started.current) {
      started.current = trigger;
      if (trigger) {
        parts.forEach((pt) => {
          pt.p.set(...position);
          const a = Math.random() * Math.PI * 2;
          const s = 0.8 + Math.random() * 1.6;
          pt.v.set(Math.cos(a) * s, 2 + Math.random() * 2.5, Math.sin(a) * s);
          pt.r = Math.random() * 6;
          pt.life = 1.4 + Math.random() * 0.8;
        });
      }
    }
    const floor = groundHeight(position[0], position[2]);
    parts.forEach((pt, i) => {
      if (pt.life > 0) {
        pt.life -= dt;
        pt.v.y -= 7 * dt;
        pt.v.multiplyScalar(1 - dt * 0.8);
        pt.p.addScaledVector(pt.v, dt);
        if (pt.p.y < floor + 0.02) {
          pt.p.y = floor + 0.02;
          pt.v.set(0, 0, 0);
        }
        pt.r += dt * 8;
      }
      const s = pt.life > 0 ? Math.min(1, pt.life * 2) * 0.07 : 0;
      dummy.position.copy(pt.p);
      dummy.rotation.set(pt.r, pt.r * 1.3, 0);
      dummy.scale.set(s, s * 0.3, s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} material={toon('#6cc24a')} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

/** A small red barn: the farm the trio is heading for. */
export function Barn(props: ThreeElements['group']) {
  const red = toon('#c8473d');
  const white = toon('#f4efe6');
  const roof = toon('#5b4a45');
  const lamp = useRef<THREE.PointLight>(null);
  const quality = useSettings((s) => s.quality);
  const gableGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1, 0);
    shape.lineTo(0, 0.7);
    shape.lineTo(1, 0);
    shape.lineTo(-1, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false });
    g.translate(0, 0, -0.85);
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.intensity = 2.2 + Math.sin(clock.elapsedTime * 7) * 0.25;
  });
  return (
    <group {...props}>
      <mesh position={[0, 0.65, 0]} material={red} castShadow receiveShadow>
        <boxGeometry args={[2, 1.3, 1.7]} />
      </mesh>
      <mesh position={[0, 1.3, 0]} geometry={gableGeo} material={red} castShadow />
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * 0.53, 1.7, 0]} rotation-z={-side * 0.61} material={roof} castShadow>
          <boxGeometry args={[1.38, 0.08, 1.95]} />
        </mesh>
      ))}
      {/* big doors with white X trim */}
      <group position={[0, 0.5, 0.86]}>
        <mesh material={white}>
          <boxGeometry args={[0.95, 1.0, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0.02]} material={toon('#a8362e')}>
          <boxGeometry args={[0.85, 0.9, 0.04]} />
        </mesh>
        {[0.75, -0.75].map((r) => (
          <mesh key={r} position={[0, 0, 0.05]} rotation-z={r} material={white}>
            <boxGeometry args={[1.15, 0.07, 0.03]} />
          </mesh>
        ))}
      </group>
      {/* hay loft window with a warm glow */}
      <mesh position={[0, 1.6, 0.87]} material={toon('#ffd27a', { emissive: '#ffb347', emissiveIntensity: 2.5 })}>
        <circleGeometry args={[0.2, 12]} />
      </mesh>
      {quality === 'high' && <pointLight ref={lamp} position={[0, 1.6, 1.3]} color="#ffb347" distance={3.5} intensity={2.2} />}
      {/* weathervane */}
      <mesh position={[0, 2.25, 0]} material={toon('#d4a73a', { metal: 0.6, rough: 0.4 })}>
        <coneGeometry args={[0.07, 0.3, 6]} />
      </mesh>
    </group>
  );
}

/** A round hay bale. */
export function HayBale(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <mesh position={[0, 0.32, 0]} rotation-z={Math.PI / 2} material={toon('#e8c35f', { rough: 1 })} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.5, 12]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.252, 0.32, 0]} rotation-z={Math.PI / 2} material={toon('#c9a144', { rough: 1 })}>
          <cylinderGeometry args={[0.24, 0.24, 0.01, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** A tilled garden bed with tiny sprouts and a wooden fence: where the cabbage grew. */
export function GardenBed({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const wood = toon('#9a6a3f');
  const soil = toon('#6b4a32', { rough: 1 });
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.02, 0]} scale={[1, 0.25, 1]} material={soil} receiveShadow>
        <cylinderGeometry args={[0.75, 0.85, 0.2, 10]} />
      </mesh>
      {[[-0.45, 0.35], [0.5, -0.3], [0.35, 0.45], [-0.5, -0.35]].map(([x, z], i) => (
        <group key={i} position={[x, 0.06, z]} rotation-y={i * 1.3}>
          <mesh position={[0.03, 0.05, 0]} rotation-z={-0.6} scale={[1, 0.4, 0.6]} material={toon('#7cc04b')}>
            <sphereGeometry args={[0.05, 6, 4]} />
          </mesh>
          <mesh position={[-0.03, 0.05, 0]} rotation-z={0.6} scale={[1, 0.4, 0.6]} material={toon('#7cc04b')}>
            <sphereGeometry args={[0.05, 6, 4]} />
          </mesh>
        </group>
      ))}
      {/* a short picket fence along the back */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = -0.9 + (i / 5) * 1.8;
        return (
          <mesh key={i} position={[Math.sin(a) * 1.0, 0.2, -Math.cos(a) * 1.0]} rotation-y={-a} material={wood} castShadow>
            <boxGeometry args={[0.07, 0.42, 0.05]} />
          </mesh>
        );
      })}
      {[0.12, 0.28].map((y) => (
        <mesh key={y} position={[0, y, -0.86]} material={wood} castShadow>
          <boxGeometry args={[1.6, 0.05, 0.03]} />
        </mesh>
      ))}
    </group>
  );
}

/** Butterflies fluttering in loops over a spot. */
export function Butterflies({ center, count = 3 }: { center: [number, number, number]; count?: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const colors = ['#ffd166', '#f78cc0', '#8ecdf7', '#ffffff'];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const k = t * (0.6 + i * 0.13) + i * 2.1;
      g.position.set(center[0] + Math.sin(k) * 1.4, center[1] + 0.9 + Math.sin(k * 2.3) * 0.3, center[2] + Math.cos(k * 1.3) * 1.1);
      g.rotation.y = -k + Math.PI / 2;
      const flap = Math.sin(t * 22 + i) * 0.9;
      (g.children[0] as THREE.Object3D).rotation.z = flap;
      (g.children[1] as THREE.Object3D).rotation.z = -flap;
    });
  });
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          {[1, -1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.06, 0, 0]} rotation-x={-Math.PI / 2} material={toon(colors[i % colors.length], { emissive: colors[i % colors.length], emissiveIntensity: 0.4, flat: false })}>
                <circleGeometry args={[0.06, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
