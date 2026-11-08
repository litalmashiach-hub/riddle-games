import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Height of the island's grass top. */
export const ISLAND_TOP = 0;

/**
 * Nudges every vertex by a random offset based on its position, so shared corners
 * move together (no cracks) and primitives look like hand-carved rock.
 */
function rough(geo: THREE.BufferGeometry, amount: number, seed: number, keepTop = false) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const h = (x: number, y: number, z: number, k: number) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 11.13 + seed * 3.7) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = +pos.getX(i).toFixed(3), y = +pos.getY(i).toFixed(3), z = +pos.getZ(i).toFixed(3);
    if (keepTop && y >= maxY - 1e-3) continue;
    pos.setXYZ(i, x + h(x, y, z, 1) * amount, y + h(x, y, z, 2) * amount, z + h(x, y, z, 3) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A floating island: grass cap, earthy rim, rocky cone below. Faces +y, top at y = 0. */
function IslandBody({ radius, depth, seed, grass = '#45b45e', rock = '#6250a8' }: { radius: number; depth: number; seed: number; grass?: string; rock?: string }) {
  const geos = useMemo(() => {
    const top = rough(new THREE.CylinderGeometry(radius, radius * 0.96, radius * 0.12, 14, 1), radius * 0.03, seed, true);
    const rim = rough(new THREE.CylinderGeometry(radius * 0.97, radius * 0.86, radius * 0.18, 14, 1), radius * 0.06, seed + 1);
    const cone = rough(new THREE.ConeGeometry(radius * 0.88, depth, 14, 3), radius * 0.12, seed + 2);
    cone.rotateX(Math.PI);
    return { top, rim, cone };
  }, [radius, depth, seed]);
  return (
    <group>
      <mesh geometry={geos.top} position-y={-radius * 0.06} material={toon(grass, { rough: 0.95 })} receiveShadow castShadow />
      <mesh geometry={geos.rim} position-y={-radius * 0.2} material={toon('#9a6a45', { rough: 1 })} receiveShadow castShadow />
      <mesh geometry={geos.cone} position-y={-radius * 0.29 - depth / 2} material={toon(rock, { rough: 1 })} castShadow />
    </group>
  );
}

function BlossomTree({ position, scale = 1, seed = 0, color = '#ffb3d9' }: { position: [number, number, number]; scale?: number; seed?: number; color?: string }) {
  const top = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (top.current) top.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + seed) * 0.04;
  });
  return (
    <group position={position} scale={scale}>
      <mesh position-y={0.45} rotation-z={0.08} material={toon('#8a5a3c')} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 0.9, 6]} />
      </mesh>
      <group ref={top} position-y={0.95}>
        <mesh material={toon(color)} castShadow>
          <icosahedronGeometry args={[0.45, 0]} />
        </mesh>
        <mesh position={[0.32, -0.12, 0.1]} material={toon(color)} castShadow>
          <icosahedronGeometry args={[0.3, 0]} />
        </mesh>
        <mesh position={[-0.3, -0.08, -0.12]} material={toon('#ffd1ea')} castShadow>
          <icosahedronGeometry args={[0.28, 0]} />
        </mesh>
      </group>
    </group>
  );
}

const crystalMat = () => toon('#7df9ff', { emissive: '#38e1ff', emissiveIntensity: 2.6, rough: 0.2 });

/** A cluster of glowing crystals. `down` hangs it from a ceiling. */
function Crystals({ position, scale = 1, seed = 1, down = false }: { position: [number, number, number]; scale?: number; seed?: number; down?: boolean }) {
  const parts = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: 4 }, (_, i) => ({
      x: (r() - 0.5) * 0.35,
      z: (r() - 0.5) * 0.35,
      h: 0.35 + r() * 0.45 + (i === 0 ? 0.3 : 0),
      tx: (r() - 0.5) * 0.6,
      tz: (r() - 0.5) * 0.6,
    }));
  }, [seed]);
  return (
    <group position={position} scale={scale} rotation-x={down ? Math.PI : 0}>
      {parts.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, p.z]} rotation={[p.tx, 0, p.tz]} scale={[0.12, p.h, 0.12]} material={crystalMat()}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** A small distant island with a tree, slowly bobbing. */
