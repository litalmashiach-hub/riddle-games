import { Sparkles, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Water, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { glowTexture } from './Jars';

/** Deterministic pseudo-random numbers, so the scenery is the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const WATER_Y = 0.08;

/** Lily pads floating around the raft (instanced), some with lotus flowers. */
function LilyPads() {
  const pads = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const hearts = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(7);
    const out: { x: number; z: number; s: number; rot: number; flower: boolean }[] = [];
    const spots: [number, number][] = [
      [-5.6, 1.6], [-6.4, -0.6], [-5.2, 3.1], [-3.4, 2.6], [-1.6, 3.4], [1.2, 3.0], [2.9, 2.7], [6.3, -0.4], [6.8, 1.9],
      [-7.6, 1.2], [7.8, 0.4], [-4.3, -2.6], [4.6, -2.7], [-8.2, -2.4], [8.6, -2.2], [0.3, -3.2], [-2.2, -3.6], [2.6, -3.9], [-6.8, 3.6], [5.6, 3.8],
    ];
    spots.forEach(([x, z], i) => out.push({ x: x + (r() - 0.5) * 0.4, z: z + (r() - 0.5) * 0.4, s: 0.45 + r() * 0.45, rot: r() * Math.PI * 2, flower: i % 4 === 1 }));
    return out;
  }, []);
  const flowers = data.filter((d) => d.flower);
  const PET = 7;

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    data.forEach((d, i) => {
      q.setFromEuler(e.set(0, d.rot, 0));
      m.compose(new THREE.Vector3(d.x, WATER_Y + 0.03, d.z), q, new THREE.Vector3(d.s, 1, d.s));
      pads.current?.setMatrixAt(i, m);
    });
    flowers.forEach((d, f) => {
      for (let p = 0; p < PET * 2; p++) {
        const ring = p < PET ? 0 : 1;
        const a = (p / PET) * Math.PI * 2 + ring * 0.45;
        q.setFromEuler(e.set(ring ? 0.75 : 0.35, a, 0, 'YXZ'));
        const rr = ring ? 0.07 : 0.12;
        m.compose(new THREE.Vector3(d.x + Math.sin(a) * rr, WATER_Y + 0.12 + ring * 0.03, d.z + Math.cos(a) * rr), q, new THREE.Vector3(1, 1, 1).multiplyScalar(ring ? 0.8 : 1));
        petals.current?.setMatrixAt(f * PET * 2 + p, m);
      }
      m.compose(new THREE.Vector3(d.x, WATER_Y + 0.16, d.z), q.identity(), new THREE.Vector3(1, 1, 1));
      hearts.current?.setMatrixAt(f, m);
    });
    [pads, petals, hearts].forEach((r) => r.current && (r.current.instanceMatrix.needsUpdate = true));
  }, [data, flowers]);

  return (
    <group>
      <instancedMesh ref={pads} args={[undefined, undefined, data.length]} receiveShadow castShadow>
        <cylinderGeometry args={[0.5, 0.52, 0.04, 18, 1, false, 0.35, Math.PI * 2 - 0.35]} />
        <meshStandardMaterial color="#3f8f4e" roughness={0.75} flatShading />
      </instancedMesh>
      <instancedMesh ref={petals} args={[undefined, undefined, flowers.length * PET * 2]} castShadow>
        <coneGeometry args={[0.06, 0.2, 4]} />
        <meshStandardMaterial color="#ffb3d1" emissive="#ff7fb8" emissiveIntensity={0.35} roughness={0.6} flatShading />
      </instancedMesh>
      <instancedMesh ref={hearts} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[0.05, 0]} />
        <meshBasicMaterial color={new THREE.Color('#ffe27a').multiplyScalar(2.5)} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Glowing toadstools on the banks (instanced, each cap its own colour). */
