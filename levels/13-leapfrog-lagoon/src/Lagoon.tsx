import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Water, seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

export const PAD_GAP = 1.42;
export const padX = (i: number) => (i - 3) * PAD_GAP;
/** Top of a lily pad, where frogs sit. */
export const PAD_TOP = 0.07;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Height of the shore at (x, z). The lagoon water is at y = 0 between z = -3.4 and z = 3.6. */
export function shoreHeight(x: number, z: number) {
  const back = smooth(-3.0, -4.2, z) * 0.75 + smooth(-7, -14, z) * 2.2;
  const front = smooth(3.4, 4.4, z) * 0.6;
  const sides = smooth(9, 14, Math.abs(x)) * 1.2;
  const bumps = Math.sin(x * 0.9 + z * 0.4) * 0.12 + Math.sin(x * 2.3 - z * 1.7) * 0.05;
  return -0.7 + back + front + sides + bumps * (back + front > 0.3 ? 1 : 0);
}

function Shore() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(44, 34, 110, 85);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -4);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const mossA = new THREE.Color('#3f7d4a');
    const mossB = new THREE.Color('#2a5c45');
    const sand = new THREE.Color('#c9b07a');
    const mud = new THREE.Color('#3b4a3a');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = shoreHeight(x, z);
      pos.setY(i, y);
      c.copy(mossA).lerp(mossB, 0.5 + 0.5 * Math.sin(x * 0.7 + z * 1.1));
      if (y < 0.15) c.lerp(sand, smooth(0.15, 0.0, y));
      if (y < -0.1) c.lerp(mud, smooth(-0.1, -0.4, y));
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

/** One notched lily pad. Its dip value (set when a frog lands) makes it bounce in the water. */
function Pad({ index, dips }: { index: number; dips: MutableRefObject<number[]> }) {
  const ref = useRef<THREE.Group>(null);
  const x = padX(index);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const since = (performance.now() - (dips.current[index] ?? -1e9)) / 1000;
    const dip = since < 1.4 ? -Math.sin(since * 11) * Math.exp(-since * 3.2) * 0.09 : 0;
    g.position.y = Math.sin(t * 1.3 + index * 0.9) * 0.018 + dip;
    g.rotation.x = Math.sin(t * 1.1 + index) * 0.03 + dip * 0.6;
    g.rotation.z = Math.cos(t * 0.9 + index * 1.3) * 0.03;
  });
  const rot = (index * 2.39) % (Math.PI * 2);
  return (
    <group position={[x, 0, 0]}>
      <group ref={ref}>
        <mesh rotation-y={rot} position-y={0.02} material={toon(index % 2 ? '#3fa356' : '#47b061')} castShadow receiveShadow>
          <cylinderGeometry args={[0.6, 0.62, 0.06, 22, 1, false, 0.35, Math.PI * 2 - 0.7]} />
        </mesh>
        {/* Veins */}
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} rotation-y={rot + 0.35 + ((k + 0.5) / 5) * (Math.PI * 2 - 0.7) + Math.PI / 2} position-y={0.053} material={toon('#7fd38a')}>
            <boxGeometry args={[0.02, 0.005, 0.5]} />
          </mesh>
        ))}
        {/* A small glowing bud on the rim */}
        <mesh position={[Math.cos(rot + 2.2) * 0.5, 0.08, -Math.sin(rot + 2.2) * 0.5]} material={toon('#ff9ecb', { emissive: '#ff7fbf', emissiveIntensity: 1.6 })}>
          <icosahedronGeometry args={[0.05, 0]} />
        </mesh>
      </group>
    </group>
  );
}

export function LilyPads({ dips }: { dips: MutableRefObject<number[]> }) {
  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => (
        <Pad key={i} index={i} dips={dips} />
      ))}
    </group>
  );
}

