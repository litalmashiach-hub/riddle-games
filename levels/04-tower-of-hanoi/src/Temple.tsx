import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** The sunset temple courtyard around the three pillars. Pure scenery: no game logic here. */

const SAND_Y = -0.9;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Height of the desert floor around the courtyard (dunes rise away from it). */
export function sandHeight(x: number, z: number) {
  const r = Math.hypot(x * 0.8, z);
  return SAND_Y + (vnoise(x * 0.18, z * 0.18) - 0.3) * 2.4 * smooth(9, 26, r) + smooth(20, 45, r) * 3;
}

const STONE = '#dcaa6e';
const STONE_DARK = '#b8834f';
const STONE_DEEP = '#9a6a40';

export function Temple() {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <Sand />
      <Dais />
      <Ruins />
      <Pyramid />
      <Crystals />
      {[-5.6, 5.6].map((x) => (
        <Brazier key={x} position={[x, 0, 2.2]} light={high} seed={x} />
      ))}
      {PALMS.slice(0, high ? PALMS.length : 3).map((p, i) => (
        <Palm key={i} position={[p[0], sandHeight(p[0], p[1]), p[1]]} scale={p[2]} seed={i} />
      ))}
      <Sparkles count={high ? 70 : 24} scale={[16, 5, 9]} position={[0, 2.4, -0.5]} size={3.5} speed={0.25} color="#ffe2a8" opacity={0.8} />
    </group>
  );
}

function Sand() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(110, 110, 110, 110);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const light = new THREE.Color('#f0c98c');
    const dark = new THREE.Color('#d39a5c');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, sandHeight(x, z));
      c.copy(light).lerp(dark, vnoise(x * 0.6 + 7, z * 0.6) * 0.8);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
  );
}