function MiniIsland({ position, radius, seed, tree = '#ffb3d9' }: { position: [number, number, number]; radius: number; seed: number; tree?: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.5 + seed) * 0.25;
  });
  return (
    <group ref={ref} position={position}>
      <IslandBody radius={radius} depth={radius * 1.6} seed={seed} />
      <BlossomTree position={[radius * 0.2, 0, -radius * 0.1]} scale={radius * 0.7} seed={seed} color={tree} />
      <Crystals position={[0, -radius * 1.7, 0]} scale={radius * 0.5} seed={seed + 9} down />
    </group>
  );
}

/** A striped hot-air balloon drifting on the breeze. */
function Balloon({ position, color, stripe, seed }: { position: [number, number, number]; color: string; stripe: string; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.35 + seed;
    const g = ref.current;
    if (!g) return;
    g.position.set(position[0] + Math.sin(t) * 0.8, position[1] + Math.sin(t * 1.7) * 0.35, position[2] + Math.cos(t) * 0.4);
    g.rotation.y = t * 0.3;
  });
  const env = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      // round on top, tapering to a neck at the bottom
      const r = Math.sin(a) * (a > Math.PI / 2 ? 1 - 0.45 * Math.sin(a - Math.PI / 2) : 1);
      pts.push(new THREE.Vector2(i === 0 || i === 12 ? 0.001 : Math.max(r, 0.2), Math.cos(a) * 1.15));
    }
    pts.reverse();
    const g = new THREE.LatheGeometry(pts, 16).toNonIndexed();
    // Colour each face by its slice, giving vertical stripes.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const a = new THREE.Color(color), b = new THREE.Color(stripe);
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const slice = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 16);
      const c = slice % 2 ? a : b;
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [color, stripe]);
  return (
    <group ref={ref} position={position}>
      <mesh geometry={env} castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.75} />
      </mesh>
      <mesh position-y={-1.12} rotation-x={Math.PI / 2} material={toon('#f2c14e', { metal: 0.5, rough: 0.4 })}>
        <torusGeometry args={[0.24, 0.035, 6, 14]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.17, -1.45, Math.sin(a) * 0.17]} material={toon('#5b4636')}>
            <cylinderGeometry args={[0.008, 0.008, 0.6, 3]} />
          </mesh>
        );
      })}
      <mesh position-y={-1.82} material={toon('#9c6b3f')} castShadow>
        <cylinderGeometry args={[0.2, 0.16, 0.24, 8]} />
      </mesh>
    </group>
  );
}

