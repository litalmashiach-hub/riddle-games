import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BRIDGE_HALF, GAP_HALF, ISLAND_R, ISLAND_X, deckY } from './layout';

const ROCK = '#9a8cc0';
const ROCK_DARK = '#6c5f98';
const GRASS = '#6cc455';
const CRYSTAL = '#7ef0ff';

/** The two floating islands, the crystal rope bridge, a sea of clouds and distant sky life. */
export function SkyIslands({ goalGlow = 0 }: { goalGlow?: number }) {
  const low = useSettings((s) => s.quality) === 'low';
  return (
    <group>
      <Island side={-1} />
      <Island side={1} />
      <Cottage position={[-ISLAND_X - 1.1, 0, -1.55]} />
      <GoalArch position={[ISLAND_X + 0.55, 0, -1.75]} glow={goalGlow} />
      <Tree position={[-ISLAND_X - 1.9, 0, 0.6]} scale={0.8} color="#ff9fc8" seed={1} />
      <Tree position={[-ISLAND_X + 0.4, 0, -2.0]} scale={0.7} color="#a6e8a0" seed={2} />
      <Tree position={[ISLAND_X + 1.95, 0, 0.3]} scale={0.85} color="#ffc9e6" seed={3} />
      <Tree position={[ISLAND_X - 0.9, 0, -1.9]} scale={0.6} color="#9ee39a" seed={4} />
      <Bushes />
      <Flowers count={low ? 40 : 90} />
      <Bridge />
      <CloudSea count={low ? 50 : 110} />
      {/* deep blue sky far below, so the clouds read against something */}
      <mesh position-y={-11} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[60, 32]} />
        <meshBasicMaterial color="#7f9be6" fog={false} />
      </mesh>
      <DistantIsle position={[-11, -0.6, -12]} scale={1.3} seed={1} />
      <DistantIsle position={[9.5, 1.6, -15]} scale={1.6} seed={2} />
      <DistantIsle position={[0.5, 3.4, -22]} scale={2.2} seed={3} />
      <DistantIsle position={[15, -1.4, -6]} scale={0.9} seed={4} />
      <Balloon position={[-7.5, 3.6, -7]} color="#ff7b6b" stripe="#ffd166" seed={1} />
      <Balloon position={[8.5, 4.6, -9]} color="#7c6cf0" stripe="#7ef0ff" seed={2} />
      {!low && <Balloon position={[-15, 6.5, -18]} color="#4fd1a5" stripe="#ffffff" seed={3} />}
      <Sparkles count={low ? 20 : 60} scale={[16, 4, 6]} position={[0, 0.8, -0.5]} size={3} speed={0.3} color="#fff6c8" />
      <Sparkles count={low ? 10 : 30} scale={[4, 1.5, 1.5]} position={[0, -0.6, 0]} size={4} speed={0.5} color={CRYSTAL} />
    </group>
  );
}

