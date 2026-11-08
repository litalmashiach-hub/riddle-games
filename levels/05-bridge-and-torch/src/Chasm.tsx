import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { edgeAt, groundY, smooth, sconce, vnoise, TORCH_REST_Y } from './layout';

/** The canyon: two sandstone cliffs, a deep chasm with glowing jade mist, a camp and a temple gate. */
export function Chasm({ won }: { won: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <Cliffs />
      <JadeMist high={high} />
      <Moon />
      <Rocks />
      <Crystals />
      <Camp />
      <TempleGate open={won} high={high} />
      <Sconce side={-1} />
      <Sconce side={1} />
      <Sparkles count={high ? 60 : 24} scale={[24, 4, 14]} position={[0, 1.6, -2]} size={2.4} speed={0.25} color="#ffd59a" opacity={0.7} />
    </group>
  );
}

function Cliffs() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(64, 44, 200, 130);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -6);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const sandA = new THREE.Color('#d9a066');
    const sandB = new THREE.Color('#b9784a');
    const rock = new THREE.Color('#9a5236');
    const deep = new THREE.Color('#4a2340');
    const abyss = new THREE.Color('#1c1030');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = groundY(x, z);
      pos.setY(i, y);
      const ax = Math.abs(x);
      const inWall = smooth(edgeAt(z) + 0.1, edgeAt(z) - 0.5, ax);
      c.copy(sandA).lerp(sandB, vnoise(x * 0.6 + 4, z * 0.6));
      // Sandstone strata on the walls, fading into the dark abyss.
      const strata = 0.5 + 0.5 * Math.sin(y * 2.6 + vnoise(x, z) * 2);
      const wallColor = rock.clone().lerp(sandB, strata * 0.35).lerp(deep, smooth(-1, -6, y)).lerp(abyss, smooth(-6, -12, y));
      c.lerp(wallColor, inWall);
      // Higher back walls are rockier too.
      if (y > 1.2) c.lerp(rock, smooth(1.2, 5, y) * 0.5);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  );
}

/** Far below: a river of glowing jade mist. */
function JadeMist({ high }: { high: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 0.55 + Math.sin(clock.elapsedTime * 0.9) * 0.15;
  });
  return (
    <group position={[0, -11.5, 0]}>
      <mesh rotation-x={-Math.PI / 2} position-z={-6}>
        <planeGeometry args={[7, 44]} />
        <meshStandardMaterial ref={mat} color="#06100f" emissive="#138a6c" emissiveIntensity={0.55} roughness={1} />
      </mesh>
      <Sparkles count={high ? 90 : 30} scale={[4.5, 8, 20]} position={[0, 4, -2]} size={4} speed={0.5} color="#7effd4" opacity={0.85} />
    </group>
  );
}

function Moon() {
  return (
    <group position={[-14, 15, -34]}>
      <mesh>
        <icosahedronGeometry args={[2.2, 2]} />
        <meshStandardMaterial color="#fff4dc" emissive="#ffe8b8" emissiveIntensity={1.2} flatShading fog={false} />
      </mesh>
    </group>
  );
}

/** Instanced boulders and dry shrubs on the cliff tops. */
function Rocks() {
  const rocks = useRef<THREE.InstancedMesh>(null);
  const shrubs = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const rnd = seeded(23);
    const o = new THREE.Object3D();
    const place = (m: THREE.InstancedMesh | null, count: number, scale: [number, number], colors: string[]) => {
      if (!m) return;
      const cs = colors.map((c) => new THREE.Color(c));
      let n = 0;
      for (let tries = 0; n < count && tries < count * 20; tries++) {
        const x = (rnd() - 0.5) * 30;
        const z = -14 + rnd() * 20;
        const ax = Math.abs(x);
        if (ax < edgeAt(z) + 0.3) continue;
        // Keep the camp and the bridgehead clear.
        if (ax < 7.2 && z > -2.6 && z < 2.6) continue;
        if (z > 3.5 && ax < 9) continue;
        const s = scale[0] + rnd() * (scale[1] - scale[0]);
        o.position.set(x, groundY(x, z) + s * 0.25, z);
        o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        o.scale.set(s * (0.8 + rnd() * 0.5), s * (0.6 + rnd() * 0.4), s);
        o.updateMatrix();
        m.setMatrixAt(n, o.matrix);
        m.setColorAt(n, cs[n % cs.length]);
        n++;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    place(rocks.current, 40, [0.2, 0.65], ['#a8643f', '#8c4f33', '#c07c4f']);
    place(shrubs.current, 30, [0.25, 0.45], ['#7d8a3a', '#9a8a3e', '#6a7a32']);
  }, []);
  return (
    <>
      <instancedMesh ref={rocks} args={[undefined, undefined, 40]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={shrubs} args={[undefined, undefined, 30]} castShadow>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
    </>
  );
}

/** Glowing jade crystals growing out of the chasm walls. */
function Crystals() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 34;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(77);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -16 + rnd() * 19;
      const y = -1.2 - rnd() * 7;
      // Find the wall: the x where the ground reaches this height.
      let x = edgeAt(z) - 0.1;
      while (x > 1 && groundY(x, z) > y) x -= 0.05;
      o.position.set(side * (x + 0.05), y, z);
      o.rotation.set((rnd() - 0.5) * 0.8, rnd() * 3, side * -(0.5 + rnd() * 0.6));
      const s = 0.1 + rnd() * 0.22;
      o.scale.set(s, s * (1.6 + rnd()), s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#1f9e7e" emissive="#22c79c" emissiveIntensity={1.3} flatShading roughness={0.3} />
    </instancedMesh>
  );
}

