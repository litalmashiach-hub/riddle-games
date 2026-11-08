import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Water, seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { cogGeometry } from './cog';

/** Top of the brass deck the pillars stand on. */
export const DECK_Y = 0.42;
export const DAIS_R = 6.2;

const brass = () => toon('#c9973f', { metal: 0.85, rough: 0.35 });
const darkBrass = () => toon('#7a5326', { metal: 0.8, rough: 0.45 });
const iron = () => toon('#3b3440', { metal: 0.6, rough: 0.55 });
const stone = () => toon('#5d4b52', { rough: 0.95 });
const stoneDark = () => toon('#3d3038', { rough: 1 });
const glowAmber = () => toon('#ffb347', { emissive: '#ffa53a', emissiveIntensity: 3, flat: false });

/**
 * The clockwork courtyard: a round brass-trimmed dais on a flagstone square, a canal in front,
 * and the citadel wall behind with turning gears, a big clock and steam pipes.
 */
export function Citadel({ celebrate }: { celebrate: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <Flagstones />
      <Dais />
      <Canal />
      <BackWall />
      <WallGears celebrate={celebrate} />
      <Clock celebrate={celebrate} />
      <Tower position={[-9.5, 0, -6.5]} height={8.5} />
      <Tower position={[9.8, 0, -6]} height={7.2} />
      <SteamPipe position={[-7.2, 0, -4.2]} celebrate={celebrate} seed={1} high={high} />
      <SteamPipe position={[7.4, 0, -3.8]} celebrate={celebrate} seed={2} high={high} />
      <Lamp position={[-6.6, 0, 2.6]} />
      <Lamp position={[6.6, 0, 2.6]} />
      {high && <pointLight position={[-6.6, 2.6, 2.6]} color="#ffb058" intensity={9} distance={9} decay={2} />}
      {high && <pointLight position={[6.6, 2.6, 2.6]} color="#ffb058" intensity={9} distance={9} decay={2} />}
      <Sparkles count={high ? 70 : 25} scale={[18, 6, 10]} position={[0, 3.5, -1]} size={3.5} speed={0.35} color="#ffc070" opacity={0.8} />
    </group>
  );
}