function Island({ side }: { side: 1 | -1 }) {
  const x = side * ISLAND_X;
  const crystals = useMemo(() => {
    const rnd = seeded(side > 0 ? 21 : 12);
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.6;
      const r = 0.9 + rnd() * 0.9;
      return { p: [Math.cos(a) * r, -1.1 - rnd() * 1.2, Math.sin(a) * r] as [number, number, number], s: 0.18 + rnd() * 0.2, tilt: rnd() - 0.5 };
    });
  }, [side]);
  return (
    <group position={[x, 0, 0]}>
      {/* grass cap */}
      <mesh position-y={-0.12} material={toon(GRASS)} receiveShadow castShadow>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R - 0.08, 0.24, 14]} />
      </mesh>
      {/* soil rim */}
      <mesh position-y={-0.45} material={toon('#b9845a')} receiveShadow>
        <cylinderGeometry args={[ISLAND_R - 0.05, ISLAND_R - 0.35, 0.45, 14]} />
      </mesh>
      {/* rocky underside */}
      <mesh position-y={-2.05} rotation-x={Math.PI} material={toon(ROCK)} castShadow>
        <coneGeometry args={[ISLAND_R - 0.3, 2.8, 11, 2]} />
      </mesh>
      <mesh position={[side * -0.7, -1.4, 0.8]} rotation={[Math.PI, 0.4, 0.1]} material={toon(ROCK_DARK)}>
        <coneGeometry args={[1.0, 2.0, 7]} />
      </mesh>
      <mesh position={[side * 0.9, -1.0, -0.9]} rotation={[Math.PI, 0.2, -0.15]} material={toon(ROCK_DARK)}>
        <coneGeometry args={[0.9, 1.5, 6]} />
      </mesh>
      {/* glowing crystals hanging underneath */}
      {crystals.map((c, i) => (
        <mesh key={i} position={c.p} rotation={[Math.PI + c.tilt * 0.6, i, c.tilt]} scale={[c.s, c.s * 2.4, c.s]} material={toon(CRYSTAL, { emissive: '#3fd8ff', emissiveIntensity: 2.4, rough: 0.3 })}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ position, scale, color, seed }: { position: [number, number, number]; scale: number; color: string; seed: number }) {
  const top = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (top.current) top.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + seed) * 0.04;
  });
  return (
    <group position={position} scale={scale}>
      <mesh position-y={0.5} material={toon('#8a5a3a')} castShadow>
        <cylinderGeometry args={[0.09, 0.15, 1, 6]} />
      </mesh>
      <group ref={top} position-y={1.05}>
        <mesh position-y={0.4} material={toon(color)} castShadow>
          <icosahedronGeometry args={[0.7, 0]} />
        </mesh>
        <mesh position={[0.38, 0.75, 0.1]} material={toon(color)} castShadow>
          <icosahedronGeometry args={[0.45, 0]} />
        </mesh>
        <mesh position={[-0.35, 0.68, -0.15]} material={toon(color)} castShadow>
          <icosahedronGeometry args={[0.42, 0]} />
        </mesh>
      </group>
    </group>
  );
}

function Bushes() {
  const spots: [number, number, number, number][] = [
    [-ISLAND_X - 1.95, 0, -0.7, 0.35], [-ISLAND_X + 1.3, 0, 1.85, 0.26], [-ISLAND_X - 0.9, 0, 1.95, 0.3],
    [ISLAND_X - 1.25, 0, 1.85, 0.28], [ISLAND_X + 1.75, 0, 1.25, 0.34], [ISLAND_X + 0.3, 0, 2.1, 0.27],
  ];
  return (
    <>
      {spots.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y + r * 0.5, z]} scale={[1.2, 0.85, 1]} material={toon(i % 2 ? '#5fbf5a' : '#4fae58')} castShadow>
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
    </>
  );
}

/** Instanced flowers on both island tops, kept away from the walking paths. */
function Flowers({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(9);
    const o = new THREE.Object3D();
    const palette = ['#ffffff', '#ffd166', '#ff8fb1', '#c9a7ff', '#7ef0ff'].map((c) => new THREE.Color(c));
    let n = 0;
    for (let tries = 0; n < count && tries < count * 20; tries++) {
      const side = rnd() > 0.5 ? 1 : -1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (ISLAND_R - 0.2);
      const lx = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // keep the bridge head and the middle clear
      if (lx > 0.6 && Math.abs(z) < 1.2) continue;
      if (r < 1.0) continue;
      o.position.set(side * ISLAND_X - side * lx, 0.05, z);
      o.rotation.set(0, rnd() * 3, 0);
      o.scale.setScalar(0.7 + rnd() * 0.7);
      o.updateMatrix();
      m.setMatrixAt(n, o.matrix);
      m.setColorAt(n, palette[n % palette.length]);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[0.065, 0]} />
      <meshStandardMaterial flatShading roughness={0.7} emissive="#ffffff" emissiveIntensity={0.15} />
    </instancedMesh>
  );
}