/** Instanced glowing mushrooms on the shore. */
function Mushrooms({ count }: { count: number }) {
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const rnd = seeded(31);
    const out: { x: number; z: number; s: number; color: THREE.Color }[] = [];
    const palette = ['#5ef2ff', '#b48cff', '#ff7ad9', '#7dffb0'];
    while (out.length < count) {
      const side = rnd() < 0.7 ? -1 : 1;
      const x = (rnd() - 0.5) * 20;
      const z = side < 0 ? -3.8 - rnd() * 3 : 4.2 + rnd() * 1.2;
      if (side > 0 && Math.abs(x) < 3) continue;
      out.push({ x, z, s: 0.5 + rnd() * 0.9, color: new THREE.Color(palette[out.length % palette.length]) });
    }
    return out;
  }, [count]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    items.forEach((m, i) => {
      const y = shoreHeight(m.x, m.z);
      o.position.set(m.x, y + 0.12 * m.s, m.z);
      o.rotation.set(0, 0, (i % 3) * 0.08 - 0.08);
      o.scale.setScalar(m.s);
      o.updateMatrix();
      stems.current!.setMatrixAt(i, o.matrix);
      o.position.y = y + 0.26 * m.s;
      o.updateMatrix();
      caps.current!.setMatrixAt(i, o.matrix);
      caps.current!.setColorAt(i, m.color);
    });
    stems.current!.instanceMatrix.needsUpdate = true;
    caps.current!.instanceMatrix.needsUpdate = true;
    if (caps.current!.instanceColor) caps.current!.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <group>
      <instancedMesh ref={stems} args={[undefined, undefined, items.length]} material={toon('#e9e2cf')} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.25, 6]} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, items.length]}>
        <sphereGeometry args={[0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Reeds and cattails, swaying, instanced. */
function Reeds({ count }: { count: number }) {
  const blades = useRef<THREE.InstancedMesh>(null);
  const tails = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const rnd = seeded(7);
    const out: { x: number; z: number; h: number; lean: number; ph: number }[] = [];
    while (out.length < count) {
      const left = rnd() < 0.5;
      const x = left ? -5.6 - rnd() * 6 : 5.6 + rnd() * 6;
      const z = -3.6 + rnd() * 7.4;
      out.push({ x, z, h: 0.7 + rnd() * 0.9, lean: (rnd() - 0.5) * 0.4, ph: rnd() * 6 });
    }
    return out;
  }, [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.forEach((r, i) => {
      const y = Math.max(shoreHeight(r.x, r.z), -0.1);
      const sway = Math.sin(t * 1.2 + r.ph) * 0.07;
      o.position.set(r.x, y + r.h / 2, r.z);
      o.rotation.set(sway, 0, r.lean + sway);
      o.scale.set(1, r.h, 1);
      o.updateMatrix();
      blades.current?.setMatrixAt(i, o.matrix);
      if (i % 2 === 0) {
        o.position.set(r.x + Math.sin(r.lean + sway) * -r.h * 0.5, y + r.h * 0.98, r.z + Math.sin(sway) * r.h * 0.5);
        o.scale.setScalar(1);
        o.updateMatrix();
        tails.current?.setMatrixAt(i / 2, o.matrix);
      }
    });
    if (blades.current) blades.current.instanceMatrix.needsUpdate = true;
    if (tails.current) tails.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={blades} args={[undefined, undefined, items.length]} material={toon('#5f9f4a')} castShadow frustumCulled={false}>
        <coneGeometry args={[0.035, 1, 4]} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[undefined, undefined, Math.ceil(items.length / 2)]} material={toon('#7a4a2a')} frustumCulled={false}>
        <capsuleGeometry args={[0.045, 0.16, 2, 6]} />
      </instancedMesh>
    </group>
  );
}

/** A paper lantern on a bent pole, glowing warm. */
function Lantern({ position, high, color = '#ffb347', seed = 0 }: { position: [number, number, number]; high: boolean; color?: string; seed?: number }) {
  const swing = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (swing.current) swing.current.rotation.z = Math.sin(t * 1.4) * 0.08;
    if (light.current) light.current.intensity = 4 + Math.sin(t * 6) * 0.3 + Math.sin(t * 11) * 0.2;
  });
  const wood = toon('#4a3326');
  return (
    <group position={position}>
      <mesh position-y={0.9} material={wood} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1.8, 6]} />
      </mesh>
      <mesh position={[0.22, 1.78, 0]} rotation-z={Math.PI / 2.4} material={wood}>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 5]} />
      </mesh>
      <group ref={swing} position={[0.42, 1.82, 0]}>
        <mesh position-y={-0.12} material={toon('#2b2b2b')}>
          <cylinderGeometry args={[0.006, 0.006, 0.24, 3]} />
        </mesh>
        <mesh position-y={-0.38} scale={[1, 1.25, 1]} material={toon('#ffe1a8', { emissive: color, emissiveIntensity: 2.6, flat: false })}>
          <sphereGeometry args={[0.17, 14, 10]} />
        </mesh>
        <mesh position-y={-0.17} material={wood}>
          <cylinderGeometry args={[0.08, 0.1, 0.05, 8]} />
        </mesh>
        <mesh position-y={-0.6} material={wood}>
          <cylinderGeometry args={[0.1, 0.08, 0.05, 8]} />
        </mesh>
        {high && <pointLight ref={light} position-y={-0.38} color={color} intensity={4} distance={6} decay={1.7} />}
      </group>
    </group>
  );
}