/** The explorers' camp on the near side: tent, crates, bedroll and a map. */
function Camp() {
  const x = -8.1, z = -2.6;
  const y = groundY(x, z);
  const canvas = toon('#2f9e8f');
  const canvasDark = toon('#24786e');
  const crate = toon('#a8743c');
  return (
    <group position={[x, y, z]} rotation-y={0.5}>
      <mesh position={[0, 0.65, 0]} rotation-y={Math.PI / 4} material={canvas} castShadow receiveShadow>
        <coneGeometry args={[1.15, 1.3, 4]} />
      </mesh>
      <mesh position={[0, 0.4, 0.62]} rotation-y={Math.PI / 4} material={toon('#18403a')}>
        <coneGeometry args={[0.38, 0.8, 4, 1, true]} />
      </mesh>
      <mesh position={[0, 1.38, 0]} material={canvasDark}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 5]} />
      </mesh>
      <mesh position={[0, 1.55, 0.08]} material={toon('#ff6b4a')}>
        <boxGeometry args={[0.02, 0.12, 0.18]} />
      </mesh>
      <mesh position={[1.35, 0.22, 0.5]} rotation-y={0.3} material={crate} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
      </mesh>
      <mesh position={[1.3, 0.6, 0.45]} rotation-y={-0.2} material={crate} castShadow>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
      </mesh>
      <mesh position={[1.1, 0.08, 1.2]} rotation={[0, 0.6, Math.PI / 2]} material={toon('#c0392b')} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 8]} />
      </mesh>
      <mesh position={[1.31, 0.78, 0.45]} rotation={[-Math.PI / 2, 0, 0.3]} material={toon('#f3e2b8')}>
        <planeGeometry args={[0.3, 0.22]} />
      </mesh>
      {/* a little lantern hanging by the tent (glow only, no light) */}
      <mesh position={[0.7, 0.95, 0.75]} material={toon('#ffd27a', { emissive: '#ffb347', emissiveIntensity: 3 })}>
        <icosahedronGeometry args={[0.07, 0]} />
      </mesh>
      <mesh position={[0.7, 0.55, 0.75]} material={toon('#5a3a22')}>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 4]} />
      </mesh>
    </group>
  );
}

/** Where the torch rests between crossings. */
function Sconce({ side }: { side: 1 | -1 }) {
  const [x, , z] = sconce(side === -1 ? 'L' : 'R');
  const y = groundY(x, z);
  const stone = toon('#c98d5a');
  return (
    <group position={[x, y, z]}>
      <mesh position-y={0.2} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.4, 6]} />
      </mesh>
      <mesh position-y={0.43} material={toon('#a8693f')} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.06, 6]} />
      </mesh>
      <mesh position-y={TORCH_REST_Y - 0.12} material={toon('#3a3a42', { metal: 0.5, rough: 0.5 })}>
        <torusGeometry args={[0.05, 0.014, 4, 10]} />
      </mesh>
    </group>
  );
}

