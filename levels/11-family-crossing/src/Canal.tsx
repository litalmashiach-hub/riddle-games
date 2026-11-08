import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Water, seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Gear, brass, copper, iron } from './Gear';

/** Canal half-width at the waterline. The quays start here. */
export const CANAL_HALF = 2.5;
/** Height of the quay tops, where people stand. */
export const QUAY_Y = 0.4;

const FAR_Z = -16;
const NEAR_Z = 12;

// ---------------------------------------------------------------------------
// Instanced helpers

type Inst = { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; c?: string };

/** Many boxes (or any geometry) in one draw call. */
function Instances({ items, geometry, material, cast = true }: { items: Inst[]; geometry: THREE.BufferGeometry; material: THREE.Material; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.scale.set(...it.s);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.c) m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow />;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);

// ---------------------------------------------------------------------------
// Quays

function Quays() {
  const cobbles = useMemo(() => {
    const rnd = seeded(31);
    const out: Inst[] = [];
    const tones = ['#9b8577', '#8c776b', '#a6907f', '#85706a', '#b09a86'];
    for (const side of [-1, 1]) {
      for (let x = CANAL_HALF + 0.55; x < 10.5; x += 0.5) {
        for (let z = -7.5; z < 7.5; z += 0.5) {
          const off = (Math.round((x - CANAL_HALF) / 0.5) % 2) * 0.25;
          out.push({
            p: [side * (x + (rnd() - 0.5) * 0.03), QUAY_Y - 0.02 + rnd() * 0.025, z + off],
            s: [0.46, 0.06, 0.46],
            r: [0, (rnd() - 0.5) * 0.12, 0],
            c: tones[Math.floor(rnd() * tones.length)],
          });
        }
      }
    }
    return out;
  }, []);

  const coping = useMemo(() => {
    const out: Inst[] = [];
    for (const side of [-1, 1]) {
      for (let z = FAR_Z; z < NEAR_Z; z += 0.9) {
        out.push({ p: [side * (CANAL_HALF + 0.17), QUAY_Y + 0.04, z + 0.45], s: [0.38, 0.12, 0.86], c: z % 1.8 === 0 ? '#c9b49a' : '#bba78e' });
      }
    }
    return out;
  }, []);

  // Brick courses on the canal walls.
  const bricks = useMemo(() => {
    const rnd = seeded(77);
    const out: Inst[] = [];
    const tones = ['#7a4b3d', '#6b4034', '#84533f', '#5e3a31'];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const y = -0.05 + row * 0.13;
        for (let z = FAR_Z; z < NEAR_Z; z += 0.42) {
          const zz = z + (row % 2) * 0.21;
          out.push({ p: [side * (CANAL_HALF + 0.005), y, zz], s: [0.04, 0.11, 0.39], c: tones[Math.floor(rnd() * tones.length)] });
        }
      }
    }
    return out;
  }, []);

  const bollards = useMemo(() => {
    const out: Inst[] = [];
    for (const side of [-1, 1]) for (const z of [-6.2, -4.4, 4.4, 6.4]) out.push({ p: [side * (CANAL_HALF + 0.35), QUAY_Y + 0.2, z], s: [0.1, 0.4, 0.1] });
    return out;
  }, []);

  const stone = toon('#6e5852');
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (CANAL_HALF + 6), -0.8, (FAR_Z + NEAR_Z) / 2]} material={stone} receiveShadow>
          <boxGeometry args={[12, 2.4, NEAR_Z - FAR_Z]} />
        </mesh>
      ))}
      <Instances items={cobbles} geometry={BOX} material={toon('#ffffff', { rough: 0.95 })} cast={false} />
      <Instances items={coping} geometry={BOX} material={toon('#ffffff', { rough: 0.9 })} />
      <Instances items={bricks} geometry={BOX} material={toon('#ffffff', { rough: 1 })} cast={false} />
      <Instances items={bollards} geometry={CYL} material={iron()} />
      {/* copper pipes along the canal walls */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (CANAL_HALF - 0.07), 0.12, (FAR_Z + NEAR_Z) / 2]} rotation-x={Math.PI / 2} material={copper()} castShadow>
            <cylinderGeometry args={[0.06, 0.06, NEAR_Z - FAR_Z, 8]} />
          </mesh>
          {[-11, -7, -3.6, 3.8, 7].map((z) => (
            <mesh key={z} position={[side * (CANAL_HALF - 0.07), 0.12, z]} rotation-x={Math.PI / 2} material={brass()}>
              <cylinderGeometry args={[0.085, 0.085, 0.08, 8]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Mooring docks where the raft lands */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (CANAL_HALF + 0.05), QUAY_Y - 0.02, 0.15]}>
          {[-0.6, -0.3, 0, 0.3, 0.6].map((z) => (
            <mesh key={z} position={[0, 0.02, z]} material={toon('#8a5a33')} castShadow receiveShadow>
              <boxGeometry args={[0.6, 0.06, 0.27]} />
            </mesh>
          ))}
          {[-0.85, 0.85].map((z) => (
            <mesh key={z} position={[-side * 0.15, 0.05, z]} material={brass()} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 0.5, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Buildings

interface Bld {
  p: [number, number, number];
  size: [number, number, number];
  color: string;
  roof: 'pyramid' | 'dome' | 'spire' | 'flat';
  roofColor?: string;
  chimney?: boolean;
}

const BUILDINGS: Bld[] = [
  { p: [-8.6, QUAY_Y, -0.6], size: [3.4, 4.2, 4.2], color: '#7d5a4f', roof: 'pyramid', roofColor: '#3f3a4a', chimney: true },
  { p: [-7.6, QUAY_Y, -6.4], size: [4.2, 6.6, 3.6], color: '#8a6450', roof: 'dome' },
  { p: [-4.6, QUAY_Y, -10.6], size: [3, 8.4, 3], color: '#6d4c48', roof: 'spire', roofColor: '#2f5d5a' },
  { p: [-9.6, QUAY_Y, -12.5], size: [5, 10, 4.4], color: '#5f4544', roof: 'flat', chimney: true },
  { p: [8.6, QUAY_Y, -1.4], size: [3.2, 5, 4], color: '#87604c', roof: 'dome', chimney: true },
  { p: [7.8, QUAY_Y, -7], size: [4.4, 7.4, 3.8], color: '#6f4f4a', roof: 'pyramid', roofColor: '#3a3446' },
  { p: [4.6, QUAY_Y, -11], size: [2.8, 6.2, 2.8], color: '#80594a', roof: 'spire', roofColor: '#7a3b2e', chimney: true },
  { p: [10, QUAY_Y, -13], size: [5, 11, 4.4], color: '#5a4246', roof: 'flat' },
];

function windowsFor(b: Bld, rnd: () => number): Inst[] {
  const out: Inst[] = [];
  const [w, h, d] = b.size;
  const [bx, by, bz] = b.p;
  const facing = bx < 0 ? 1 : -1; // the face that looks at the canal
  const rows = Math.floor((h - 1) / 1.25);
  // Front (+z) face.
  const cols = Math.max(1, Math.floor((w - 0.6) / 0.9));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rnd() < 0.18) continue;
      const x = bx - w / 2 + (w / (cols + 1)) * (c + 1);
      out.push({ p: [x, by + 1 + r * 1.25, bz + d / 2 + 0.01], s: [0.38, 0.58, 0.04], c: rnd() < 0.25 ? '#ffb347' : '#ffd88a' });
    }
  }
  // Canal-facing face.
  const cols2 = Math.max(1, Math.floor((d - 0.6) / 0.9));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols2; c++) {
      if (rnd() < 0.25) continue;
      const z = bz - d / 2 + (d / (cols2 + 1)) * (c + 1);
      out.push({ p: [bx + (facing * w) / 2 + facing * 0.01, by + 1 + r * 1.25, z], s: [0.04, 0.58, 0.38], c: rnd() < 0.25 ? '#ffb347' : '#ffd88a' });
    }
  }
  return out;
}

