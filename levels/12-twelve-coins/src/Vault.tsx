import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gearGeometry } from './art';

const WALL_R = 6.6;
export const DOOR_POS: [number, number, number] = [0, 2.75, -6.35];
const DOOR_R = 2.05;

const brass = () => toon('#d9a441', { metal: 0.85, rough: 0.32, flat: false });
const brassDark = () => toon('#8f6220', { metal: 0.8, rough: 0.42, flat: false });
const steel = () => toon('#5d5560', { metal: 0.6, rough: 0.45 });

/** Builds a flat-shaded geometry where every face gets its own colour (tiles, stone blocks). */
function tinted(geo: THREE.BufferGeometry, pick: (cx: number, cy: number, cz: number, face: number) => THREE.Color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count / 3; f++) {
    // Quads are two triangles: colour by pair so blocks look whole.
    const i = f * 3;
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const c = pick(cx, cy, cz, Math.floor(f / 2));
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function Floor() {
  const tiles = useMemo(() => {
    const rnd = seeded(12);
    const a = new THREE.Color('#4b3d4b');
    const b = new THREE.Color('#3a2f3c');
    const gold = new THREE.Color('#8b6a35');
    const g = new THREE.RingGeometry(1.7, 9, 32, 7);
    g.rotateX(-Math.PI / 2);
    return tinted(g, (cx, _cy, cz, face) => {
      const r = Math.hypot(cx, cz);
      const ring = Math.floor((r - 1.7) / ((9 - 1.7) / 7));
      const ang = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 32);
      const c = ((ring + ang) % 2 ? a : b).clone().multiplyScalar(0.85 + rnd() * 0.3);
      if (ring === 1 && ang % 4 === 0) c.lerp(gold, 0.6);
      void face;
      return c;
    });
  }, []);
  return (
    <group>
      <mesh geometry={tiles} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.75} metalness={0.05} flatShading />
      </mesh>
      {/* brass medallion under the balance */}
      <mesh position={[0, 0.005, -0.7]} rotation-x={-Math.PI / 2} material={toon('#a4782f', { metal: 0.7, rough: 0.45, flat: false })} receiveShadow>
        <circleGeometry args={[1.7, 40]} />
      </mesh>
      <mesh position={[0, 0.012, -0.7]} rotation-x={-Math.PI / 2} material={toon('#2d2430', { rough: 0.8 })} receiveShadow>
        <ringGeometry args={[1.35, 1.5, 40]} />
      </mesh>
      {[2.6, 5.4].map((r) => (
        <mesh key={r} position-y={0.01} rotation-x={-Math.PI / 2} material={brassDark()} receiveShadow>
          <ringGeometry args={[r - 0.05, r + 0.05, 64]} />
        </mesh>
      ))}
      {/* the whole hall sits on a dark plinth so the edge is not visible */}
      <mesh position-y={-0.26} material={toon('#241b25')} receiveShadow>
        <cylinderGeometry args={[9.2, 9.6, 0.5, 32]} />
      </mesh>
    </group>
  );
}

function Wall() {
  const geo = useMemo(() => {
    const rnd = seeded(5);
    const base = new THREE.Color('#5a4552');
    const g = new THREE.CylinderGeometry(WALL_R, WALL_R, 6.4, 28, 8, true, Math.PI * 0.62, Math.PI * 0.76);
    g.translate(0, 3.2, 0);
    return tinted(g, () => base.clone().multiplyScalar(0.7 + rnd() * 0.35));
  }, []);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.9} flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Pillars around the wall, instanced: shaft, base, capital, brass band. */