/** Instanced flagstones around the dais. One draw call. */
function Flagstones() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => {
    const rnd = seeded(10);
    const out: { x: number; z: number; h: number; s: number; c: number }[] = [];
    for (let x = -16; x <= 16; x += 1.05)
      for (let z = -9; z <= 4.4; z += 1.05) {
        if (Math.hypot(x, z + 0.2) < DAIS_R - 0.2) continue;
        out.push({ x: x + (rnd() - 0.5) * 0.06, z: z + (rnd() - 0.5) * 0.06, h: 0.12 + rnd() * 0.06, s: 0.92 + rnd() * 0.06, c: rnd() });
      }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const a = new THREE.Color('#5a4850');
    const b = new THREE.Color('#463a44');
    const col = new THREE.Color();
    tiles.forEach((t, i) => {
      o.position.set(t.x, t.h / 2 - 0.08, t.z);
      o.rotation.y = (t.c - 0.5) * 0.08;
      o.scale.set(t.s, t.h, t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.copy(a).lerp(b, t.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [tiles]);
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, tiles.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      {/* grout / ground under the tiles */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.06} receiveShadow material={stoneDark()}>
        <planeGeometry args={[80, 60]} />
      </mesh>
    </group>
  );
}

/** Round stone dais with a brass rim, a clock-face inlay and amber studs. */
function Dais() {
  const studs = useRef<THREE.InstancedMesh>(null);
  const ticks = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    if (studs.current) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        o.position.set(Math.cos(a) * (DAIS_R - 0.05), 0.22, Math.sin(a) * (DAIS_R - 0.05) - 0.2);
        o.updateMatrix();
        studs.current.setMatrixAt(i, o.matrix);
      }
      studs.current.instanceMatrix.needsUpdate = true;
    }
    if (ticks.current) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = DAIS_R - 0.75;
        o.position.set(Math.cos(a) * r, 0.005, Math.sin(a) * r - 0.2);
        o.rotation.set(0, -a, 0);
        o.scale.set(i % 3 === 0 ? 0.7 : 0.4, 1, i % 3 === 0 ? 0.14 : 0.09);
        o.updateMatrix();
        ticks.current.setMatrixAt(i, o.matrix);
      }
      ticks.current.instanceMatrix.needsUpdate = true;
    }
  }, []);
  return (
    <group position={[0, 0, -0.2]}>
      {/* stone drum */}
      <mesh position-y={0.15} receiveShadow castShadow material={stone()}>
        <cylinderGeometry args={[DAIS_R, DAIS_R + 0.15, 0.36, 48]} />
      </mesh>
      {/* brass rim */}
      <mesh position-y={0.33} rotation-x={Math.PI / 2} material={brass()} castShadow>
        <torusGeometry args={[DAIS_R - 0.02, 0.07, 6, 64]} />
      </mesh>
      {/* inlaid clock face */}
      <mesh position-y={0.335} rotation-x={-Math.PI / 2} receiveShadow material={toon('#245e6b', { rough: 0.6 })}>
        <circleGeometry args={[DAIS_R - 0.12, 48]} />
      </mesh>
      <mesh position-y={0.34} rotation-x={-Math.PI / 2} material={toon('#a87a3a', { metal: 0.7, rough: 0.4 })}>
        <ringGeometry args={[DAIS_R - 1.15, DAIS_R - 1.0, 64]} />
      </mesh>
      <group position-y={0.34}>
        <instancedMesh ref={ticks} args={[undefined, undefined, 12]} material={toon('#e8c070', { metal: 0.6, rough: 0.35 })}>
          <boxGeometry args={[1, 0.02, 1]} />
        </instancedMesh>
      </group>
      <instancedMesh ref={studs} args={[undefined, undefined, 24]} material={glowAmber()} position-y={0.12}>
        <sphereGeometry args={[0.07, 8, 6]} />
      </instancedMesh>
    </group>
  );
}

/** A glowing canal running across the front of the courtyard. */
function Canal() {
  return (
    <group position={[0, 0, 6.2]}>
      <group rotation-y={Math.PI / 2}>
        <Water width={2.4} length={44} position={[0, -0.32, 0]} shallow="#2fb3a8" deep="#123a5c" foam="#ffe2b0" flow={0.25} waveHeight={0.03} segments={64} />
      </group>
      {/* stone lips */}
      <mesh position={[0, -0.05, -1.3]} material={stone()} receiveShadow>
        <boxGeometry args={[44, 0.3, 0.3]} />
      </mesh>
      <mesh position={[0, -0.05, 1.3]} material={stone()} receiveShadow>
        <boxGeometry args={[44, 0.3, 0.3]} />
      </mesh>
      <mesh position={[0, -0.7, 0]} material={stoneDark()}>
        <boxGeometry args={[44, 0.2, 2.6]} />
      </mesh>
    </group>
  );
}