function Building({ b }: { b: Bld }) {
  const [w, h, d] = b.size;
  const roof = toon(b.roofColor ?? '#3f3a4a');
  return (
    <group position={b.p}>
      <mesh position-y={h / 2} material={toon(b.color, { rough: 0.95 })} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* cornice and base */}
      <mesh position-y={h} material={toon('#c9b49a')} castShadow>
        <boxGeometry args={[w + 0.2, 0.18, d + 0.2]} />
      </mesh>
      <mesh position-y={0.25} material={toon('#4b3a3a')}>
        <boxGeometry args={[w + 0.08, 0.5, d + 0.08]} />
      </mesh>
      {b.roof === 'pyramid' && (
        <mesh position-y={h + 0.9} rotation-y={Math.PI / 4} scale={[w * 0.72, 1, d * 0.72]} material={roof} castShadow>
          <coneGeometry args={[1, 1.8, 4]} />
        </mesh>
      )}
      {b.roof === 'dome' && (
        <group position-y={h + 0.09}>
          <mesh scale={[w * 0.42, w * 0.38, d * 0.42]} material={toon('#c8913a', { metal: 0.8, rough: 0.35 })} castShadow>
            <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position-y={w * 0.38 + 0.25} material={brass()}>
            <coneGeometry args={[0.08, 0.6, 6]} />
          </mesh>
        </group>
      )}
      {b.roof === 'spire' && (
        <mesh position-y={h + 1.6} material={roof} castShadow>
          <coneGeometry args={[Math.min(w, d) * 0.62, 3.2, 8]} />
        </mesh>
      )}
      {b.chimney && (
        <mesh position={[w * 0.25, h + 0.7, -d * 0.2]} material={toon('#5a3b33')} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 1.4, 8]} />
        </mesh>
      )}
    </group>
  );
}