/** Stepped stone platform with a tiled top at y = 0. */
function Dais() {
  const tiles = useRef<THREE.InstancedMesh>(null);
  const COLS = 13, ROWS = 7, STEP = 1.0;
  useLayoutEffect(() => {
    const m = tiles.current;
    if (!m) return;
    const rnd = seeded(44);
    const o = new THREE.Object3D();
    const base = new THREE.Color('#e7bb80');
    const alt = new THREE.Color('#c99560');
    const c = new THREE.Color();
    let i = 0;
    for (let cx = 0; cx < COLS; cx++)
      for (let rz = 0; rz < ROWS; rz++) {
        const x = (cx - (COLS - 1) / 2) * STEP;
        const z = (rz - (ROWS - 1) / 2) * STEP;
        o.position.set(x, 0.0 + (rnd() - 0.5) * 0.03, z);
        o.rotation.set((rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.03);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, c.copy(base).lerp(alt, rnd() * 0.7));
        i++;
      }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={tiles} args={[undefined, undefined, COLS * ROWS]} receiveShadow castShadow={false}>
        <boxGeometry args={[STEP - 0.07, 0.1, STEP - 0.07]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      {[
        [13.4, 7.4, -0.2, STONE_DARK],
        [14.8, 8.6, -0.5, STONE],
        [16.2, 9.8, -0.8, STONE_DARK],
      ].map(([w, d, y, col], i) => (
        <mesh key={i} position={[0, (y as number) - 0.0, 0]} material={toon(col as string, { rough: 0.95 })} receiveShadow castShadow>
          <boxGeometry args={[w as number, 0.32, d as number]} />
        </mesh>
      ))}
    </group>
  );
}

const COLUMNS: { x: number; z: number; h: number; broken?: boolean }[] = [
  { x: -6.9, z: -3.0, h: 4.4 },
  { x: -4.6, z: -3.5, h: 2.4, broken: true },
  { x: -1.4, z: -4.0, h: 4.4 },
  { x: 1.4, z: -4.0, h: 4.4 },
  { x: 4.6, z: -3.5, h: 4.4 },
  { x: 6.9, z: -3.0, h: 1.7, broken: true },
];

function Ruins() {
  const blocks = useRef<THREE.InstancedMesh>(null);
  const rubble = useMemo(() => {
    const rnd = seeded(9);
    const list: { p: [number, number, number]; r: number; s: [number, number, number] }[] = [];
    // A low back wall of big stone blocks.
    for (let x = -8; x <= 8; x += 1.35) {
      const h = 0.6 + rnd() * 0.9 * (Math.abs(x) > 3 ? 1 : 0.4);
      list.push({ p: [x, h / 2 - 0.05, -5.3 - rnd() * 0.2], r: (rnd() - 0.5) * 0.1, s: [1.3, h, 0.9] });
    }
    // Rubble near the broken columns.
    for (const [cx, cz, n] of [
      [-4.6, -2.7, 4],
      [6.9, -2.3, 5],
      [-7.3, 2.6, 3],
    ] as const)
      for (let i = 0; i < n; i++) {
        const s = 0.18 + rnd() * 0.32;
        list.push({ p: [cx + (rnd() - 0.5) * 1.6, s / 2 - 0.02, cz + (rnd() - 0.5) * 1.2], r: rnd() * 3, s: [s * 1.3, s, s] });
      }
    return list;
  }, []);
  useLayoutEffect(() => {
    const m = blocks.current;
    if (!m) return;
    const o = new THREE.Object3D();
    rubble.forEach((b, i) => {
      o.position.set(...b.p);
      o.rotation.set(0, b.r, 0);
      o.scale.set(...b.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rubble]);

  return (
    <group>
      <instancedMesh ref={blocks} args={[undefined, undefined, rubble.length]} material={toon(STONE_DARK, { rough: 0.95 })} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {COLUMNS.map((c, i) => (
        <Column key={i} {...c} />
      ))}
      {/* Lintel across the two tall middle columns: the temple gate. */}
      <mesh position={[0, 4.75, -4.0]} material={toon(STONE, { rough: 0.9 })} castShadow>
        <boxGeometry args={[4.0, 0.5, 0.9]} />
      </mesh>
      <mesh position={[0, 4.75, -3.54]} material={toon('#5fe3b0', { emissive: '#3fd69c', emissiveIntensity: 2.2 })}>
        <boxGeometry args={[1.6, 0.14, 0.04]} />
      </mesh>
      {/* A fallen column drum lying in the sand at the front left. */}
      <mesh position={[-7.4, -0.5, 4.6]} rotation={[0, 0.5, Math.PI / 2]} material={toon(STONE, { rough: 0.9 })} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, 1.4, 10]} />
      </mesh>
    </group>
  );
}

function Column({ x, z, h, broken }: { x: number; z: number; h: number; broken?: boolean }) {
  const stone = toon(STONE, { rough: 0.9 });
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.14} material={toon(STONE_DARK)} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.28, 1.0]} />
      </mesh>
      <mesh position-y={0.28 + h / 2} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.37, h, 10]} />
      </mesh>
      {broken ? (
        // A jagged top with a tuft of greenery growing out of it.
        <>
          <mesh position-y={0.28 + h + 0.1} rotation={[0.3, 0.4, 0.2]} material={stone} castShadow>
            <cylinderGeometry args={[0.18, 0.32, 0.3, 6]} />
          </mesh>
          <mesh position-y={0.28 + h + 0.3} material={toon('#5aa83f')} castShadow>
            <icosahedronGeometry args={[0.3, 0]} />
          </mesh>
        </>
      ) : (
        <mesh position-y={0.28 + h + 0.12} material={toon(STONE_DARK)} castShadow>
          <boxGeometry args={[0.95, 0.24, 0.95]} />
        </mesh>
      )}
      {/* Jade band carved into each column. */}
      <mesh position-y={0.28 + Math.min(h, 2.2) * 0.55} material={toon('#46c995', { emissive: '#2fb383', emissiveIntensity: 0.9 })}>
        <cylinderGeometry args={[0.345, 0.35, 0.12, 10]} />
      </mesh>
    </group>
  );
}

/** A big stepped pyramid far behind the courtyard, with a glowing jade shrine on top. */
function Pyramid() {
  const tiers = 6;
  return (
    <group position={[-2.5, sandHeight(-2.5, -30), -30]}>
      {Array.from({ length: tiers }, (_, i) => (
        <mesh key={i} position-y={i * 1.7 + 0.85} material={toon(i % 2 ? STONE : STONE_DARK, { rough: 0.95 })}>
          <boxGeometry args={[20 - i * 3, 1.7, 16 - i * 2.4]} />
        </mesh>
      ))}
      {/* Central stair. */}
      <mesh position={[0, 5, 6.2]} rotation-x={-0.63} material={toon(STONE_DEEP)}>
        <boxGeometry args={[2.6, 0.4, 13.2]} />
      </mesh>
      <mesh position-y={tiers * 1.7 + 1.1} material={toon(STONE)}>
        <boxGeometry args={[3.6, 2.2, 3.2]} />
      </mesh>
      <mesh position-y={tiers * 1.7 + 2.4} material={toon(STONE_DARK)}>
        <boxGeometry args={[4.2, 0.4, 3.8]} />
      </mesh>
      <mesh position={[0, tiers * 1.7 + 0.9, 1.62]} material={toon('#7ee0b0', { emissive: '#5fe3b0', emissiveIntensity: 3.5 })}>
        <planeGeometry args={[1.1, 1.6]} />
      </mesh>
    </group>
  );
}

