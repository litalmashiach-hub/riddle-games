import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Island centers and size. The island tops are flat at y = 0. */
export const ISLAND_X = 5.1;
export const ISLAND_R = 3.0;
/** Where the balloon moors, at the end of each island's dock. */
export const DOCK_X = 1.95;

const sideSign = (s: 'L' | 'R') => (s === 'L' ? -1 : 1);

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
/** Smooth periodic noise around a circle, in 0..1. */
function ringNoise(angle: number, seed: number, freq = 5) {
  const x = ((angle / (Math.PI * 2)) * freq + freq) % freq;
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i + seed * 13.1) * (1 - u) + hash(((i + 1) % freq) + seed * 13.1) * u;
}

/** Grass top plus a jagged, layered rock underside, as two vertex-colored meshes. */
function useIslandGeometry(radius: number, depth: number, seed: number) {
  return useMemo(() => {
    const segs = 36;
    const edge = (a: number) => 1 + (ringNoise(a, seed, 7) - 0.5) * 0.16 + (ringNoise(a, seed + 3, 13) - 0.5) * 0.06;
    const lip = 0.42;

    const top = new THREE.CylinderGeometry(radius, radius * 0.94, lip, segs, 2);
    top.translate(0, -lip / 2, 0);
    const tp = top.attributes.position as THREE.BufferAttribute;
    const tn = top.attributes.normal as THREE.BufferAttribute;
    const tc = new Float32Array(tp.count * 3);
    const grass = new THREE.Color('#8fd16a');
    const grass2 = new THREE.Color('#6fbf5a');
    const lipGrass = new THREE.Color('#5aa84a');
    const dirt = new THREE.Color('#b9875a');
    const c = new THREE.Color();
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 0.001) {
        const a = Math.atan2(x, z);
        const k = edge(a);
        tp.setX(i, x * k);
        tp.setZ(i, z * k);
      }
      if (tn.getY(i) > 0.5) c.copy(grass).lerp(grass2, hash(i * 0.37 + seed) * 0.6);
      else c.copy(lipGrass).lerp(dirt, Math.min(1, -y / lip) ** 0.8);
      tc.set([c.r, c.g, c.b], i * 3);
    }
    top.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    top.computeVertexNormals();

    const rock = new THREE.ConeGeometry(radius * 0.94, depth, segs, 7, true);
    rock.rotateX(Math.PI);
    rock.translate(0, -lip - depth / 2, 0);
    const rp = rock.attributes.position as THREE.BufferAttribute;
    const rc = new Float32Array(rp.count * 3);
    const strata = ['#c9a27a', '#a77b5c', '#8d6a7e', '#b58c6c', '#7a5c78'].map((s) => new THREE.Color(s));
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
      const a = Math.atan2(x, z);
      const t = (-lip - y) / depth; // 0 at the top, 1 at the tip
      const jag = t < 0.02 ? 1 : 1 + (hash(i * 1.31 + seed * 7) - 0.5) * 0.35 * t + (ringNoise(a, seed + 5, 9) - 0.5) * 0.3;
      const k = edge(a) * jag;
      rp.setX(i, x * k);
      rp.setZ(i, z * k);
      if (t > 0.98) rp.setY(i, y - hash(seed) * 0.6);
      const band = Math.floor(t * 6 + ringNoise(a, seed + 9, 5) * 1.4);
      c.copy(strata[band % strata.length]);
      if (t < 0.08) c.lerp(dirt, 0.6);
      rc.set([c.r, c.g, c.b], i * 3);
    }
    rock.setAttribute('color', new THREE.BufferAttribute(rc, 3));
    rock.computeVertexNormals();
    return { top, rock, edge };
  }, [radius, depth, seed]);
}