function Mushrooms() {
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(42);
    const clusters: [number, number][] = [
      [-7.2, -4.6], [-4.8, -5.4], [-1.2, -6.2], [2.6, -5.8], [5.8, -5.0], [8.4, -3.9], [-9.6, -2.6], [9.8, -1.2],
    ];
    const cols = ['#5ef2ff', '#b48cff', '#5effb0', '#ff8fd8'];
    const out: { x: number; z: number; h: number; s: number; c: string; tilt: number }[] = [];
    clusters.forEach(([cx, cz], ci) => {
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) out.push({ x: cx + (r() - 0.5) * 1.1, z: cz + (r() - 0.5) * 0.8, h: 0.18 + r() * 0.38, s: 0.12 + r() * 0.16, c: cols[(ci + i) % cols.length], tilt: (r() - 0.5) * 0.4 });
    });
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    data.forEach((d, i) => {
      const y = 0.32;
      q.setFromEuler(e.set(d.tilt, 0, d.tilt * 0.7));
      m.compose(new THREE.Vector3(d.x, y + d.h / 2, d.z), q, new THREE.Vector3(d.s * 0.35, d.h, d.s * 0.35));
      stems.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(d.x + Math.sin(d.tilt * 0.7) * -d.h * 0.5, y + d.h, d.z + Math.sin(d.tilt) * d.h * 0.5), q, new THREE.Vector3(d.s, d.s * 0.6, d.s));
      caps.current?.setMatrixAt(i, m);
      caps.current?.setColorAt(i, c.set(d.c).multiplyScalar(1.8));
    });
    [stems, caps].forEach((r) => {
      if (!r.current) return;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    });
  }, [data]);
  return (
    <group>
      <instancedMesh ref={stems} args={[undefined, undefined, data.length]} castShadow>
        <cylinderGeometry args={[0.8, 1, 1, 6]} />
        <meshStandardMaterial color="#e9e2cf" emissive="#8fa9c9" emissiveIntensity={0.3} flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, data.length]}>
        <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Cattails and reeds along the near and far banks. */
function Reeds() {
  const stalks = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(99);
    const out: { x: number; z: number; h: number; lean: number; head: boolean }[] = [];
    const patches: [number, number][] = [[-8.8, 2.4], [-6.2, -3.6], [6.6, -3.4], [9.2, 2.6], [-3.2, -4.8], [3.6, -4.6]];
    patches.forEach(([px, pz]) => {
      for (let i = 0; i < 9; i++) out.push({ x: px + (r() - 0.5) * 1.4, z: pz + (r() - 0.5) * 0.9, h: 0.8 + r() * 0.9, lean: (r() - 0.5) * 0.3, head: r() < 0.5 });
    });
    return out;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    let h = 0;
    data.forEach((d, i) => {
      const sway = d.lean + Math.sin(t * 1.1 + d.x * 0.8 + d.z) * 0.05;
      q.setFromEuler(e.set(0, 0, sway));
      m.compose(v.set(d.x - Math.sin(sway) * d.h * 0.5, WATER_Y + d.h / 2 - 0.05, d.z), q, new THREE.Vector3(1, d.h, 1));
      stalks.current?.setMatrixAt(i, m);
      if (d.head) {
        m.compose(v.set(d.x - Math.sin(sway) * d.h * 0.85, WATER_Y + d.h * 0.85, d.z), q, new THREE.Vector3(1, 1, 1));
        heads.current?.setMatrixAt(h++, m);
      }
    });
    if (stalks.current) stalks.current.instanceMatrix.needsUpdate = true;
    if (heads.current) {
      heads.current.count = h;
      heads.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh ref={stalks} args={[undefined, undefined, data.length]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.018, 0.03, 1, 4]} />
        <meshStandardMaterial color="#5a8f3e" flatShading />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, data.length]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.045, 0.18, 2, 6]} />
        <meshStandardMaterial color="#6b4026" flatShading />
      </instancedMesh>
    </group>
  );
}

/** A drooping willow made of chunky cones, swaying slowly. */
function Willow({ position, scale = 1, seed = 0 }: { position: [number, number, number]; scale?: number; seed?: number }) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.5 + seed) * 0.03;
  });
  const drapes = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + seed, r: 0.9 + (i % 3) * 0.25, len: 1.6 + ((i * 7 + seed * 3) % 4) * 0.25 })), [seed]);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow material={toon('#4a3427')}>
        <cylinderGeometry args={[0.16, 0.3, 2.4, 7]} />
      </mesh>
      <group ref={crown} position={[0, 2.5, 0]}>
        <mesh castShadow material={toon('#2f6b4f')} scale={[1.5, 0.8, 1.5]}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        {drapes.map((d, i) => (
          <mesh key={i} position={[Math.sin(d.a) * d.r, -d.len / 2 + 0.1, Math.cos(d.a) * d.r]} rotation-x={Math.PI} castShadow material={toon(i % 2 ? '#3d7f5a' : '#357552')}>
            <coneGeometry args={[0.32, d.len, 5]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A paper lantern hanging from a bent bamboo pole. */
function Lantern({ position, color = '#ffb347', seed = 0, rotation = 0 }: { position: [number, number, number]; color?: string; seed?: number; rotation?: number }) {
  const swing = useRef<THREE.Group>(null);
  const high = useSettings((s) => s.quality) === 'high';
  useFrame(({ clock }) => {
    if (swing.current) swing.current.rotation.z = Math.sin(clock.elapsedTime * 1.3 + seed) * 0.12;
  });
  const glow = useMemo(() => new THREE.Color(color).multiplyScalar(2.6), [color]);
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [color]);
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 1.1, 0]} castShadow material={toon('#c9b26b')}>
        <cylinderGeometry args={[0.035, 0.05, 2.2, 6]} />
      </mesh>
      <mesh position={[0.3, 2.15, 0]} rotation-z={-1.2} castShadow material={toon('#c9b26b')}>
        <cylinderGeometry args={[0.03, 0.035, 0.7, 6]} />
      </mesh>
      <group ref={swing} position={[0.62, 2.28, 0]}>
        <mesh position={[0, -0.2, 0]} material={toon('#3b2a1e')}>
          <cylinderGeometry args={[0.006, 0.006, 0.4, 3]} />
        </mesh>
        <group position={[0, -0.6, 0]}>
          <mesh scale={[1, 1.15, 1]}>
            <icosahedronGeometry args={[0.24, 1]} />
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.27, 0]} material={toon('#7a2e2e')}>
            <cylinderGeometry args={[0.1, 0.13, 0.06, 8]} />
          </mesh>
          <mesh position={[0, -0.27, 0]} material={toon('#7a2e2e')}>
            <cylinderGeometry args={[0.13, 0.1, 0.06, 8]} />
          </mesh>
          <sprite material={halo} scale={[1.8, 1.8, 1]} />
          {high && <pointLight color={color} intensity={2.4} distance={4.5} decay={2} />}
        </group>
      </group>
    </group>
  );
}