function chimneyTop(b: Bld): [number, number, number] {
  return [b.p[0] + b.size[0] * 0.25, b.p[1] + b.size[1] + 1.45, b.p[2] - b.size[2] * 0.2];
}

// ---------------------------------------------------------------------------
// Steam

/** Puffs of steam rising and fading from a point. One draw call. */
export function Steam({ position, count = 8, rate = 1, spread = 0.15, size = 0.35, rise = 1.6 }: { position: [number, number, number]; count?: number; rate?: number; spread?: number; size?: number; rise?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ off: i / count, dx: Math.sin(i * 12.9898) * spread, dz: Math.cos(i * 78.233) * spread })), [count, spread]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime * rate * 0.45;
    seeds.forEach((s, i) => {
      const life = (t + s.off) % 1;
      o.position.set(s.dx * (1 + life * 3), life * rise, s.dz * (1 + life * 3) + life * 0.3);
      const k = Math.sin(Math.PI * Math.min(1, life * 1.25)) * size * (0.5 + life);
      o.scale.setScalar(Math.max(0.0001, k));
      o.rotation.set(life * 2, i, life);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={position}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#efe7e2" transparent opacity={0.55} roughness={1} flatShading depthWrite={false} emissive="#6b5a55" emissiveIntensity={0.4} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lamps

export function Lamp({ position, light }: { position: [number, number, number]; light: boolean }) {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const bulb = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 1 + Math.sin(t * 9 + position[2]) * 0.04 + Math.sin(t * 23 + position[0]) * 0.03;
    if (glass.current) glass.current.emissiveIntensity = 3 * f;
    if (bulb.current) bulb.current.intensity = 9 * f;
  });
  return (
    <group position={position}>
      <mesh position-y={0.08} material={iron()} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.16, 8]} />
      </mesh>
      <mesh position-y={1.05} material={iron()} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 2, 8]} />
      </mesh>
      <mesh position-y={2.12} material={brass()} castShadow>
        <cylinderGeometry args={[0.1, 0.17, 0.1, 6]} />
      </mesh>
      <mesh position-y={2.32}>
        <cylinderGeometry args={[0.15, 0.11, 0.32, 6]} />
        <meshStandardMaterial ref={glass} color="#ffd38a" emissive="#ffb347" emissiveIntensity={3} roughness={0.4} flatShading toneMapped={false} />
      </mesh>
      <mesh position-y={2.55} material={iron()} castShadow>
        <coneGeometry args={[0.22, 0.2, 6]} />
      </mesh>
      {light && <pointLight ref={bulb} position-y={2.3} color="#ffb766" intensity={9} distance={7} decay={1.6} />}
    </group>
  );
}