/** Glowing crystals hanging from an island's underside. One draw call. */
function Crystals({ radius, depth, seed, count }: { radius: number; depth: number; seed: number; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(seed * 31 + 1);
    const o = new THREE.Object3D();
    const cols = ['#7df9ff', '#ff9ff3', '#b8a1ff'].map((h) => new THREE.Color(h).multiplyScalar(2.6));
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const t = 0.12 + rnd() * 0.55;
      const r = radius * 0.94 * (1 - t) * 0.97;
      o.position.set(Math.sin(a) * r, -0.42 - t * depth, Math.cos(a) * r);
      o.rotation.set(Math.PI + (rnd() - 0.5) * 0.6, a, (rnd() - 0.5) * 0.6);
      const s = 0.12 + rnd() * 0.2;
      o.scale.set(s, s * (2 + rnd() * 1.5), s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, cols[i % cols.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [radius, depth, seed, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Grass tufts and flowers on top of an island. */
function Meadow({ radius, seed, count, keepOut }: { radius: number; seed: number; count: number; keepOut?: (x: number, z: number) => boolean }) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const rnd = seeded(seed * 7 + 3);
    const o = new THREE.Object3D();
    const greens = ['#6fbf5a', '#9be07a', '#4f9f45'].map((h) => new THREE.Color(h));
    const petals = ['#ffffff', '#ffd166', '#ff8fab', '#c4a7ff', '#7ee0f0'].map((h) => new THREE.Color(h));
    const place = (m: THREE.InstancedMesh | null, n: number, flower: boolean) => {
      if (!m) return;
      let k = 0;
      for (let tries = 0; k < n && tries < n * 8; tries++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * radius * 0.9;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        if (keepOut?.(x, z)) continue;
        o.position.set(x, flower ? 0.07 : 0.08, z);
        o.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.4);
        o.scale.setScalar(flower ? 0.7 + rnd() * 0.6 : 0.6 + rnd() * 0.9);
        o.updateMatrix();
        m.setMatrixAt(k, o.matrix);
        m.setColorAt(k, flower ? petals[k % petals.length] : greens[k % greens.length]);
        k++;
      }
      m.count = k;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    place(grass.current, count, false);
    place(flowers.current, Math.round(count * 0.35), true);
  }, [radius, seed, count, keepOut]);
  return (
    <>
      <instancedMesh ref={grass} args={[undefined, undefined, count]} receiveShadow>
        <coneGeometry args={[0.05, 0.22, 3]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, Math.round(count * 0.35)]}>
        <icosahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial flatShading roughness={0.7} emissive="#332" />
      </instancedMesh>
    </>
  );
}

function PuffTree({ position, scale = 1, color = '#7bc96f', seed = 0 }: { position: [number, number, number]; scale?: number; color?: string; seed?: number }) {
  const top = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (top.current) top.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + seed) * 0.04;
  });
  const leaf = toon(color);
  return (
    <group position={position} scale={scale}>
      <mesh position-y={0.45} rotation-z={0.06} material={toon('#8a5a3c')} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 0.9, 6]} />
      </mesh>
      <group ref={top} position-y={0.9}>
        <mesh position-y={0.35} material={leaf} castShadow>
          <icosahedronGeometry args={[0.55, 0]} />
        </mesh>
        <mesh position={[0.32, 0.12, 0.1]} material={leaf} castShadow>
          <icosahedronGeometry args={[0.36, 0]} />
        </mesh>
        <mesh position={[-0.3, 0.18, -0.08]} material={leaf} castShadow>
          <icosahedronGeometry args={[0.38, 0]} />
        </mesh>
      </group>
    </group>
  );
}