/** Citadel wall with glowing arched windows. */
function BackWall() {
  const windows = useMemo(() => [-11, -6.8, 6.8, 11].map((x) => x), []);
  return (
    <group position={[0, 0, -9]}>
      <mesh position={[0, 3.6, 0]} material={stone()} receiveShadow castShadow>
        <boxGeometry args={[34, 7.2, 1]} />
      </mesh>
      {/* crenellations */}
      {Array.from({ length: 17 }, (_, i) => (
        <mesh key={i} position={[-16 + i * 2, 7.55, 0]} material={stone()}>
          <boxGeometry args={[1, 0.7, 1]} />
        </mesh>
      ))}
      {/* brass band */}
      <mesh position={[0, 1.2, 0.52]} material={darkBrass()}>
        <boxGeometry args={[34, 0.18, 0.08]} />
      </mesh>
      {windows.map((x) => (
        <group key={x} position={[x, 3.4, 0.5]}>
          <mesh material={toon('#ffcf7a', { emissive: '#ffb04a', emissiveIntensity: 2.4, flat: false })}>
            <boxGeometry args={[1, 1.6, 0.05]} />
          </mesh>
          <mesh position-y={0.8} material={toon('#ffcf7a', { emissive: '#ffb04a', emissiveIntensity: 2.4, flat: false })}>
            <cylinderGeometry args={[0.5, 0.5, 0.05, 16, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, -0.05, 0.04]} material={iron()}>
            <boxGeometry args={[0.06, 1.7, 0.04]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Three big gears on the wall that mesh and turn together. */
function WallGears({ celebrate }: { celebrate: boolean }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const c = useRef<THREE.Group>(null);
  const speed = useRef(1);
  const angle = useRef(0);
  const ra = 2.2, rb = 1.3, rc = 0.9;
  useFrame((_, dt) => {
    speed.current += ((celebrate ? 6 : 1) - speed.current) * Math.min(1, dt * 2);
    angle.current += dt * 0.18 * speed.current;
    if (a.current) a.current.rotation.z = angle.current;
    if (b.current) b.current.rotation.z = -angle.current * (ra / rb) + 0.12;
    if (c.current) c.current.rotation.z = angle.current * (ra / rc) + 0.3;
  });
  const geoA = cogGeometry({ radius: ra, height: 0.35, hole: 0.3, tooth: 0.22, windows: 6 });
  const geoB = cogGeometry({ radius: rb, height: 0.35, hole: 0.2, tooth: 0.22, windows: 5 });
  const geoC = cogGeometry({ radius: rc, height: 0.35, hole: 0.15, tooth: 0.22, windows: 0 });
  return (
    <group>
      <Gear g={geoA} r={ra} x={-3.6} y={4.2} color="#b9833a" refObj={a} />
      <Gear g={geoB} r={rb} x={-3.6 + ra + rb - 0.18} y={4.2 - 0.9} color="#a8692f" refObj={b} />
      <Gear g={geoC} r={rc} x={4.6} y={3.0} color="#b9833a" refObj={c} />
    </group>
  );
}

/** Gears stand upright: the flat cog is turned so its axle points at the camera. */
function Gear({ g, r, x, y, color, refObj }: { g: THREE.BufferGeometry; r: number; x: number; y: number; color: string; refObj: RefObject<THREE.Group | null> }) {
  return (
    <group position={[x, y, -8.3]}>
      <group ref={refObj}>
        <mesh geometry={g} rotation-x={Math.PI / 2} material={toon(color, { metal: 0.85, rough: 0.4 })} castShadow />
      </group>
      <mesh rotation-x={Math.PI / 2} position-z={0.38} material={iron()}>
        <cylinderGeometry args={[r * 0.18, r * 0.18, 0.2, 10]} />
      </mesh>
    </group>
  );
}

/** Big clock above the gate. The hands race round on a win. */
function Clock({ celebrate }: { celebrate: boolean }) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  const t = useRef(2.3);
  useFrame((_, dt) => {
    t.current += dt * (celebrate ? 2.4 : 0.05);
    if (minute.current) minute.current.rotation.z = -t.current * 12;
    if (hour.current) hour.current.rotation.z = -t.current;
  });
  const ticks = useMemo(() => Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2), []);
  return (
    <group position={[2.2, 5.6, -8.35]}>
      <mesh rotation-x={Math.PI / 2} material={darkBrass()} castShadow>
        <cylinderGeometry args={[1.75, 1.75, 0.3, 32]} />
      </mesh>
      <mesh position-z={0.16} material={toon('#ffe7b0', { emissive: '#ffc86a', emissiveIntensity: 0.9, flat: false, rough: 0.6 })}>
        <circleGeometry args={[1.5, 32]} />
      </mesh>
      {ticks.map((a, i) => (
        <mesh key={i} position={[Math.sin(a) * 1.3, Math.cos(a) * 1.3, 0.18]} rotation-z={-a} material={iron()}>
          <boxGeometry args={[i % 3 === 0 ? 0.08 : 0.05, i % 3 === 0 ? 0.24 : 0.14, 0.02]} />
        </mesh>
      ))}
      <group ref={hour} position-z={0.21}>
        <mesh position-y={0.42} material={iron()}>
          <boxGeometry args={[0.1, 0.84, 0.03]} />
        </mesh>
      </group>
      <group ref={minute} position-z={0.24}>
        <mesh position-y={0.6} material={iron()}>
          <boxGeometry args={[0.06, 1.2, 0.03]} />
        </mesh>
      </group>
      <mesh position-z={0.27} material={brass()}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
    </group>
  );
}

function Tower({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <group position={position}>
      <mesh position-y={height / 2} material={stone()} castShadow receiveShadow>
        <cylinderGeometry args={[1.6, 1.8, height, 10]} />
      </mesh>
      <mesh position-y={height + 0.2} material={darkBrass()}>
        <cylinderGeometry args={[1.85, 1.85, 0.4, 10]} />
      </mesh>
      <mesh position-y={height + 1.8} material={toon('#6b2f3a', { rough: 0.8 })} castShadow>
        <coneGeometry args={[2, 2.9, 10]} />
      </mesh>
      <mesh position-y={height + 3.4} material={glowAmber()}>
        <sphereGeometry args={[0.16, 10, 8]} />
      </mesh>
      {[0.35, 0.62].map((f) => (
        <mesh key={f} position={[0, height * f, 1.62]} material={toon('#ffcf7a', { emissive: '#ffb04a', emissiveIntensity: 2.2, flat: false })}>
          <boxGeometry args={[0.45, 0.8, 0.1]} />
        </mesh>
      ))}
    </group>
  );
}

/** A street lamp with a glowing amber globe. */
function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={1.1} material={iron()} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 2.2, 8]} />
      </mesh>
      <mesh position-y={0.1} material={iron()}>
        <cylinderGeometry args={[0.22, 0.28, 0.2, 8]} />
      </mesh>
      <mesh position-y={2.25} material={darkBrass()}>
        <cylinderGeometry args={[0.24, 0.12, 0.12, 8]} />
      </mesh>
      <mesh position-y={2.5} material={glowAmber()}>
        <icosahedronGeometry args={[0.22, 1]} />
      </mesh>
      <mesh position-y={2.78} material={darkBrass()}>
        <coneGeometry args={[0.28, 0.26, 8]} />
      </mesh>
    </group>
  );
}

