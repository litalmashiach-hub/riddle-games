import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Water, seeded } from '@riddle/fx';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { toon } from './materials';

/** River half-width at the waterline. Banks start just beyond this. */
export const RIVER_HALF = 2.9;

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

/** Height of the valley floor at (x, z). Use it to stand characters on the ground. */
export function groundHeight(x: number, z: number) {
  const ax = Math.abs(x);
  const bank = -0.55 + 0.9 * smooth(RIVER_HALF - 0.5, RIVER_HALF + 0.6, ax);
  const bumps = (vnoise(x * 0.35, z * 0.35) - 0.5) * 0.7 * smooth(RIVER_HALF + 1.5, RIVER_HALF + 6, ax);
  const hills = smooth(12, 26, ax) * 4 + smooth(-8, -26, z) * 3.5 * smooth(RIVER_HALF + 1, RIVER_HALF + 5, ax);
  return bank + bumps + hills;
}

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(70, 70, 140, 140);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grassA = new THREE.Color('#7cc04b');
    const grassB = new THREE.Color('#4f9a3a');
    const sand = new THREE.Color('#e3cf95');
    const mud = new THREE.Color('#8a7650');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = groundHeight(x, z);
      pos.setY(i, y);
      c.copy(grassA).lerp(grassB, vnoise(x * 0.5 + 10, z * 0.5));
      if (y < 0.18) c.lerp(sand, smooth(0.18, 0.02, y));
      if (y < -0.15) c.lerp(mud, smooth(-0.15, -0.45, y));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  );
}

function Tree({ position, scale, seed }: { position: [number, number, number]; scale: number; seed: number }) {
  const top = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (top.current) top.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + seed) * 0.03;
  });
  const leaves = seed % 3 === 0 ? '#3f8f3a' : seed % 3 === 1 ? '#5aa83f' : '#2f7a45';
  const pine = seed % 4 === 0;
  return (
    <group position={position} scale={scale}>
      <mesh position-y={0.5} material={toon('#7a5233')} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1, 6]} />
      </mesh>
      <group ref={top} position-y={1}>
        {pine ? (
          [0, 0.55, 1.05].map((y, i) => (
            <mesh key={i} position-y={y + 0.35} material={toon('#2f6e3f')} castShadow>
              <coneGeometry args={[0.85 - i * 0.22, 1.1, 7]} />
            </mesh>
          ))
        ) : (
          <>
            <mesh position-y={0.55} material={toon(leaves)} castShadow>
              <icosahedronGeometry args={[0.8, 0]} />
            </mesh>
            <mesh position={[0.35, 0.95, 0.15]} material={toon(leaves)} castShadow>
              <icosahedronGeometry args={[0.55, 0]} />
            </mesh>
            <mesh position={[-0.35, 0.85, -0.2]} material={toon(leaves)} castShadow>
              <icosahedronGeometry args={[0.5, 0]} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

/** Instanced tiny things scattered on the grass (flowers, grass tufts). */
function Scatter({ count, keepOut, kind }: { count: number; keepOut: (x: number, z: number) => boolean; kind: 'flower' | 'grass' }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(kind === 'flower' ? 7 : 11);
    const o = new THREE.Object3D();
    const palette = ['#ffffff', '#ffd166', '#ef476f', '#c084fc', '#f9a8d4'].map((c) => new THREE.Color(c));
    const greens = ['#6fb944', '#86c95a', '#4c9a35'].map((c) => new THREE.Color(c));
    let n = 0;
    for (let tries = 0; n < count && tries < count * 10; tries++) {
      const x = (rnd() - 0.5) * 40, z = (rnd() - 0.5) * 32;
      if (Math.abs(x) < RIVER_HALF + 0.5 || keepOut(x, z)) continue;
      const y = groundHeight(x, z);
      o.position.set(x, y + (kind === 'flower' ? 0.08 : 0.1), z);
      o.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
      const s = kind === 'flower' ? 0.6 + rnd() * 0.6 : 0.7 + rnd() * 0.8;
      o.scale.set(s, s, s);
      o.updateMatrix();
      m.setMatrixAt(n, o.matrix);
      m.setColorAt(n, kind === 'flower' ? palette[n % palette.length] : greens[n % greens.length]);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, keepOut, kind]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={kind === 'grass'} receiveShadow>
      {kind === 'flower' ? <icosahedronGeometry args={[0.07, 0]} /> : <coneGeometry args={[0.06, 0.28, 3]} />}
      <meshStandardMaterial flatShading roughness={0.8} emissive={kind === 'flower' ? '#333' : '#000'} />
    </instancedMesh>
  );
}

function Cloud({ position, scale = 1, speed = 0.15 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += dt * speed;
    if (g.position.x > 40) g.position.x = -40;
  });
  const m = toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[[0, 0, 0, 1.6], [1.5, -0.2, 0.2, 1.2], [-1.5, -0.3, 0, 1.1], [0.6, 0.6, -0.3, 1.1], [-0.7, 0.4, 0.3, 1]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} material={m}>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function Pier({ side }: { side: 1 | -1 }) {
  const wood = toon('#a0703f');
  const dark = toon('#6d4223');
  const x0 = side * (RIVER_HALF - 0.9);
  return (
    <group position={[x0, 0.28, -1.15]}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[side * i * 0.3, 0, 0]} rotation-y={(i % 2 ? 0.02 : -0.02)} material={wood} castShadow receiveShadow>
          <boxGeometry args={[0.27, 0.07, 0.9]} />
        </mesh>
      ))}
      {[0, 1.5].map((dx) => [-0.4, 0.4].map((dz) => (
        <mesh key={`${dx}${dz}`} position={[side * dx, -0.35, dz]} material={dark} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.9, 6]} />
        </mesh>
      )))}
      <mesh position={[0, 0.15, 0.48]} material={dark} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.5, 6]} />
      </mesh>
    </group>
  );
}