function Windmill({ position }: { position: [number, number, number] }) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 0.9;
  });
  const wall = toon('#fff4e0');
  const roof = toon('#ff7f6e');
  const wood = toon('#9a6334');
  return (
    <group position={position} rotation-y={-0.5}>
      <mesh position-y={0.7} material={wall} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.5, 1.4, 8]} />
      </mesh>
      <mesh position-y={1.65} material={roof} castShadow>
        <coneGeometry args={[0.48, 0.55, 8]} />
      </mesh>
      <mesh position={[0, 0.3, 0.46]} material={wood}>
        <boxGeometry args={[0.24, 0.42, 0.06]} />
      </mesh>
      <mesh position={[0, 0.95, 0.4]} material={toon('#ffe8a3', { emissive: '#ffcf56', emissiveIntensity: 1.5 })}>
        <boxGeometry args={[0.16, 0.16, 0.04]} />
      </mesh>
      <group ref={blades} position={[0, 1.3, 0.48]}>
        <mesh material={wood}>
          <cylinderGeometry args={[0.06, 0.06, 0.1, 8]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation-z={(i * Math.PI) / 2}>
            <mesh position={[0, 0.5, 0.02]} material={wood}>
              <boxGeometry args={[0.05, 0.9, 0.03]} />
            </mesh>
            <mesh position={[0.1, 0.55, 0.03]} material={toon('#fff8ec')} castShadow>
              <boxGeometry args={[0.18, 0.7, 0.015]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** A birdhouse on a pole, home of the sky birds. */
function Birdhouse({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={0.5}>
      <mesh position-y={0.55} material={toon('#9a6334')} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1.1, 6]} />
      </mesh>
      <mesh position-y={1.3} material={toon('#7ec8e3')} castShadow>
        <boxGeometry args={[0.55, 0.5, 0.5]} />
      </mesh>
      <mesh position-y={1.66} rotation-y={Math.PI / 4} material={toon('#ffc93c')} castShadow>
        <coneGeometry args={[0.48, 0.35, 4]} />
      </mesh>
      <mesh position={[0, 1.33, 0.26]} rotation-x={Math.PI / 2} material={toon('#2b2440')}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 12]} />
      </mesh>
      <mesh position={[0, 1.18, 0.3]} rotation-z={Math.PI / 2} material={toon('#9a6334')}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 4]} />
      </mesh>
    </group>
  );
}

const waterfallVertex = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const waterfallFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float lane = floor(vUv.x * 14.0);
    float speed = 1.4 + hash(vec2(lane, 1.0)) * 0.8;
    float streak = fract(vUv.y * 3.0 + uTime * speed + hash(vec2(lane, 3.0)));
    vec3 col = mix(vec3(0.45, 0.8, 1.0), vec3(1.0), smoothstep(0.55, 0.95, streak));
    float side = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    float fade = smoothstep(0.0, 0.6, vUv.y);
    gl_FragColor = vec4(col * 1.15, side * fade * 0.85);
    #include <fog_fragment>
  }