function Pillars() {
  const angles = useMemo(() => [-0.95, -0.62, -0.3, 0.3, 0.62, 0.95].map((a) => a * 1.18), []);
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const ys = [2.9, 0.25, 5.75, 1.3];
    refs.forEach((r, k) => {
      const m = r.current;
      if (!m) return;
      angles.forEach((a, i) => {
        o.position.set(Math.sin(a) * (WALL_R - 0.35), ys[k], -Math.cos(a) * (WALL_R - 0.35));
        o.rotation.set(0, -a, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angles]);
  const n = angles.length;
  return (
    <group>
      <instancedMesh ref={refs[0]} args={[undefined, undefined, n]} material={toon('#6b5560', { rough: 0.85 })} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.42, 5.2, 10]} />
      </instancedMesh>
      <instancedMesh ref={refs[1]} args={[undefined, undefined, n]} material={toon('#3f3240')} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.5, 1.05]} />
      </instancedMesh>
      <instancedMesh ref={refs[2]} args={[undefined, undefined, n]} material={brassDark()} castShadow>
        <boxGeometry args={[1.0, 0.45, 1.0]} />
      </instancedMesh>
      <instancedMesh ref={refs[3]} args={[undefined, undefined, n]} material={brass()} castShadow>
        <cylinderGeometry args={[0.46, 0.46, 0.16, 12]} />
      </instancedMesh>
    </group>
  );
}