/** A copper pipe that puffs steam. Puffs a lot more on a win. */
function SteamPipe({ position, celebrate, seed, high }: { position: [number, number, number]; celebrate: boolean; seed: number; high: boolean }) {
  const count = high ? 22 : 10;
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const rnd = seeded(seed * 77);
    return Array.from({ length: count }, () => ({ t: rnd() * 3, dx: (rnd() - 0.5) * 0.6, dz: (rnd() - 0.5) * 0.6, s: 0.5 + rnd() * 0.5 }));
  }, [count, seed]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const top = 3.3;
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const rate = celebrate ? 2.6 : 1;
    puffs.forEach((p, i) => {
      p.t += dt * rate;
      if (p.t > 3) p.t -= 3;
      const k = p.t / 3;
      o.position.set(p.dx * k * 2, top + k * 3.2, p.dz * k * 2);
      const s = (0.25 + k * 0.9) * p.s * Math.sin(Math.PI * Math.min(1, k * 1.1));
      o.scale.setScalar(Math.max(s, 0.001));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={position}>
      <mesh position-y={top / 2} material={toon('#b8693a', { metal: 0.8, rough: 0.4 })} castShadow>
        <cylinderGeometry args={[0.22, 0.22, top, 10]} />
      </mesh>
      {[0.6, 1.8, top - 0.1].map((y) => (
        <mesh key={y} position-y={y} material={brass()}>
          <cylinderGeometry args={[0.3, 0.3, 0.16, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, 0.3]} rotation-x={Math.PI / 2} material={brass()}>
        <torusGeometry args={[0.18, 0.05, 6, 12]} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#f2e6dd" roughness={1} transparent opacity={0.45} depthWrite={false} flatShading />
      </instancedMesh>
    </group>
  );
}