function Cottage({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={0.35}>
      <mesh position-y={0.42} material={toon('#fff1dc')} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.84, 8]} />
      </mesh>
      <mesh position-y={1.12} material={toon('#6c5fd8')} castShadow>
        <coneGeometry args={[0.8, 0.75, 8]} />
      </mesh>
      <mesh position={[0, 0.3, 0.57]} material={toon('#8a5a3a')}>
        <boxGeometry args={[0.24, 0.42, 0.06]} />
      </mesh>
      <mesh position={[0.32, 0.55, 0.48]} rotation-y={0.55} material={toon('#ffd27a', { emissive: '#ffb547', emissiveIntensity: 2.2 })}>
        <boxGeometry args={[0.16, 0.16, 0.04]} />
      </mesh>
      <mesh position={[0.32, 1.42, 0.1]} material={toon('#c9b6ff')} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.35, 6]} />
      </mesh>
    </group>
  );
}

/** The arrival gate: two crystal pillars and a glowing ring. Brightens on a win. */
function GoalArch({ position, glow }: { position: [number, number, number]; glow: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: new THREE.Color('#ffc94a'), emissiveIntensity: 1.6, flatShading: true, roughness: 0.4 }), []);
  useFrame(({ clock }, dt) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.4;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 1.6 + glow * 2.4 + Math.sin(clock.elapsedTime * 2) * 0.3, Math.min(1, dt * 3));
  });
  return (
    <group position={position} rotation-y={-0.35}>
      {[-0.75, 0.75].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position-y={0.6} material={toon('#efe7ff')} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 1.2, 6]} />
          </mesh>
          <mesh position-y={1.35} scale={[0.16, 0.3, 0.16]} material={toon(CRYSTAL, { emissive: '#3fd8ff', emissiveIntensity: 2.6, rough: 0.3 })}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        </group>
      ))}
      <mesh ref={ring} position-y={1.25} material={mat}>
        <torusGeometry args={[0.62, 0.06, 6, 20]} />
      </mesh>
      <mesh position={[0, 2.0, 0]} rotation-z={0.06} material={toon('#ff7b6b')} castShadow>
        <coneGeometry args={[0.18, 0.4, 3]} />
      </mesh>
    </group>
  );
}