function Gears() {
  const defs = useMemo(
    () => [
      { p: [-3.75, 3.9, -5.35] as const, r: 1.15, t: 16, speed: 0.25 },
      { p: [-2.56, 5.0, -5.5] as const, r: 0.62, t: 9, speed: -0.25 * (1.15 / 0.62) },
      { p: [3.9, 3.6, -5.3] as const, r: 1.3, t: 18, speed: -0.2 },
      { p: [4.15, 5.35, -5.0] as const, r: 0.55, t: 8, speed: 0.2 * (1.3 / 0.55) },
      { p: [-4.6, 1.75, -4.4] as const, r: 0.7, t: 10, speed: 0.4 },
    ],
    [],
  );
  const geos = useMemo(() => defs.map((d) => gearGeometry(d.r, d.t, 0.16)), [defs]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    defs.forEach((d, i) => {
      const m = refs.current[i];
      if (m) m.rotation.z += d.speed * Math.min(dt, 0.05);
    });
  });
  return (
    <group>
      {defs.map((d, i) => (
        <group key={i} position={d.p as unknown as [number, number, number]} rotation-y={Math.atan2(-d.p[0], -d.p[2])}>
          <mesh ref={(m) => void (refs.current[i] = m)} geometry={geos[i]} material={i % 2 ? brass() : brassDark()} castShadow />
          <mesh rotation-x={Math.PI / 2} material={steel()}>
            <cylinderGeometry args={[d.r * 0.2, d.r * 0.2, 0.3, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The great round vault door. `open` goes 0..1 and swings it on its hinge. */
export function VaultDoor({ openRef }: { openRef: React.MutableRefObject<number> }) {
  const hinge = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const bolts = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = bolts.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      o.position.set(DOOR_R + Math.cos(a) * (DOOR_R - 0.22), Math.sin(a) * (DOOR_R - 0.22), 0.2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame((_, dt) => {
    const t = openRef.current;
    // Wheel spins first, then the door swings.
    if (wheel.current) wheel.current.rotation.z = -Math.min(t / 0.35, 1) * Math.PI * 2.5;
    const swing = THREE.MathUtils.smoothstep(t, 0.3, 1);
    if (hinge.current) hinge.current.rotation.y = -swing * 1.75;
    if (glow.current) glow.current.emissiveIntensity = 0.4 + swing * 3.2;
    if (light.current) light.current.intensity = swing * 18;
    void dt;
  });
  return (
    <group position={DOOR_POS}>
      {/* frame */}
      <mesh rotation-x={Math.PI / 2} position-z={0.05} material={brassDark()} castShadow receiveShadow>
        <cylinderGeometry args={[DOOR_R + 0.45, DOOR_R + 0.45, 0.3, 40, 1, true]} />
      </mesh>
      <mesh position-z={0.2} material={brass()} castShadow>
        <torusGeometry args={[DOOR_R + 0.32, 0.14, 10, 48]} />
      </mesh>
      <mesh position-z={0.12} material={toon('#3b2f3a')}>
        <ringGeometry args={[DOOR_R + 0.02, DOOR_R + 0.45, 48]} />
      </mesh>
      {/* treasure glow behind the door */}
      <mesh position-z={-0.2}>
        <circleGeometry args={[DOOR_R, 40]} />
        <meshStandardMaterial ref={glow} color="#ffcf6b" emissive="#ffb52e" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0, 1.2]} color="#ffbe55" intensity={0} distance={12} decay={1.6} />
      {/* the door itself, hinged on the left edge */}
      <group position-x={-DOOR_R}>
        <group ref={hinge}>
          <mesh position={[DOOR_R, 0, 0]} rotation-x={Math.PI / 2} material={toon('#6e6170', { metal: 0.65, rough: 0.38, flat: false })} castShadow receiveShadow>
            <cylinderGeometry args={[DOOR_R, DOOR_R, 0.3, 40]} />
          </mesh>
          {[1.55, 1.05].map((r) => (
            <mesh key={r} position={[DOOR_R, 0, 0.16]} material={brass()} castShadow>
              <torusGeometry args={[r, 0.06, 8, 40]} />
            </mesh>
          ))}
          <instancedMesh ref={bolts} args={[undefined, undefined, 16]} material={brass()} castShadow>
            <sphereGeometry args={[0.09, 10, 8]} />
          </instancedMesh>
          <group ref={wheel} position={[DOOR_R, 0, 0.3]}>
            <mesh material={brass()} castShadow>
              <torusGeometry args={[0.72, 0.07, 10, 32]} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation-z={(i / 3) * Math.PI} material={brassDark()} castShadow>
                <boxGeometry args={[1.5, 0.09, 0.09]} />
              </mesh>
            ))}
            <mesh rotation-x={Math.PI / 2} material={brass()}>
              <cylinderGeometry args={[0.2, 0.2, 0.18, 16]} />
            </mesh>
            <mesh position-z={0.1} material={toon('#ff9a3c', { emissive: '#ff7a1a', emissiveIntensity: 3, flat: false })}>
              <sphereGeometry args={[0.1, 14, 14]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** A lamp post with a glowing globe. */
function Lamp({ position, high }: { position: [number, number, number]; high: boolean }) {
  const flick = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (flick.current) flick.current.intensity = 5 + Math.sin(clock.elapsedTime * 7 + position[0]) * 0.4 + Math.sin(clock.elapsedTime * 13) * 0.3;
  });
  return (
    <group position={position}>
      <mesh position-y={0.15} material={toon('#3a2e38')} castShadow>
        <cylinderGeometry args={[0.32, 0.4, 0.3, 8]} />
      </mesh>
      <mesh position-y={1.3} material={brassDark()} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 2.2, 8]} />
      </mesh>
      <mesh position-y={2.55} material={toon('#ffe2a1', { emissive: '#ffb347', emissiveIntensity: 3.2, flat: false })}>
        <sphereGeometry args={[0.26, 16, 16]} />
      </mesh>
      <mesh position-y={2.55} material={brass()}>
        <torusGeometry args={[0.27, 0.025, 6, 20]} />
      </mesh>
      <mesh position-y={2.55} rotation-y={Math.PI / 2} material={brass()}>
        <torusGeometry args={[0.27, 0.025, 6, 20]} />
      </mesh>
      <mesh position-y={2.88} material={brassDark()} castShadow>
        <coneGeometry args={[0.2, 0.25, 8]} />
      </mesh>
      {high && <pointLight ref={flick} position-y={2.55} color="#ffb04a" intensity={5} distance={7} decay={1.8} />}
    </group>
  );
}

/** Puffs of steam from a pipe. `blast` makes a big burst. */
function Steam({ position, dir, count, blastRef }: { position: [number, number, number]; dir: [number, number, number]; count: number; blastRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const rnd = seeded(position[0] * 10 + 3);
    return Array.from({ length: count }, (_, i) => ({ off: i / count, sx: rnd() - 0.5, sz: rnd() - 0.5 }));
  }, [count, position]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const blast = blastRef.current;
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      const life = (t * (0.35 + blast * 0.9) + s.off) % 1;
      const reach = 0.9 + blast * 2.2;
      o.position.set(
        position[0] + dir[0] * life * reach + s.sx * life * 0.6,
        position[1] + dir[1] * life * reach + life * life * 0.8,
        position[2] + dir[2] * life * reach + s.sz * life * 0.6,
      );
      o.scale.setScalar(Math.sin(Math.PI * life) * (0.22 + life * 0.3) * (1 + blast * 1.6));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 3]} />
      <meshStandardMaterial color="#fff8f2" emissive="#ffe2c4" emissiveIntensity={0.25} transparent opacity={0.2} depthWrite={false} roughness={1} />
    </instancedMesh>
  );
}