/** A sea of soft low-poly clouds below (and a few behind) the islands. One draw call. */
function CloudSea({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const r = seeded(42);
    return Array.from({ length: count }, (_, i) => {
      const high = i % 7 === 0;
      const a = r() * Math.PI * 2;
      const d = high ? 18 + r() * 14 : 6 + r() * 26;
      return {
        p: new THREE.Vector3(Math.cos(a) * d, high ? 2 + r() * 6 : -6.5 - r() * 3, Math.sin(a) * d - (high ? 8 : 0)),
        s: high ? 1.2 + r() * 1.6 : 1.6 + r() * 2.6,
        sp: 0.2 + r() * 0.3,
        ph: r() * 10,
      };
    });
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    puffs.forEach((p, i) => {
      dummy.position.copy(p.p);
      dummy.scale.set(p.s * 1.5, p.s * 0.7, p.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [puffs, dummy]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    puffs.forEach((p, i) => {
      dummy.position.set(p.p.x + Math.sin(t * 0.05 * p.sp + p.ph) * 1.5, p.p.y + Math.sin(t * p.sp + p.ph) * 0.15, p.p.z);
      const b = 1 + Math.sin(t * p.sp * 1.3 + p.ph) * 0.04;
      dummy.scale.set(p.s * 1.5 * b, p.s * 0.7 * b, p.s * b);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={1} flatShading emissive="#c7d2fe" emissiveIntensity={0.08} />
    </instancedMesh>
  );
}

/** Instanced grass tufts on the island top. */
function Tufts({ count, radius }: { count: number; radius: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const r = seeded(7);
    const d = new THREE.Object3D();
    let n = 0;
    for (let i = 0; n < count && i < count * 6; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * radius;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      // keep the alchemy circle clear
      if (rr < 3.25) continue;
      d.position.set(x, 0.02, z);
      d.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3);
      const s = 0.6 + r() * 0.8;
      d.scale.set(s, s * (0.8 + r() * 0.8), s);
      d.updateMatrix();
      m.setMatrixAt(n++, d.matrix);
      m.setColorAt(n - 1, new THREE.Color().setHSL(0.3 + r() * 0.08, 0.62, 0.32 + r() * 0.12));
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, radius]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <coneGeometry args={[0.06, 0.28, 4]} />
      <meshStandardMaterial flatShading roughness={0.9} />
    </instancedMesh>
  );
}

/** The glowing alchemy circle the flasks stand in. Rune stones orbit slowly. */
function AlchemyCircle() {
  const runes = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }, dt) => {
    if (runes.current) runes.current.rotation.y += dt * 0.12;
    if (glow.current) glow.current.emissiveIntensity = 2.2 + Math.sin(clock.elapsedTime * 1.6) * 0.6;
  });
  const ring = (r: number, w: number) => <ringGeometry args={[r - w, r, 72]} />;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow material={toon('#ab98ea', { rough: 0.9 })}>
        <circleGeometry args={[3.2, 40]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        {ring(3.05, 0.06)}
        <meshStandardMaterial ref={glow} color="#7df9ff" emissive="#38e1ff" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={toon('#8f78e0', { flat: false })}>{ring(2.75, 0.03)}</mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.021} material={toon('#8f78e0', { flat: false })}>{ring(1.25, 0.03)}</mesh>
      <group ref={runes}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2.9, 0.03, Math.sin(a) * 2.9]} rotation={[-Math.PI / 2, 0, a]} material={toon('#fbbf24', { emissive: '#fbbf24', emissiveIntensity: 2 })}>
              <circleGeometry args={[0.07, i % 3 === 0 ? 3 : i % 3 === 1 ? 4 : 6]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** The whole backdrop: main island with alchemy circle, distant islands, balloons, clouds. */
export function SkyLab() {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <IslandBody radius={5.2} depth={5.5} seed={3} />
      <Crystals position={[-1.5, -5.4, 0.8]} scale={1.4} seed={2} down />
      <Crystals position={[1.8, -4.4, -0.6]} scale={1.1} seed={5} down />
      <Crystals position={[0.4, -7.2, 0.2]} scale={1.6} seed={8} down />
      <AlchemyCircle />
      <Tufts count={high ? 160 : 70} radius={5} />
      <BlossomTree position={[-4.3, 0, -1.4]} scale={1.3} seed={1} />
      <BlossomTree position={[4.1, 0, -2.2]} scale={1.05} seed={4} color="#c4b5fd" />
      <Crystals position={[3.8, 0, 1.6]} scale={0.9} seed={11} />
      <Crystals position={[-4.2, 0, 1.2]} scale={0.7} seed={12} />
      <Crystals position={[-1.0, 0, -4.4]} scale={1.1} seed={13} />

      <MiniIsland position={[-10, -1.5, -9]} radius={1.6} seed={21} />
      <MiniIsland position={[11, 1.2, -13]} radius={2.1} seed={22} tree="#c4b5fd" />
      <MiniIsland position={[-17, 3.5, -22]} radius={2.6} seed={23} />
      <MiniIsland position={[7, -3.8, -5]} radius={1.1} seed={24} tree="#fde68a" />
      <Balloon position={[-6.5, 4.2, -7]} color="#ef476f" stripe="#ffd166" seed={0} />
      <Balloon position={[8.5, 5.6, -11]} color="#118ab2" stripe="#ffffff" seed={2.4} />
      {high && <Balloon position={[-14, 7, -18]} color="#06d6a0" stripe="#fef3c7" seed={4.1} />}

      <CloudSea count={high ? 70 : 34} />
      <Sparkles count={high ? 60 : 20} scale={[12, 5, 8]} position={[0, 2.5, 0]} size={3} speed={0.3} color="#fff7c2" opacity={0.8} />
    </group>
  );
}