/** A soft warm streak on the water under a lamp (fake reflection). */
let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,200,120,1)');
  grad.addColorStop(0.35, 'rgba(255,170,80,0.45)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function WaterGlow({ position, scale = [0.9, 2.6] }: { position: [number, number, number]; scale?: [number, number] }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.opacity = 0.55 + Math.sin(clock.elapsedTime * 2.3 + position[2]) * 0.12;
  });
  return (
    <mesh position={position} rotation-x={-Math.PI / 2} scale={[scale[0], scale[1], 1]} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={ref} map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Clock tower, bridge and big gear wall in the back

function ClockTower() {
  const minute = useRef<THREE.Group>(null);
  const hour = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (minute.current) minute.current.rotation.z = -t * ((Math.PI * 2) / 60);
    if (hour.current) hour.current.rotation.z = -1.2 - t * ((Math.PI * 2) / 720);
  });
  const ticks = useMemo<Inst[]>(
    () => Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { p: [Math.sin(a) * 1.15, Math.cos(a) * 1.15, 0.05], s: [0.07, i % 3 === 0 ? 0.28 : 0.16, 0.04], r: [0, 0, -a] };
    }),
    [],
  );
  return (
    <group position={[0, QUAY_Y, FAR_Z + 0.8]}>
      {/* arch over the canal */}
      <mesh position={[0, 4.2, 0]} material={toon('#6a4a45', { rough: 0.95 })} castShadow receiveShadow>
        <boxGeometry args={[7.4, 8.4, 2.6]} />
      </mesh>
      <mesh position={[0, -0.2, 1.31]} material={toon('#1c1418')}>
        <circleGeometry args={[CANAL_HALF - 0.1, 24, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 8.4 + 2.4, 0]} material={toon('#73524b', { rough: 0.95 })} castShadow>
        <boxGeometry args={[3.6, 4.8, 3]} />
      </mesh>
      <mesh position={[0, 13.2 + 1.5, 0]} rotation-y={Math.PI / 4} material={toon('#2f5d5a')} castShadow>
        <coneGeometry args={[2.7, 3, 4]} />
      </mesh>
      <mesh position={[0, 16.4, 0]} material={brass()}>
        <coneGeometry args={[0.1, 1.2, 6]} />
      </mesh>
      {/* the clock */}
      <group position={[0, 10.8, 1.52]}>
        <mesh material={brass()} castShadow>
          <torusGeometry args={[1.38, 0.12, 8, 40]} />
        </mesh>
        <mesh position-z={-0.02}>
          <circleGeometry args={[1.35, 40]} />
          <meshStandardMaterial color="#fff2cf" emissive="#ffd88a" emissiveIntensity={1.6} roughness={0.6} toneMapped={false} />
        </mesh>
        <Instances items={ticks} geometry={BOX} material={toon('#2b2226')} cast={false} />
        <group ref={hour} position-z={0.1}>
          <mesh position-y={0.35} material={toon('#2b2226')}>
            <boxGeometry args={[0.1, 0.75, 0.04]} />
          </mesh>
        </group>
        <group ref={minute} position-z={0.13}>
          <mesh position-y={0.52} material={toon('#2b2226')}>
            <boxGeometry args={[0.06, 1.05, 0.04]} />
          </mesh>
        </group>
        <mesh position-z={0.16} material={brass()}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </group>
      {/* gears around the tower */}
      <Gear position={[-2.75, 6.3, 1.45]} radius={1.6} teeth={16} speed={0.04} />
      <Gear position={[-0.72, 6.0, 1.42]} radius={0.85} teeth={9} speed={-0.0711} phase={0.17} color="copper" holes={4} />
      <Gear position={[2.95, 5.6, 1.45]} radius={1.25} teeth={13} speed={-0.05} color="copper" />
      <Gear position={[2.05, 7.6, 1.6]} radius={0.62} teeth={7} speed={0.093} holes={3} />
      {/* lit windows on the arch */}
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 2.4, 1.31]}>
          <planeGeometry args={[0.5, 0.9]} />
          <meshStandardMaterial color="#ffd88a" emissive="#ffb347" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Bridge() {
  const stone = toon('#7d5f55', { rough: 0.95 });
  const rail = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (let x = -3.3; x <= 3.3; x += 0.55) for (const z of [-0.62, 0.62]) out.push({ p: [x, 0.55, z], s: [0.07, 0.5, 0.07] });
    return out;
  }, []);
  return (
    <group position={[0, QUAY_Y + 1.3, -8.4]}>
      <mesh material={stone} castShadow receiveShadow>
        <boxGeometry args={[7, 0.35, 1.4]} />
      </mesh>
      {/* arch underside */}
      <mesh position-y={-0.15} rotation-z={0} scale={[1, 0.62, 1]} material={stone} castShadow>
        <torusGeometry args={[CANAL_HALF, 0.22, 6, 24, Math.PI]} />
      </mesh>
      <Instances items={rail} geometry={CYL} material={iron()} />
      {[-0.62, 0.62].map((z) => (
        <mesh key={z} position={[0, 0.82, z]} rotation-z={Math.PI / 2} material={brass()} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 7, 6]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Foreground clutter: crates, barrels, a pile of spare cogs

function Clutter() {
  const wood = toon('#8a5a33');
  const dark = toon('#5a3a22');
  return (
    <group>
      <group position={[-6.9, QUAY_Y, 2.2]} rotation-y={0.3}>
        <mesh position-y={0.35} material={wood} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
        </mesh>
        <mesh position={[0.15, 0.95, 0.05]} rotation-y={0.5} material={dark} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
        <mesh position={[0.9, 0.38, -0.2]} material={toon('#6d4223')} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.76, 10]} />
        </mesh>
        <mesh position={[0.9, 0.6, -0.2]} material={brass()}>
          <torusGeometry args={[0.31, 0.025, 4, 16]} />
        </mesh>
      </group>
      <group position={[6.9, QUAY_Y, 2.6]}>
        <Gear position={[0, 0.1, 0]} rotation-x={-Math.PI / 2} radius={0.55} teeth={8} speed={0} />
        <Gear position={[0.15, 0.24, 0.05]} rotation={[-Math.PI / 2, 0, 0.3]} radius={0.38} teeth={7} speed={0} color="copper" holes={3} />
        <Gear position={[-0.6, 0.38, -0.3]} rotation={[-1.1, 0.2, 0]} radius={0.42} teeth={7} speed={0} color="iron" holes={3} />
        <mesh position={[0.8, 0.3, -0.5]} material={toon('#6d4223')} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.6, 10]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------

/**
 * The Clockwork Citadel canal: brick quays, a lit town, a clock tower with turning cogs,
 * a bridge, lamps and steam. The canal runs along z between x = -CANAL_HALF and +CANAL_HALF.
 * Keep the play area (|z| < 2.6, CANAL_HALF < |x| < 5.5) clear.
 */
export function Canal() {
  const quality = useSettings((s) => s.quality);
  const high = quality === 'high';
  const windows = useMemo(() => {
    const rnd = seeded(19);
    return BUILDINGS.flatMap((b) => windowsFor(b, rnd));
  }, []);
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffbf66', emissiveIntensity: 2.2, toneMapped: false }), []);
  const chimneys = BUILDINGS.filter((b) => b.chimney).map(chimneyTop);
  return (
    <group>
      <Quays />
      <Water width={CANAL_HALF * 2 + 0.1} length={NEAR_Z - FAR_Z} position={[0, 0, (FAR_Z + NEAR_Z) / 2]} shallow="#1f6470" deep="#0a2236" foam="#8fc2bd" flow={0.12} waveHeight={0.035} />
      {BUILDINGS.map((b, i) => (
        <Building key={i} b={b} />
      ))}
      <Instances items={windows} geometry={BOX} material={winMat} cast={false} />
      <ClockTower />
      <Bridge />
      <Clutter />
      {/* Gears turning on the side walls, facing the canal */}
      <Gear position={[-6.85, QUAY_Y + 3.6, -5.2]} rotation-y={Math.PI / 2} radius={1.1} teeth={12} speed={0.06} />
      <Gear position={[-6.85, QUAY_Y + 2.15, -3.75]} rotation-y={Math.PI / 2} radius={0.62} teeth={7} speed={-0.103} phase={0.2} color="copper" holes={3} />
      <Gear position={[6.9, QUAY_Y + 4.2, -1.8]} rotation-y={-Math.PI / 2} radius={0.95} teeth={11} speed={-0.07} />
      {/* lamps */}
      <Lamp position={[-(CANAL_HALF + 0.45), QUAY_Y, -2.7]} light={high} />
      <Lamp position={[CANAL_HALF + 0.45, QUAY_Y, -2.7]} light={high} />
      <Lamp position={[-5.4, QUAY_Y, 3.6]} light />
      <Lamp position={[5.4, QUAY_Y, 3.6]} light />
      {[-2.7].map((z) =>
        [-1, 1].map((sd) => <WaterGlow key={`${z}${sd}`} position={[sd * (CANAL_HALF - 0.55), 0.06, z + 0.4]} />),
      )}
      <WaterGlow position={[0, 0.06, FAR_Z + 3.2]} scale={[1.8, 4]} />
      {/* steam */}
      {chimneys.map((p, i) => (
        <Steam key={i} position={p} count={high ? 10 : 5} rate={0.8 + i * 0.15} size={0.45} rise={2.4} />
      ))}
      <Steam position={[-6.1, QUAY_Y, -3.2]} count={high ? 8 : 4} rate={1.3} spread={0.2} size={0.28} rise={1.4} />
      <Steam position={[6.2, QUAY_Y, 1.2]} count={high ? 8 : 4} rate={1.1} spread={0.2} size={0.28} rise={1.4} />
      <mesh position={[-6.1, QUAY_Y + 0.03, -3.2]} material={iron()}>
        <boxGeometry args={[0.6, 0.06, 0.6]} />
      </mesh>
      <mesh position={[6.2, QUAY_Y + 0.03, 1.2]} material={iron()}>
        <boxGeometry args={[0.6, 0.06, 0.6]} />
      </mesh>
      {/* floating ember sparks and some glints above the water */}
      <Sparkles count={high ? 60 : 24} scale={[16, 4, 12]} position={[0, 2.2, -2]} size={3} speed={0.25} opacity={0.9} color="#ffc070" />
    </group>
  );
}