/** Mossy banks curving round the back of the lagoon. */
function Banks() {
  const hills = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 11 }, (_, i) => {
      const a = -1.25 + (i / 10) * 2.5;
      const R = 7.4 + r() * 1.2;
      return { x: Math.sin(a) * R * 1.45, z: -Math.cos(a) * R + 0.8, sx: 2.6 + r() * 1.4, sy: 0.55 + r() * 0.5, c: i % 2 ? '#2f5d43' : '#36684a' };
    });
  }, []);
  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, 0.05, h.z]} scale={[h.sx, h.sy, 1.6]} receiveShadow castShadow material={toon(h.c)}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
      {/* Far, darker treeline: round bushy crowns. */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = -1.15 + (i / 11) * 2.3;
        const s = 1.0 + ((i * 7) % 4) * 0.25;
        return (
          <mesh key={i} position={[Math.sin(a) * 24, 0.2 + s * 0.5, -Math.cos(a) * 18 - 4]} scale={[s * 1.3, s, s]} material={toon(i % 2 ? '#2c4a52' : '#335a58')}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Big friendly moon with a soft halo. */
function Moon() {
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#bfd7ff').multiplyScalar(0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), []);
  return (
    <group position={[-9, 11, -26]}>
      <mesh>
        <icosahedronGeometry args={[2.2, 2]} />
        <meshBasicMaterial color={new THREE.Color('#fff4d6').multiplyScalar(1.6)} toneMapped={false} fog={false} />
      </mesh>
      <sprite material={halo} scale={[14, 14, 1]} />
    </group>
  );
}

export function Lagoon() {
  const low = useSettings((s) => s.quality) === 'low';
  return (
    <group>
      <Water width={70} length={60} position={[0, WATER_Y, -6]} shallow="#1d6c78" deep="#0a2a48" foam="#9fe7ff" flow={0.05} waveHeight={0.03} segments={low ? 48 : 96} />
      <Moon />
      <Stars radius={60} depth={20} count={low ? 600 : 1800} factor={3} saturation={0.4} fade speed={0.6} />
      <Banks />
      <Willow position={[-8.6, 0.2, -5.4]} scale={1.1} seed={1} />
      <Willow position={[8.9, 0.2, -5.0]} scale={1.25} seed={3} />
      {!low && <Willow position={[-2.6, 0.3, -9.2]} scale={0.9} seed={5} />}
      {!low && <Willow position={[4.2, 0.3, -9.8]} scale={1.0} seed={7} />}
      <LilyPads />
      <Mushrooms />
      <Reeds />
      <Lantern position={[-5.0, 0, -0.6]} seed={0} />
      <Lantern position={[5.1, 0, -0.9]} color="#ff9fd0" seed={2} rotation={Math.PI} />
      {!low && <Lantern position={[-1.2, 0.3, -6.1]} color="#9fe8ff" seed={4} />}
      {/* Drifting wild fireflies all over the lagoon. */}
      <Sparkles count={low ? 40 : 120} scale={[22, 4, 12]} position={[0, 2, -2]} size={5} speed={0.35} color="#e8ff7a" opacity={0.9} />
      <Sparkles count={low ? 10 : 30} scale={[10, 1, 5]} position={[0, 0.4, 1.5]} size={3} speed={0.2} color="#9fe7ff" />
    </group>
  );
}