/** The temple entrance on the far side. Its jade door rises when everyone makes it. */
function TempleGate({ open, high }: { open: boolean; high: boolean }) {
  const door = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const x = 7.3, z = -2.4;
  const y = groundY(x, z);
  useFrame(({ clock }, dt) => {
    const d = door.current;
    if (d) d.position.y += ((open ? 2.2 : 0) - d.position.y) * Math.min(1, dt * 1.2);
    if (glow.current) glow.current.emissiveIntensity = (open ? 4 : 1.6) + Math.sin(clock.elapsedTime * 2) * 0.3;
  });
  const sand = toon('#e0a96d');
  const sandDark = toon('#b9784a');
  const jade = toon('#3fd6a8', { emissive: '#2fe0b0', emissiveIntensity: 2.6 });
  return (
    <group position={[x, y, z]} rotation-y={-0.75}>
      {/* steps */}
      <mesh position={[0, 0.08, 0.9]} material={sandDark} receiveShadow castShadow>
        <boxGeometry args={[3.2, 0.16, 0.6]} />
      </mesh>
      <mesh position={[0, 0.2, 0.5]} material={sand} receiveShadow castShadow>
        <boxGeometry args={[2.8, 0.16, 0.6]} />
      </mesh>
      {/* pillars */}
      {[-1.05, 1.05].map((px) => (
        <group key={px} position={[px, 0, 0]}>
          <mesh position-y={1.6} material={sand} castShadow receiveShadow>
            <boxGeometry args={[0.55, 3.0, 0.55]} />
          </mesh>
          <mesh position-y={3.15} material={sandDark} castShadow>
            <boxGeometry args={[0.72, 0.18, 0.72]} />
          </mesh>
          <mesh position={[0, 2.2, 0.28]} material={jade}>
            <octahedronGeometry args={[0.1, 0]} />
          </mesh>
        </group>
      ))}
      {/* lintel with a jade eye */}
      <mesh position={[0, 3.45, 0]} material={sand} castShadow>
        <boxGeometry args={[3.1, 0.45, 0.75]} />
      </mesh>
      <mesh position={[0, 3.85, 0]} material={sandDark} castShadow>
        <boxGeometry args={[2.2, 0.35, 0.6]} />
      </mesh>
      <mesh position={[0, 3.45, 0.39]} rotation-z={Math.PI / 4} material={jade}>
        <boxGeometry args={[0.24, 0.24, 0.04]} />
      </mesh>
      {/* the glowing hall behind the door */}
      <mesh position={[0, 1.55, -0.2]}>
        <planeGeometry args={[1.56, 2.9]} />
        <meshStandardMaterial ref={glow} color="#2a6b5c" emissive="#45f0c0" emissiveIntensity={1.6} />
      </mesh>
      <group ref={door}>
        <mesh position={[0, 1.55, 0]} material={toon('#7a4a33')} castShadow>
          <boxGeometry args={[1.55, 2.9, 0.2]} />
        </mesh>
        {[0.6, 1.55, 2.5].map((dy) => (
          <mesh key={dy} position={[0, dy, 0.11]} material={jade}>
            <boxGeometry args={[1.1, 0.05, 0.02]} />
          </mesh>
        ))}
        <mesh position={[0, 1.55, 0.11]} material={jade}>
          <boxGeometry args={[0.05, 2.4, 0.02]} />
        </mesh>
      </group>
      <Brazier position={[-1.75, 0, 0.9]} high={high} />
      <Brazier position={[1.75, 0, 0.9]} high={high} />
    </group>
  );
}

const brazierFlame = new THREE.MeshStandardMaterial({ color: '#ff8a2a', emissive: '#ff6a10', emissiveIntensity: 3.4, flatShading: true });

function Brazier({ position, high }: { position: [number, number, number]; high: boolean }) {
  const fire = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const seed = position[0];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (fire.current) {
      fire.current.scale.set(1, 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08, 1);
      fire.current.rotation.y = t * 1.5;
    }
    if (light.current) light.current.intensity = 5 + Math.sin(t * 13) * 0.6;
  });
  const stone = toon('#a8693f');
  return (
    <group position={position}>
      <mesh position-y={0.35} material={stone} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 0.7, 6]} />
      </mesh>
      <mesh position-y={0.78} material={toon('#5a4a42', { metal: 0.4, rough: 0.5 })} castShadow>
        <cylinderGeometry args={[0.3, 0.16, 0.22, 8]} />
      </mesh>
      <group ref={fire} position-y={0.9}>
        <mesh position-y={0.18} material={brazierFlame}>
          <coneGeometry args={[0.22, 0.5, 6]} />
        </mesh>
        <mesh position={[0.08, 0.12, 0.05]} material={toon('#fff1a8', { emissive: '#ffd36a', emissiveIntensity: 4 })}>
          <coneGeometry args={[0.1, 0.3, 5]} />
        </mesh>
      </group>
      {high && <pointLight ref={light} color="#ff9a45" intensity={5} distance={6} decay={1.6} position={[0, 1.3, 0]} />}
    </group>
  );
}