/** Crystal rope bridge: instanced wooden planks, glowing ropes and hangers. */
function Bridge() {
  const planks = useRef<THREE.InstancedMesh>(null);
  const hangers = useRef<THREE.InstancedMesh>(null);
  const N = 24;
  const ROPE_Z = 0.56;
  const ropeY = (x: number) => deckY(x) + 0.6 + 0.12 * (Math.abs(x) / GAP_HALF) ** 2;

  useLayoutEffect(() => {
    const p = planks.current;
    const h = hangers.current;
    if (!p || !h) return;
    const rnd = seeded(4);
    const o = new THREE.Object3D();
    const woods = ['#b98252', '#a87445', '#c79565'].map((c) => new THREE.Color(c));
    let hi = 0;
    for (let i = 0; i < N; i++) {
      const x = -BRIDGE_HALF + ((i + 0.5) / N) * BRIDGE_HALF * 2;
      const slope = Math.atan2(deckY(x + 0.01) - deckY(x - 0.01), 0.02);
      o.position.set(x, deckY(x) - 0.03, (rnd() - 0.5) * 0.04);
      o.rotation.set(0, (rnd() - 0.5) * 0.08, slope);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      p.setMatrixAt(i, o.matrix);
      p.setColorAt(i, woods[i % 3]);
      if (i % 3 === 1 && Math.abs(x) < GAP_HALF + 0.1) {
        for (const z of [ROPE_Z, -ROPE_Z]) {
          const top = ropeY(x);
          const bottom = deckY(x);
          o.position.set(x, (top + bottom) / 2, z);
          o.rotation.set(0, 0, 0);
          o.scale.set(1, top - bottom, 1);
          o.updateMatrix();
          h.setMatrixAt(hi++, o.matrix);
        }
      }
    }
    h.count = hi;
    p.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
  }, []);

  const ropes = useMemo(
    () =>
      [ROPE_Z, -ROPE_Z].map((z) => {
        const pts = Array.from({ length: 13 }, (_, i) => {
          const x = -GAP_HALF - 0.1 + (i / 12) * (GAP_HALF + 0.1) * 2;
          return new THREE.Vector3(x, ropeY(x), z);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 6);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const ropeMat = toon('#b8f6ff', { emissive: '#4fe0ff', emissiveIntensity: 2.2, rough: 0.3, flat: false });

  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, N]} castShadow receiveShadow>
        <boxGeometry args={[(BRIDGE_HALF * 2) / N - 0.035, 0.06, 1.05]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={hangers} args={[undefined, undefined, N]} material={ropeMat}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
      </instancedMesh>
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={ropeMat} />
      ))}
      {/* crystal posts at both ends */}
      {[-1, 1].map((s) =>
        [ROPE_Z, -ROPE_Z].map((z) => (
          <group key={`${s}${z}`} position={[s * (GAP_HALF + 0.1), 0, z]}>
            <mesh position-y={0.38} material={toon('#efe7ff')} castShadow>
              <cylinderGeometry args={[0.07, 0.1, 0.76, 6]} />
            </mesh>
            <mesh position-y={0.86} scale={[0.1, 0.18, 0.1]} material={toon(CRYSTAL, { emissive: '#3fd8ff', emissiveIntensity: 3, rough: 0.3 })}>
              <octahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/** A soft sea of instanced cloud puffs far below, drifting slowly. */
function CloudSea({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const rnd = seeded(31);
    return Array.from({ length: count }, () => ({
      x: (rnd() - 0.5) * 70,
      y: -5.2 - rnd() * 2.2,
      z: -34 + rnd() * 36,
      s: 0.9 + rnd() * 1.7,
      sp: 0.15 + rnd() * 0.2,
    }));
  }, [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    puffs.forEach((p, i) => {
      p.x += p.sp * dt;
      if (p.x > 35) p.x = -35;
      o.position.set(p.x, p.y, p.z);
      o.scale.set(p.s * 1.4, p.s * 0.7, p.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#f4f6ff" emissive="#c7d4ff" emissiveIntensity={0.18} flatShading roughness={1} />
    </instancedMesh>
  );
}

function DistantIsle({ position, scale, seed }: { position: [number, number, number]; scale: number; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.5 + seed * 2) * 0.18;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh position-y={-0.08} material={toon(GRASS)}>
        <cylinderGeometry args={[1, 0.95, 0.16, 9]} />
      </mesh>
      <mesh position-y={-0.9} rotation-x={Math.PI} material={toon(ROCK)}>
        <coneGeometry args={[0.92, 1.5, 8]} />
      </mesh>
      <mesh position={[0.25, 0.45, -0.1]} material={toon(seed % 2 ? '#ffb3d6' : '#a6e8a0')}>
        <icosahedronGeometry args={[0.4, 0]} />
      </mesh>
      <mesh position={[0.25, 0.15, -0.1]} material={toon('#8a5a3a')}>
        <cylinderGeometry args={[0.05, 0.07, 0.3, 5]} />
      </mesh>
      <mesh position={[-0.2, -1.4, 0.2]} scale={[0.12, 0.3, 0.12]} material={toon(CRYSTAL, { emissive: '#3fd8ff', emissiveIntensity: 2.4, rough: 0.3 })}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  );
}

function Balloon({ position, color, stripe, seed }: { position: [number, number, number]; color: string; stripe: string; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.25 + seed * 3;
    g.position.set(position[0] + Math.sin(t) * 1.2, position[1] + Math.sin(t * 2.1) * 0.35, position[2]);
    g.rotation.y = t * 0.5;
  });
  return (
    <group ref={ref} position={position}>
      <mesh position-y={1.1} scale={[1, 1.15, 1]} material={toon(color)}>
        <icosahedronGeometry args={[0.85, 1]} />
      </mesh>
      <mesh position-y={1.1} scale={[1.02, 0.25, 1.02]} material={toon(stripe)}>
        <icosahedronGeometry args={[0.85, 1]} />
      </mesh>
      <mesh position-y={0.12} material={toon('#a8743f')}>
        <cylinderGeometry args={[0.24, 0.2, 0.26, 6]} />
      </mesh>
      <mesh position-y={0.4} material={toon('#ffb547', { emissive: '#ff8a1f', emissiveIntensity: 3 })}>
        <coneGeometry args={[0.07, 0.18, 5]} />
      </mesh>
    </group>
  );
}