function Pipes({ high, blastRef }: { high: boolean; blastRef: React.MutableRefObject<number> }) {
  const copper = toon('#b8653a', { metal: 0.7, rough: 0.4, flat: false });
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 5.35, 2.2, -2.9]} material={copper} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 4.4, 10]} />
          </mesh>
          <mesh position={[s * 5.35, 0.85, -2.9]} rotation-x={Math.PI / 2} material={brassDark()}>
            <torusGeometry args={[0.25, 0.05, 6, 16]} />
          </mesh>
          <mesh position={[s * 5.35, 0.85, -2.9]} rotation-x={Math.PI / 2} material={copper}>
            <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
          </mesh>
          <mesh position={[s * 5.1, 1.6, -2.9]} rotation-z={Math.PI / 2} material={copper} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.5, 8]} />
          </mesh>
          <mesh position={[s * 4.82, 1.6, -2.9]} rotation-z={Math.PI / 2} material={brass()}>
            <cylinderGeometry args={[0.15, 0.1, 0.12, 10]} />
          </mesh>
          <Steam position={[s * 4.75, 1.6, -2.9]} dir={[-s * 0.6, 0.5, 0.3]} count={high ? 14 : 6} blastRef={blastRef} />
        </group>
      ))}
    </group>
  );
}

/** The velvet table the coins sit on. */
export const TABLE_Y = 0.82;
export const TABLE_Z = 1.5;
export function CoinTable() {
  const wood = toon('#5a3420', { rough: 0.7 });
  return (
    <group position={[0, 0, TABLE_Z]}>
      <mesh position-y={TABLE_Y - 0.09} material={wood} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.14, 1.75]} />
      </mesh>
      <mesh position-y={TABLE_Y - 0.02} material={toon('#7d1631', { rough: 1 })} receiveShadow>
        <boxGeometry args={[5.2, 0.04, 1.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, TABLE_Y - 0.03, s * 0.84]} material={brass()} castShadow>
          <boxGeometry args={[5.5, 0.05, 0.05]} />
        </mesh>
      ))}
      {[
        [-2.5, -0.7],
        [2.5, -0.7],
        [-2.5, 0.7],
        [2.5, 0.7],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (TABLE_Y - 0.16) / 2, z]} material={wood} castShadow>
          <cylinderGeometry args={[0.09, 0.06, TABLE_Y - 0.16, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export function Vault({ high, doorOpen, blast }: { high: boolean; doorOpen: React.MutableRefObject<number>; blast: React.MutableRefObject<number> }) {
  return (
    <group>
      <Floor />
      <Wall />
      <Pillars />
      <Gears />
      <VaultDoor openRef={doorOpen} />
      <Pipes high={high} blastRef={blast} />
      <Lamp position={[-3.7, 0, 1.0]} high={high} />
      <Lamp position={[3.7, 0, 1.0]} high={high} />
      <CoinTable />
      <Sparkles count={high ? 70 : 20} scale={[10, 5, 6]} position={[0, 2.8, -1.5]} size={2.2} speed={0.25} color="#ffd27a" opacity={0.7} />
    </group>
  );
}