function Reeds() {
  const items = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: 40 }, () => {
      const side = rnd() > 0.5 ? 1 : -1;
      const z = (rnd() - 0.5) * 26;
      if (Math.abs(z) < 2.4) return null;
      return { x: side * (RIVER_HALF - 0.15 + rnd() * 0.4), z, h: 0.5 + rnd() * 0.5, r: rnd() };
    }).filter(Boolean) as { x: number; z: number; h: number; r: number }[];
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.rotation.z = Math.sin(clock.elapsedTime * 1.4 + i) * 0.08));
  });
  return (
    <group ref={ref}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, groundHeight(it.x, it.z), it.z]}>
          <mesh position-y={it.h / 2} material={toon('#6a9a3a')}>
            <cylinderGeometry args={[0.015, 0.025, it.h, 4]} />
          </mesh>
          <mesh position-y={it.h} material={toon('#7a4a2a')}>
            <capsuleGeometry args={[0.035, 0.12, 2, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LilyPads() {
  const pads = useMemo(() => {
    const rnd = seeded(3);
    return Array.from({ length: 10 }, () => {
      const z = (rnd() > 0.5 ? 1 : -1) * (3 + rnd() * 8);
      return { x: (rnd() - 0.5) * 4, z, r: 0.18 + rnd() * 0.15, rot: rnd() * 6, flower: rnd() > 0.6 };
    });
  }, []);
  return (
    <>
      {pads.map((p, i) => (
        <group key={i} position={[p.x, 0.04, p.z]} rotation-y={p.rot}>
          <mesh rotation-x={-Math.PI / 2} material={toon('#3f9a4a', { flat: false })}>
            <circleGeometry args={[p.r, 14, 0.3, Math.PI * 2 - 0.6]} />
          </mesh>
          {p.flower && (
            <mesh position-y={0.05} material={toon('#f9a8d4', { emissive: '#f9a8d4', emissiveIntensity: 0.3 })}>
              <icosahedronGeometry args={[0.07, 0]} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/**
 * A complete river valley diorama: banks, water, trees, flowers, reeds, piers, clouds, pollen.
 * The river runs along z between x = -RIVER_HALF and +RIVER_HALF. Keep the play area
 * (|z| < ~3, RIVER_HALF < |x| < ~7) free; scenery avoids it.
 */
export function RiverValley({ piers = true }: { piers?: boolean }) {
  const keepOut = useMemo(() => (x: number, z: number) => Math.abs(z) < 3.2 && Math.abs(x) < 7.5, []);
  const trees = useMemo(() => {
    const rnd = seeded(42);
    const out: { p: [number, number, number]; s: number; seed: number }[] = [];
    for (let i = 0; out.length < 46 && i < 800; i++) {
      const x = (rnd() - 0.5) * 46, z = -22 + rnd() * 30;
      if (Math.abs(x) < RIVER_HALF + 1.2) continue;
      if (Math.abs(z) < 4.2 && Math.abs(x) < 9) continue;
      if (z > 3 && Math.abs(x) < 10) continue; // keep the foreground open toward the camera
      out.push({ p: [x, groundHeight(x, z) - 0.05, z], s: 0.8 + rnd() * 0.9, seed: i });
    }
    return out;
  }, []);
  const rocks = useMemo(() => {
    const rnd = seeded(9);
    return Array.from({ length: 22 }, () => {
      const side = rnd() > 0.5 ? 1 : -1;
      const x = side * (RIVER_HALF - 0.3 + rnd() * 5), z = (rnd() - 0.5) * 22;
      if (keepOut(x, z) && Math.abs(x) > RIVER_HALF + 0.3) return null;
      return { p: [x, groundHeight(x, z), z] as [number, number, number], s: 0.15 + rnd() * 0.35, r: rnd() * 6 };
    }).filter(Boolean) as { p: [number, number, number]; s: number; r: number }[];
  }, [keepOut]);

  return (
    <group>
      <Terrain />
      <Water width={RIVER_HALF * 2 + 0.2} length={70} position={[0, 0, 0]} />
      {trees.map((t, i) => (
        <Tree key={i} position={t.p} scale={t.s} seed={t.seed} />
      ))}
      {rocks.map((r, i) => (
        <mesh key={i} position={r.p} rotation={[r.r, r.r * 2, 0]} scale={[r.s * 1.3, r.s, r.s]} material={toon('#9aa0a6')} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      <Scatter kind="grass" count={900} keepOut={() => false} />
      <Scatter kind="flower" count={260} keepOut={() => false} />
      <Reeds />
      <LilyPads />
      {piers && (
        <>
          <Pier side={-1} />
          <Pier side={1} />
        </>
      )}
      <Cloud position={[-12, 13, -24]} scale={1.6} />
      <Cloud position={[10, 15, -30]} scale={2.2} speed={0.1} />
      <Cloud position={[24, 12, -18]} scale={1.2} speed={0.2} />
      <Cloud position={[-30, 16, -34]} scale={2.4} speed={0.08} />
      <Sparkles count={70} scale={[18, 3, 10]} position={[0, 1.6, 0]} size={3} speed={0.3} opacity={0.8} color="#fff6c8" />
    </group>
  );
}