/** A droopy willow-like tree. */
function Willow({ position, scale = 1, seed = 0 }: { position: [number, number, number]; scale?: number; seed?: number }) {
  const top = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (top.current) top.current.rotation.z = Math.sin(clock.elapsedTime * 0.6 + seed) * 0.025;
  });
  const leaf = toon(seed % 2 ? '#2f6e5a' : '#3a7d55');
  const leafDark = toon('#24584a');
  return (
    <group position={position} scale={scale}>
      <mesh position-y={1.1} rotation-z={0.08} material={toon('#4b3a2e')} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 2.2, 7]} />
      </mesh>
      <group ref={top} position-y={2.3}>
        <mesh scale={[1.5, 0.9, 1.3]} material={leaf} castShadow>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * Math.PI * 2 + seed;
          return (
            <mesh key={k} position={[Math.cos(a) * 1.2, -0.7, Math.sin(a) * 0.95]} rotation={[Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]} material={k % 2 ? leaf : leafDark} castShadow>
              <coneGeometry args={[0.45, 1.6, 6]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Floating lotus flowers drifting around the edges of the lagoon. */
function Lotuses() {
  const defs = useMemo(
    () => [
      { x: -6.3, z: 1.6, c: '#ff8fc8' },
      { x: 6.8, z: -1.2, c: '#ffd0f0' },
      { x: -2.4, z: 2.6, c: '#ffb3d9' },
      { x: 3.1, z: -2.6, c: '#ff8fc8' },
      { x: 7.3, z: 2.3, c: '#c9a8ff' },
    ],
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = Math.sin(t * 1.2 + i) * 0.02;
      g.rotation.y = t * 0.1 + i;
    });
  });
  return (
    <group>
      {defs.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]}>
          <group ref={(g) => void (refs.current[i] = g)}>
            <mesh position-y={0.01} material={toon('#3c9a52')}>
              <cylinderGeometry args={[0.38, 0.4, 0.04, 14, 1, false, 0.3, Math.PI * 2 - 0.6]} />
            </mesh>
            {Array.from({ length: 7 }, (_, k) => {
              const a = (k / 7) * Math.PI * 2;
              return (
                <mesh key={k} position={[Math.cos(a) * 0.09, 0.1, Math.sin(a) * 0.09]} rotation={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]} material={toon(d.c, { emissive: d.c, emissiveIntensity: 0.7 })}>
                  <coneGeometry args={[0.06, 0.2, 4]} />
                </mesh>
              );
            })}
            <mesh position-y={0.12} material={toon('#fff2a8', { emissive: '#ffe066', emissiveIntensity: 2.5 })}>
              <icosahedronGeometry args={[0.045, 0]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function Rocks() {
  const defs = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: 9 }, (_, i) => {
      const x = (i < 5 ? -1 : 1) * (5.3 + rnd() * 4);
      const z = -3.4 + rnd() * 7;
      return { p: [x, Math.max(shoreHeight(x, z), -0.25), z] as [number, number, number], s: 0.3 + rnd() * 0.5, r: rnd() * 6 };
    });
  }, []);
  return (
    <group>
      {defs.map((d, i) => (
        <mesh key={i} position={d.p} rotation={[d.r, d.r * 2, 0]} scale={[d.s * 1.3, d.s * 0.8, d.s]} material={toon(i % 2 ? '#6c7a80' : '#58666e')} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** The big round moon low over the trees. */
function Moon() {
  return (
    <group position={[-9, 9, -30]}>
      <mesh>
        <sphereGeometry args={[2.2, 24, 18]} />
        <meshBasicMaterial color="#fff6d8" toneMapped={false} fog={false} />
      </mesh>
      <mesh scale={1.6}>
        <sphereGeometry args={[2.2, 16, 12]} />
        <meshBasicMaterial color="#ffe9b0" transparent opacity={0.12} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

export function Lagoon({ dips }: { dips: MutableRefObject<number[]> }) {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <Moon />
      <Shore />
      <group rotation-y={Math.PI / 2} position={[0, 0, 0.1]}>
        <Water width={7.4} length={44} shallow="#1f7385" deep="#0a2440" foam="#7fcfe0" flow={0.08} waveHeight={0.025} segments={high ? 160 : 70} />
      </group>
      <LilyPads dips={dips} />
      <Lotuses />
      <Rocks />
      <Reeds count={high ? 70 : 34} />
      <Mushrooms count={high ? 26 : 14} />
      <Lantern position={[-4.6, shoreHeight(-4.6, -3.9), -3.9]} high={high} seed={0} />
      <Lantern position={[1.2, shoreHeight(1.2, -4.1), -4.1]} high={high} color="#ff9ad5" seed={1.3} />
      <Lantern position={[5.4, shoreHeight(5.4, -3.8), -3.8]} high={high} color="#9be7ff" seed={2.1} />
      <Willow position={[-7.6, shoreHeight(-7.6, -5.4), -5.4]} scale={1.25} seed={1} />
      <Willow position={[7.9, shoreHeight(7.9, -5.8), -5.8]} scale={1.4} seed={2} />
      <Willow position={[-2.6, shoreHeight(-2.6, -8.2), -8.2]} scale={1.1} seed={3} />
      <Willow position={[3.6, shoreHeight(3.6, -9), -9]} scale={1.3} seed={4} />
      <Sparkles count={high ? 70 : 28} scale={[18, 2.6, 8]} position={[0, 1.4, -0.6]} size={5} speed={0.35} color="#fff3a0" opacity={0.9} noise={1} />
      <Sparkles count={high ? 30 : 12} scale={[14, 1.2, 5]} position={[0, 0.5, 0]} size={3} speed={0.25} color="#a8ffe0" opacity={0.8} />
    </group>
  );
}