`;

function Waterfall({ position, rotationY, height = 4.5 }: { position: [number, number, number]; rotationY: number; height?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]), []);
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <group position={position} rotation-y={rotationY}>
      {/* a little stream on top leading to the edge */}
      <mesh position={[0, 0.012, -0.55]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial color="#5cc8f0" roughness={0.15} metalness={0.1} emissive="#2a8fd0" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.012, -1.25]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.5, 16]} />
        <meshStandardMaterial color="#5cc8f0" roughness={0.15} metalness={0.1} emissive="#2a8fd0" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, -height / 2 + 0.02, 0.08]}>
        <planeGeometry args={[0.8, height]} />
        <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={waterfallVertex} fragmentShader={waterfallFragment} transparent depthWrite={false} fog side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface IslandProps {
  position: [number, number, number];
  radius?: number;
  depth?: number;
  seed: number;
  crystals?: number;
  meadow?: number;
  keepOut?: (x: number, z: number) => boolean;
  children?: React.ReactNode;
}

/** One floating island. Everything in `children` sits on its flat top (y = 0). */
export function FloatingIsland({ position, radius = ISLAND_R, depth = 3.6, seed, crystals = 10, meadow = 70, keepOut, children }: IslandProps) {
  const { top, rock } = useIslandGeometry(radius, depth, seed);
  return (
    <group position={position}>
      <mesh geometry={top} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={rock} castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
      {crystals > 0 && <Crystals radius={radius} depth={depth} seed={seed} count={crystals} />}
      {meadow > 0 && <Meadow radius={radius} seed={seed} count={meadow} keepOut={keepOut} />}
      {children}
    </group>
  );
}

/** A wooden dock reaching from an island's edge toward the gap, where the balloon moors. */
function Dock({ side }: { side: 'L' | 'R' }) {
  const s = sideSign(side);
  const wood = toon('#b07a45');
  const dark = toon('#6d4223');
  const glow = toon('#ffe9a8', { emissive: '#ffc35a', emissiveIntensity: 3 });
  const inner = DOCK_X - 0.75;
  const outer = ISLAND_X - ISLAND_R + 0.6;
  const len = outer - inner;
  const planks = 6;
  return (
    <group>
      {Array.from({ length: planks }, (_, i) => {
        const x = s * (inner + (len / planks) * (i + 0.5));
        return (
          <mesh key={i} position={[x, -0.03, 0]} rotation-y={i % 2 ? 0.02 : -0.02} material={wood} castShadow receiveShadow>
            <boxGeometry args={[len / planks - 0.03, 0.08, 1.5]} />
          </mesh>
        );
      })}
      {/* support beams under the dock */}
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} position={[s * (inner + len / 2), -0.12, z]} material={dark} castShadow>
          <boxGeometry args={[len, 0.1, 0.1]} />
        </mesh>
      ))}
      {/* lantern posts at the dock's end */}
      {[-0.7, 0.7].map((z) => (
        <group key={z} position={[s * (inner + 0.08), 0, z]}>
          <mesh position-y={0.35} material={dark} castShadow>
            <cylinderGeometry args={[0.035, 0.045, 0.7, 6]} />
          </mesh>
          <mesh position-y={0.76} material={glow}>
            <icosahedronGeometry args={[0.07, 0]} />
          </mesh>
          <mesh position-y={0.86} material={dark}>
            <coneGeometry args={[0.09, 0.1, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Sea of clouds far below, gently drifting. One instanced draw call. */
function CloudSea({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const rnd = seeded(77);
    return Array.from({ length: count }, () => ({
      x: (rnd() - 0.5) * 90,
      y: -8 - rnd() * 4,
      z: -60 + rnd() * 72,
      s: 1.4 + rnd() * 2.6,
      sp: 0.15 + rnd() * 0.25,
    }));
  }, [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const tints = ['#ffffff', '#eef2ff', '#dfe6ff', '#f6e9ff', '#e3f1ff'].map((h) => new THREE.Color(h));
    puffs.forEach((_, i) => m.setColorAt(i, tints[i % tints.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [puffs]);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    puffs.forEach((p, i) => {
      const x = ((p.x + t * p.sp + 45) % 90 + 90) % 90 - 45;
      o.position.set(x, p.y + Math.sin(t * 0.3 + i) * 0.2, p.z);
      o.scale.set(p.s * 1.4, p.s * 0.7, p.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.22} roughness={1} flatShading />
    </instancedMesh>
  );
}

function SkyCloud({ position, scale = 1, speed = 0.12 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += dt * speed;
    if (g.position.x > 45) g.position.x = -45;
  });
  const m = toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[[0, 0, 0, 1.5], [1.4, -0.25, 0.2, 1.1], [-1.4, -0.3, 0, 1.0], [0.5, 0.55, -0.3, 1.0]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} material={m}>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}
    </group>
  );
}

/** Small islands in the distance, bobbing slowly. */
function DistantIsland({ position, scale, seed }: { position: [number, number, number]; scale: number; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.4 + seed) * 0.35;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <FloatingIsland position={[0, 0, 0]} radius={1.6} depth={2.4} seed={seed} crystals={4} meadow={0}>
        <PuffTree position={[0.3, 0, -0.2]} scale={0.9} color={seed % 2 ? '#ffb3c6' : '#7bc96f'} seed={seed} />
      </FloatingIsland>
    </group>
  );
}

const depthFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    vec3 deep = vec3(0.04, 0.1, 0.62);
    vec3 mid = vec3(0.14, 0.26, 0.86);
    vec3 edge = vec3(0.7, 0.8, 1.0); // the world's fog color, so the horizon blends
    vec3 c = mix(deep, mid, smoothstep(0.0, 0.35, d));
    c = mix(c, edge, smoothstep(0.3, 0.8, d));
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** The blue depths far below the cloud sea, so looking down feels high up. */
function SkyDepths() {
  return (
    <mesh position={[0, -34, -20]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[420, 420]} />
      <shaderMaterial vertexShader={rainbowVertex} fragmentShader={depthFragment} fog={false} />
    </mesh>
  );
}

const rainbowFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float t = vUv.y;
    vec3 c = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + t * 0.9));
    float a = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.85, t);
    gl_FragColor = vec4(c, a * 0.28);
  }
`;
const rainbowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** A soft rainbow arc behind the islands. */
function Rainbow() {
  const geo = useMemo(() => new THREE.RingGeometry(20, 23, 64, 1, 0, Math.PI), []);
  // RingGeometry's uv is planar; remap v to the radial position so the bands follow the arc.
  useMemo(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setY(i, (Math.hypot(p.getX(i), p.getY(i)) - 20) / 3);
    uv.needsUpdate = true;
  }, [geo]);
  return (
    <mesh geometry={geo} position={[6, -6, -42]}>
      <shaderMaterial vertexShader={rainbowVertex} fragmentShader={rainbowFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/** A loose flock of tiny birds circling far away. */
function Flock() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((b, i) => {
      const a = t * 0.12 + i * 0.5;
      b.position.set(Math.cos(a) * 9 - 4 + i * 0.6, 7 + Math.sin(t + i) * 0.3 + i * 0.15, -18 + Math.sin(a) * 4);
      b.rotation.y = -a;
      const flap = Math.sin(t * 9 + i) * 0.6;
      (b.children[0] as THREE.Object3D).rotation.z = flap;
      (b.children[1] as THREE.Object3D).rotation.z = -flap;
    });
  });
  const m = toon('#4b4f6b');
  return (
    <group ref={ref}>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i}>
          <mesh material={m} position-x={0.12}>
            <boxGeometry args={[0.25, 0.02, 0.08]} />
          </mesh>
          <mesh material={m} position-x={-0.12}>
            <boxGeometry args={[0.25, 0.02, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Keep the play area of an island (couple spots near the dock) free of flowers. Island-local coordinates. */
const keepPlay = (side: 'L' | 'R') => (x: number, z: number) => {
  const inward = side === 'L' ? x : -x;
  return Math.abs(z) < 1.7 && inward > -0.7;
};
const KEEP_L = keepPlay('L');
const KEEP_R = keepPlay('R');

/**
 * The full Sky Islands diorama: two floating islands with docks, a waterfall, a windmill,
 * a sea of clouds below, distant islands, a rainbow and drifting clouds.
 * Island tops are flat at y = 0, the gap is between x = -DOCK_X and +DOCK_X.
 */
export function SkyIslands() {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <FloatingIsland position={[-ISLAND_X, 0, 0]} seed={2} crystals={high ? 14 : 8} meadow={high ? 90 : 45} keepOut={KEEP_L}>
        <PuffTree position={[-1.4, 0, -1.9]} scale={1.15} color="#ffb3c6" seed={1} />
        <PuffTree position={[0.6, 0, -2.2]} scale={0.85} seed={2} />
        <Birdhouse position={[-2.1, 0, -0.6]} />
        <Waterfall position={[-2.02, 0, 2.47]} rotationY={-0.68} />
      </FloatingIsland>
      <FloatingIsland position={[ISLAND_X, 0, 0]} seed={5} crystals={high ? 14 : 8} meadow={high ? 90 : 45} keepOut={KEEP_R}>
        <Windmill position={[1.5, 0, -1.7]} />
        <PuffTree position={[-0.7, 0, -2.2]} scale={1.0} color="#9ad66b" seed={4} />
        <PuffTree position={[2.3, 0, 0.6]} scale={0.8} color="#ffb3c6" seed={6} />
      </FloatingIsland>
      <Dock side="L" />
      <Dock side="R" />

      <DistantIsland position={[-16, 2.5, -26]} scale={1.6} seed={11} />
      <DistantIsland position={[15, 4.5, -30]} scale={2} seed={12} />
      <DistantIsland position={[-4, 7, -38]} scale={1.3} seed={13} />
      {high && <DistantIsland position={[26, 0, -18]} scale={1.2} seed={14} />}

      <SkyDepths />
      <CloudSea count={high ? 70 : 40} />
      <SkyCloud position={[-14, 11, -28]} scale={1.8} />
      <SkyCloud position={[12, 13, -34]} scale={2.4} speed={0.08} />
      <SkyCloud position={[28, 9, -22]} scale={1.3} speed={0.18} />
      <Rainbow />
      <Flock />
      <Sparkles count={high ? 80 : 30} scale={[18, 4, 8]} position={[0, 1.8, 0]} size={3} speed={0.3} opacity={0.8} color="#fff6c8" />
    </group>
  );
}