/** Glowing jade crystal clusters at the foot of the ruins (one instanced draw call). */
function Crystals() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => {
    const rnd = seeded(3);
    const out: { p: [number, number, number]; s: number; r: [number, number, number] }[] = [];
    for (const [cx, cz] of [
      [-6.9, -2.2],
      [-1.3, -3.9],
      [5.0, -3.0],
      [7.2, 2.9],
    ])
      for (let i = 0; i < 4; i++)
        out.push({
          p: [cx + (rnd() - 0.5) * 0.6, 0.12, cz + (rnd() - 0.5) * 0.5],
          s: 0.14 + rnd() * 0.18,
          r: [(rnd() - 0.5) * 0.8, rnd() * 3, (rnd() - 0.5) * 0.8],
        });
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    list.forEach((c, i) => {
      o.position.set(...c.p);
      o.rotation.set(...c.r);
      o.scale.set(c.s, c.s * 2.4, c.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [list]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} material={toon('#8ff5c8', { emissive: '#3fe0a0', emissiveIntensity: 2.2, rough: 0.3 })} castShadow>
      <octahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

function Brazier({ position, light, seed }: { position: [number, number, number]; light: boolean; seed: number }) {
  const flame = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + seed;
    const f = 1 + Math.sin(t) * 0.08 + Math.sin(t * 2.7) * 0.06;
    if (flame.current) {
      flame.current.scale.set(1 / f, f * 1.05, 1 / f);
      flame.current.rotation.y += 0.05;
    }
    if (lamp.current) lamp.current.intensity = 7 * f;
  });
  const bronze = toon('#a8743c', { metal: 0.7, rough: 0.35 });
  return (
    <group position={position}>
      <mesh position-y={0.1} material={toon(STONE_DARK)} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.2, 8]} />
      </mesh>
      <mesh position-y={0.7} material={bronze} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.0, 8]} />
      </mesh>
      <mesh position-y={1.32} material={bronze} castShadow>
        <cylinderGeometry args={[0.48, 0.24, 0.36, 10]} />
      </mesh>
      <mesh position-y={1.45} material={toon('#ff5a1f', { emissive: '#ff4a10', emissiveIntensity: 3 })}>
        <icosahedronGeometry args={[0.36, 0]} />
      </mesh>
      <group ref={flame} position-y={1.5}>
        <mesh position-y={0.42} material={toon('#ff9a2e', { emissive: '#ff7a1a', emissiveIntensity: 3.5 })}>
          <coneGeometry args={[0.32, 0.95, 7]} />
        </mesh>
        <mesh position-y={0.36} material={toon('#fff1a8', { emissive: '#ffe066', emissiveIntensity: 4 })}>
          <coneGeometry args={[0.17, 0.6, 6]} />
        </mesh>
      </group>
      {light && <pointLight ref={lamp} position-y={2.1} color="#ff9a40" intensity={7} distance={7} decay={2} />}
    </group>
  );
}

const PALMS: [number, number, number][] = [
  [-9.2, -2.5, 1.15],
  [9.6, -1.2, 1.0],
  [-10.5, 3.5, 0.9],
  [10.8, 4.2, 1.1],
  [-6.5, -8.5, 1.2],
  [7.5, -8.0, 1.0],
];

function Palm({ position, scale, seed }: { position: [number, number, number]; scale: number; seed: number }) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + seed) * 0.05;
  });
  const lean = (seed % 2 ? 1 : -1) * 0.22;
  const segs = 5;
  const trunk = toon('#9b7148');
  const ring = toon('#7d5734');
  const leafA = toon('#3f9a4a');
  const leafB = toon('#5bb04f');
  return (
    <group position={position} scale={scale}>
      <group rotation-z={lean}>
        {Array.from({ length: segs }, (_, i) => (
          <mesh key={i} position-y={i * 0.72 + 0.4} material={i % 2 ? ring : trunk} castShadow>
            <cylinderGeometry args={[0.15 - i * 0.012, 0.19 - i * 0.012, 0.8, 7]} />
          </mesh>
        ))}
      <group ref={crown} position-y={segs * 0.72 + 0.1} rotation-z={-lean * 0.6}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + seed;
          const droop = 1.45 + (i % 2) * 0.3;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <mesh position={[0, Math.cos(droop) * 0.95, Math.sin(droop) * 0.95]} rotation={[droop, 0, 0]} scale={[0.8, 1, 0.2]} material={i % 2 ? leafA : leafB} castShadow>
                <coneGeometry args={[0.28, 1.9, 4]} />
              </mesh>
            </group>
          );
        })}
        {[0, 2, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i) * 0.16, -0.18, Math.sin(i) * 0.16]} material={toon('#6b4a2b')} castShadow>
            <icosahedronGeometry args={[0.11, 0]} />
          </mesh>
        ))}
      </group>
      </group>
    </group>
  );
}
