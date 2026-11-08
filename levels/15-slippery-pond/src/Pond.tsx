import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CELL, HALF, WATER_Y, cellPos } from './layout';
import { BASKET, cellsOf } from './rules';

const HOLES = cellsOf('H');
const ROCKS = cellsOf('R');
const SNOW = cellsOf('S');
const HOLE_R = 0.44;

// ---------------------------------------------------------------- ice sheet

/** Glossy ice with frosted tile seams, cracks, sparkles and holes cut out. */
function useIceMaterial() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHoles: { value: HOLES.map((h) => new THREE.Vector2(cellPos(h.x, h.y)[0], cellPos(h.x, h.y)[2])) },
      uCell: { value: CELL },
      uHalf: { value: HALF },
    }),
    [],
  );
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#cfefff', roughness: 0.12, metalness: 0.05, envMapIntensity: 1.4 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vIce;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIce = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          varying vec3 vIce;
          uniform float uTime;
          uniform float uCell;
          uniform float uHalf;
          uniform vec2 uHoles[${HOLES.length}];
          float iHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          vec2 iHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
          float iNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(iHash(i), iHash(i + vec2(1, 0)), u.x), mix(iHash(i + vec2(0, 1)), iHash(i + vec2(1, 1)), u.x), u.y);
          }
          // distance to the nearest voronoi edge: thin white crack lines
          float iCrack(vec2 p) {
            vec2 n = floor(p), f = fract(p);
            vec2 mg, mr; float md = 8.0;
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j)); vec2 o = iHash2(n + g); vec2 r = g + o - f;
              float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; }
            }
            md = 8.0;
            for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
              vec2 g = mg + vec2(float(i), float(j)); vec2 o = iHash2(n + g); vec2 r = g + o - f;
              if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
            }
            return md;
          }`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `#include <map_fragment>
          vec2 P = vIce.xz;
          // holes in the ice, with a ragged edge
          float holeRim = 0.0;
          for (int i = 0; i < ${HOLES.length}; i++) {
            vec2 d = P - uHoles[i];
            float a = atan(d.y, d.x);
            float rad = ${HOLE_R.toFixed(2)} + sin(a * 7.0 + float(i) * 2.0) * 0.025 + sin(a * 13.0) * 0.015;
            float dist = length(d);
            if (dist < rad) discard;
            holeRim = max(holeRim, 1.0 - smoothstep(0.03, 0.16, dist - rad));
          }
          // deep clear ice in the middle, frosty white at the snowy rim
          float edge = max(abs(P.x), abs(P.y)) / uHalf;
          float frost = iNoise(P * 2.3) * 0.6 + iNoise(P * 7.0) * 0.4;
          vec3 deep = vec3(0.3, 0.64, 0.98);
          vec3 pale = vec3(0.86, 0.96, 1.0);
          vec3 ice = mix(deep, pale, smoothstep(0.25, 0.95, frost * 0.7 + edge * 0.45));
          // soft tile seams so the grid is easy to read
          vec2 g = abs(fract(P / uCell + 0.5) - 0.5) * uCell;
          float seam = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
          ice = mix(ice, vec3(0.95, 0.99, 1.0), seam * 0.55);
          // cracks
          float c = iCrack(P * 0.9 + 3.1);
          float c2 = iCrack(P * 2.2 - 1.7);
          ice = mix(ice, vec3(1.0), (1.0 - smoothstep(0.0, 0.025, c)) * 0.5 + (1.0 - smoothstep(0.0, 0.015, c2)) * 0.25);
          // trapped bubbles
          float bub = smoothstep(0.93, 0.98, iNoise(P * 11.0)) * 0.6;
          ice = mix(ice, vec3(1.0), bub);
          ice = mix(ice, vec3(1.0), holeRim);
          diffuseColor.rgb = ice;
          `,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
          // twinkling frost sparkles and a cool inner glow
          vec2 sp = floor(P * 9.0);
          float tw = iHash(sp);
          float spark = step(0.965, tw) * pow(max(0.0, sin(uTime * (1.5 + tw * 3.0) + tw * 40.0)), 12.0);
          vec2 sf = fract(P * 9.0) - 0.5;
          spark *= 1.0 - smoothstep(0.0, 0.12, length(sf));
          totalEmissiveRadiance += vec3(0.8, 0.95, 1.0) * spark * 3.0 + vec3(0.07, 0.17, 0.32) * (1.0 - edge * 0.6);
          `,
        );
    };
    return m;
  }, [uniforms]);
  useFrame((_, dt) => (uniforms.uTime.value += dt));
  return mat;
}

function IceSheet({ onPick }: { onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const mat = useIceMaterial();
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8fd3f5', roughness: 0.15, transparent: true, opacity: 0.85, emissive: '#2a6fa0', emissiveIntensity: 0.25 }), []);
  const W = HALF * 2 + 0.3;
  return (
    <group>
      <mesh material={mat} rotation-x={-Math.PI / 2} receiveShadow onClick={onPick}>
        <planeGeometry args={[W, W, 1, 1]} />
      </mesh>
      {/* the slab's thick edge, sitting in the water */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} material={side} position={[Math.sin(a) * (W / 2), -0.13, Math.cos(a) * (W / 2)]} rotation-y={a}>
            <boxGeometry args={[W, 0.26, 0.04]} />
          </mesh>
        );
      })}
      {HOLES.map((h, i) => (
        <IceHole key={i} at={cellPos(h.x, h.y)} seed={i} />
      ))}
    </group>
  );
}

/** Inner wall of a hole and a little bobbing ice chunk. */
function IceHole({ at, seed }: { at: [number, number, number]; seed: number }) {
  const chunk = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const c = chunk.current;
    if (!c) return;
    const t = clock.elapsedTime + seed * 2;
    c.position.set(Math.cos(t * 0.4) * 0.2, WATER_Y + 0.02 + Math.sin(t * 2) * 0.012, Math.sin(t * 0.4) * 0.2);
    c.rotation.y = t * 0.3;
  });
  return (
    <group position={at}>
      <mesh position-y={-0.1} material={toon('#3d86c4', { rough: 0.2, emissive: '#1b4f8a', emissiveIntensity: 0.5 })}>
        <cylinderGeometry args={[HOLE_R, HOLE_R * 0.95, 0.2, 18, 1, true]} />
      </mesh>
      <mesh ref={chunk} material={toon('#e9f8ff', { rough: 0.2 })} scale={[1, 0.4, 0.8]}>
        <icosahedronGeometry args={[0.09, 0]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- water

export interface WaterHandle {
  splash(x: number, z: number): void;
}

const waterVert = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const waterFrag = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec4 uSplash; // x, z, start time, strength
  varying vec3 vW;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
  void main() {
    vec2 p = vW.xz;
    float a = n(p * 0.8 + vec2(uTime * 0.12, uTime * 0.05));
    float b = n(p * 1.9 - vec2(uTime * 0.08, uTime * 0.15));
    vec3 nrm = normalize(vec3((a - 0.5) * 0.6, 1.0, (b - 0.5) * 0.6));
    // splash ripples
    float age = uTime - uSplash.z;
    float d = length(p - uSplash.xy);
    float ring = 0.0;
    if (age > 0.0 && age < 3.5) {
      float front = age * 1.6;
      ring = sin((d - front) * 14.0) * exp(-abs(d - front) * 3.0) * exp(-age * 0.9) * uSplash.w;
      nrm.xz += normalize(p - uSplash.xy + 0.0001) * ring * 0.5;
      nrm = normalize(nrm);
    }
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(V, nrm), 0.0), 2.5);
    vec3 deep = vec3(0.03, 0.08, 0.2);
    vec3 shallow = vec3(0.03, 0.1, 0.26);
    float nearIce = 1.0 - smoothstep(0.0, 2.5, max(abs(p.x), abs(p.y)) - ${HALF.toFixed(2)});
    vec3 col = mix(deep, shallow, nearIce * 0.8 + a * 0.2);
    // twilight sky reflection: violet with a pink glow
    vec3 sky = mix(vec3(0.35, 0.3, 0.75), vec3(1.0, 0.6, 0.8), smoothstep(0.3, 1.0, a));
    col = mix(col, sky, fres * 0.55);
    // moon / firefly glints
    float glint = pow(max(0.0, n(p * 6.0 + uTime * 0.3) - 0.72) * 3.6, 6.0);
    col += vec3(1.0, 0.95, 0.7) * glint * 0.7;
    col += vec3(0.8, 0.95, 1.0) * max(ring, 0.0) * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export const LagoonWater = forwardRef<WaterHandle>(function LagoonWater(_, ref) {
  const uniforms = useMemo(
    () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSplash: { value: new THREE.Vector4(0, 0, -99, 0) } }]),
    [],
  );
  useImperativeHandle(ref, () => ({
    splash(x, z) {
      (uniforms.uSplash.value as THREE.Vector4).set(x, z, uniforms.uTime.value, 1);
    },
  }));
  useFrame((_, dt) => (uniforms.uTime.value += dt));
  return (
    <mesh position-y={WATER_Y} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[90, 90, 1, 1]} />
      <shaderMaterial vertexShader={waterVert} fragmentShader={waterFrag} uniforms={uniforms} fog />
    </mesh>
  );
});

// ---------------------------------------------------------------- small helpers

/** One instanced mesh from a list of transforms (and optional colors). */
function Instances({
  items,
  geometry,
  material,
  castShadow,
}: {
  items: { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; c?: string }[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.scale.set(...it.s);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.c) m.setColorAt(i, new THREE.Color(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />;
}

const snowMat = toon('#f4f7ff', { rough: 0.95 });
const snowShade = toon('#dfe6ff', { rough: 0.95 });
const driftMat = toon('#ffffff', { rough: 0.9, emissive: '#cfe0ff', emissiveIntensity: 0.35 });

// ---------------------------------------------------------------- snowy rim

/** Soft snowbanks all around the ice. They are what stops the otter at the edge. */
function SnowRim() {
  const items = useMemo(() => {
    const r = seeded(15);
    const out: { p: [number, number, number]; s: [number, number, number]; r: [number, number, number] }[] = [];
    const L = HALF + 0.3;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 19; i++) {
        const u = -L + (i / 18) * 2 * L + (r() - 0.5) * 0.2;
        const front = side === 0;
        const out_ = L + (r() - 0.5) * 0.12;
        const [x, z] = side === 0 ? [u, out_] : side === 1 ? [out_, u] : side === 2 ? [u, -out_] : [-out_, u];
        const sc = front ? 0.2 + r() * 0.06 : 0.26 + r() * 0.1;
        out.push({ p: [x, -0.02, z], s: [sc * 1.5, sc * (front ? 0.55 : 0.85), sc * 1.3], r: [0, r() * 3, 0] });
      }
    }
    return out;
  }, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  return <Instances items={items} geometry={geo} material={snowMat} castShadow />;
}

// ---------------------------------------------------------------- rocks, snow drifts, basket

const rockMat = toon('#6d7698', { rough: 0.9 });
const rockDark = toon('#525a7a', { rough: 0.9 });

function Rocks() {
  const r = useMemo(() => seeded(7), []);
  const shapes = useMemo(() => ROCKS.map(() => ({ rot: r() * 6, s: 0.85 + r() * 0.25, tilt: (r() - 0.5) * 0.3, shroom: r() > 0.45 })), [r]);
  return (
    <group>
      {ROCKS.map((c, i) => {
        const [x, , z] = cellPos(c.x, c.y);
        const sh = shapes[i];
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, sh.rot, sh.tilt]} scale={sh.s}>
            <mesh material={rockMat} position-y={0.22} scale={[1, 0.78, 0.9]} castShadow receiveShadow>
              <dodecahedronGeometry args={[0.4, 0]} />
            </mesh>
            <mesh material={rockDark} position={[0.25, 0.08, 0.15]} scale={0.45} castShadow>
              <dodecahedronGeometry args={[0.4, 0]} />
            </mesh>
            <mesh material={snowMat} position-y={0.47} scale={[0.95, 0.3, 0.85]} castShadow>
              <icosahedronGeometry args={[0.3, 1]} />
            </mesh>
            {sh.shroom && <Mushroom position={[-0.2, 0.32, 0.22]} color={i % 2 ? '#7cf5ff' : '#ff8ae2'} scale={0.8} />}
          </group>
        );
      })}
    </group>
  );
}

function Mushroom({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh material={toon('#f2ead8', { rough: 0.9 })} position-y={0.06}>
        <cylinderGeometry args={[0.025, 0.035, 0.12, 6]} />
      </mesh>
      <mesh material={toon(color, { emissive: color, emissiveIntensity: 2.6 })} position-y={0.13} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

export interface DriftHandle {
  /** Plow into the drift: it squashes and springs back. */
  hit(index: number): void;
}

/** Soft snow drifts: the otter plows in and stops on them. */
export const SnowDrifts = forwardRef<DriftHandle>(function SnowDrifts(_, ref) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const hitAt = useRef<number[]>(SNOW.map(() => -99));
  useImperativeHandle(ref, () => ({ hit: (i) => (hitAt.current[i] = performance.now()) }));
  useFrame(() => {
    groups.current.forEach((g, i) => {
      if (!g) return;
      const e = (performance.now() - hitAt.current[i]) / 1000;
      const k = e < 1 ? Math.sin(e * 18) * Math.exp(-e * 5) * 0.35 : 0;
      g.scale.set(1 + k, 1 - k, 1 + k);
    });
  });
  return (
    <group>
      {SNOW.map((c, i) => {
        const [x, , z] = cellPos(c.x, c.y);
        return (
          <group key={i} position={[x, 0, z]} ref={(g) => void (groups.current[i] = g)}>
            <mesh material={driftMat} position={[0, 0.02, 0]} scale={[0.5, 0.2, 0.45]} castShadow receiveShadow>
              <icosahedronGeometry args={[1, 2]} />
            </mesh>
            <mesh material={driftMat} position={[0.22, 0.05, -0.12]} scale={[0.25, 0.16, 0.22]} castShadow>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
            <mesh material={driftMat} position={[-0.2, 0.04, 0.18]} scale={[0.22, 0.13, 0.2]} castShadow>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

const wicker = toon('#c98a4b', { rough: 0.9 });
const wickerDark = toon('#8f5a2a', { rough: 0.9 });
const fishColors = ['#ff9f43', '#ff6b9a', '#4dd6c4'];

/** The goal: a wicker basket brimming with fish, with a warm glow. */
export function Basket({ eaten }: { eaten: boolean }) {
  const glow = useRef<THREE.Mesh>(null);
  const fishes = useRef<THREE.Group>(null);
  const low = useSettings((s) => s.quality) === 'low';
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (glow.current) {
      const s = 1 + Math.sin(t * 3) * 0.08;
      glow.current.scale.set(s, s, s);
      (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 3) * 0.12;
    }
    fishes.current?.children.forEach((f, i) => (f.rotation.z = Math.sin(t * 4 + i * 2) * 0.25));
  });
  const [x, , z] = cellPos(BASKET.x, BASKET.y);
  return (
    <group position={[x, 0, z]}>
      <mesh ref={glow} rotation-x={-Math.PI / 2} position-y={0.015}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh material={wicker} position-y={0.2} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.24, 0.4, 14, 3]} />
      </mesh>
      {[0.06, 0.2, 0.34].map((y) => (
        <mesh key={y} material={wickerDark} position-y={y} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.24 + y * 0.2, 0.025, 6, 18]} />
        </mesh>
      ))}
      <mesh material={wickerDark} position-y={0.4} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.33, 0.04, 6, 20]} />
      </mesh>
      <mesh material={wickerDark} position-y={0.42} rotation-z={Math.PI / 2}>
        <torusGeometry args={[0.32, 0.025, 6, 20, Math.PI]} />
      </mesh>
      <group ref={fishes} visible={!eaten}>
        {fishColors.map((c, i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          const m = toon(c, { rough: 0.5, emissive: c, emissiveIntensity: 0.3 });
          return (
            <group key={i} position={[Math.cos(a) * 0.1, 0.44, Math.sin(a) * 0.1]} rotation={[0, -a, 0.5 + i * 0.2]}>
              <mesh material={m} scale={[1.3, 0.7, 0.45]} castShadow>
                <sphereGeometry args={[0.1, 10, 8]} />
              </mesh>
              <mesh material={m} position={[-0.15, 0, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.4]}>
                <coneGeometry args={[0.08, 0.1, 4]} />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* a little lantern on a pole beside the basket */}
      <group position={[0.42, 0, -0.3]}>
        <mesh material={wickerDark} position-y={0.4}>
          <cylinderGeometry args={[0.02, 0.025, 0.8, 6]} />
        </mesh>
        <mesh material={toon('#ffcf6b', { emissive: '#ffb347', emissiveIntensity: 3 })} position-y={0.85}>
          <sphereGeometry args={[0.1, 12, 10]} />
        </mesh>
        {!low && <pointLight position-y={0.85} color="#ffb347" intensity={3} distance={3.5} decay={2} />}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- shore and lagoon dressing

const pineMat = toon('#1f5f5a', { rough: 0.9 });
const trunkMat = toon('#5b3b2a', { rough: 0.9 });

function Shore() {
  const low = useSettings((s) => s.quality) === 'low';
  const { mounds, pines, pineSnow, trunks, pads, flowers, reeds, reedTops, shrooms, caps } = useMemo(() => {
    const r = seeded(42);
    type It = { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; c?: string };
    const mounds: It[] = [];
    const pines: It[] = [];
    const pineSnow: It[] = [];
    const trunks: It[] = [];
    const pads: It[] = [];
    const flowers: It[] = [];
    const reeds: It[] = [];
    const reedTops: It[] = [];
    const shrooms: It[] = [];
    const caps: It[] = [];
    const E = HALF + 0.9;
    // Snowy shore behind and to the left of the ice: the frozen corner of the lagoon.
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const along = -E - 4 + t * (2 * E + 8);
      const back = i % 2 === 0;
      const [x, z] = back ? [along, -E - 0.6 - r() * 1.2] : [-E - 0.6 - r() * 1.2, along * 0.9 + 1];
      mounds.push({ p: [x, -0.25, z], s: [1.1 + r() * 0.6, 0.5 + r() * 0.3, 1.0 + r() * 0.6], r: [0, r() * 3, 0] });
    }
    for (let i = 0; i < 16; i++) {
      const back = i < 10;
      const u = back ? -E - 1 + (i / 9) * (2 * E + 3) : -E + ((i - 10) / 5) * (2 * E);
      const x = back ? u + (r() - 0.5) : -E - 1.4 - r() * 2.2;
      const z = back ? -E - 1.4 - r() * 2.4 : u + (r() - 0.5);
      const h = 1.3 + r() * 1.3;
      trunks.push({ p: [x, 0.15, z], s: [1, h * 0.25, 1] });
      for (let k = 0; k < 3; k++) {
        const y = 0.5 + k * h * 0.28;
        const w = (0.75 - k * 0.2) * (h / 1.8);
        pines.push({ p: [x, y + h * 0.2, z], s: [w, h * 0.4, w], r: [0, r() * 3, 0] });
        pineSnow.push({ p: [x, y + h * 0.33, z], s: [w * 0.75, h * 0.16, w * 0.75], r: [0, r() * 3, 0] });
      }
    }
    // Lily pads and lotus flowers on the open water (front and right).
    for (let i = 0; i < 22; i++) {
      const front = i < 12;
      const x = front ? -E + r() * (2 * E + 3) : E + 0.4 + r() * 3.5;
      const z = front ? E + 0.3 + r() * 2.8 : -E + r() * (2 * E);
      const s = 0.25 + r() * 0.3;
      pads.push({ p: [x, WATER_Y + 0.02, z], s: [s, 1, s], r: [0, r() * 6, 0] });
      if (r() > 0.55) flowers.push({ p: [x + 0.05, WATER_Y + 0.1, z], s: [s * 0.5, s * 0.6, s * 0.5], r: [0, r() * 3, 0], c: r() > 0.5 ? '#ffb3d1' : '#fff0f6' });
    }
    // Reeds and cattails at the water's edge on the right.
    for (let i = 0; i < 18; i++) {
      const x = E + 0.2 + r() * 1.2;
      const z = -E + 0.5 + (i / 17) * (2 * E) + (r() - 0.5) * 0.4;
      const h = 0.7 + r() * 0.7;
      const tilt: [number, number, number] = [(r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25];
      reeds.push({ p: [x, WATER_Y + h / 2, z], s: [1, h, 1], r: tilt });
      if (r() > 0.4) reedTops.push({ p: [x + tilt[2] * -h * 0.5, WATER_Y + h * 0.92, z + tilt[0] * h * 0.5], s: [1, 1, 1], r: tilt });
    }
    // Glowing mushroom patches on the shore.
    const shroomColors = ['#7cf5ff', '#ff8ae2', '#c4ff6b', '#ffd36b'];
    for (let i = 0; i < 26; i++) {
      const back = r() > 0.45;
      const x = back ? -E + r() * (2 * E) : -E - 0.3 - r() * 1.1;
      const z = back ? -E - 0.35 - r() * 0.9 : -E + r() * (2 * E);
      const s = 0.6 + r() * 0.8;
      shrooms.push({ p: [x, 0.06 * s, z], s: [s, s, s] });
      caps.push({ p: [x, 0.13 * s, z], s: [s, s * 0.6, s], c: shroomColors[i % 4] });
    }
    return { mounds, pines, pineSnow, trunks, pads, flowers, reeds, reedTops, shrooms, caps };
  }, []);

  const g = useMemo(
    () => ({
      mound: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      cone: new THREE.ConeGeometry(1, 1, 7),
      trunk: new THREE.CylinderGeometry(0.07, 0.1, 1, 6),
      pad: new THREE.CylinderGeometry(1, 1, 0.03, 16, 1, false, 0.3, Math.PI * 2 - 0.45),
      flower: new THREE.ConeGeometry(0.5, 0.6, 6),
      reed: new THREE.CylinderGeometry(0.015, 0.02, 1, 4),
      reedTop: new THREE.CapsuleGeometry(0.04, 0.16, 3, 6),
      stem: new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6),
      cap: new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    }),
    [],
  );
  const m = useMemo(
    () => ({
      pad: toon('#3fae6a', { rough: 0.7 }),
      flower: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff8cc0', emissiveIntensity: 0.6, roughness: 0.7, flatShading: true }),
      reed: toon('#7fbf5a'),
      reedTop: toon('#a8693c'),
      stem: toon('#f2ead8'),
      cap: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.6, toneMapped: true }),
    }),
    [],
  );
  // Instance colors multiply the material color; for the caps' glow we also want per-instance emissive,
  // so tint the emissive via the instance color in the shader.
  useMemo(() => {
    m.cap.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif',
      );
    };
    m.flower.onBeforeCompile = m.cap.onBeforeCompile;
  }, [m]);

  return (
    <group>
      <Instances items={mounds} geometry={g.mound} material={snowMat} />
      <Instances items={trunks} geometry={g.trunk} material={trunkMat} castShadow />
      <Instances items={pines} geometry={g.cone} material={pineMat} castShadow />
      <Instances items={pineSnow} geometry={g.cone} material={snowMat} />
      <Instances items={pads} geometry={g.pad} material={m.pad} />
      <Instances items={flowers} geometry={g.flower} material={m.flower} />
      <Instances items={reeds} geometry={g.reed} material={m.reed} />
      <Instances items={reedTops} geometry={g.reedTop} material={m.reedTop} />
      <Instances items={shrooms} geometry={g.stem} material={m.stem} />
      <Instances items={caps} geometry={g.cap} material={m.cap} />
      <Igloo position={[-HALF - 2.1, 0, -HALF - 1.2]} />
      <Lantern position={[-HALF - 0.75, 0, HALF - 0.6]} light={!low} />
      <Lantern position={[HALF + 0.9, 0, -HALF - 0.6]} light={!low} />
      <Moon />
    </group>
  );
}

/** The otter's little snow house. */
function Igloo({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={0.7}>
      <mesh material={snowMat} castShadow receiveShadow>
        <sphereGeometry args={[0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={snowShade} position={[0, 0.25, 0.8]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.5, 12, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh material={toon('#ffb35c', { emissive: '#ff9d3a', emissiveIntensity: 2.2 })} position={[0, 0.2, 1.04]}>
        <circleGeometry args={[0.24, 14, 0, Math.PI]} />
      </mesh>
    </group>
  );
}

function Lantern({ position, light }: { position: [number, number, number]; light: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.08;
  });
  return (
    <group position={position}>
      <mesh material={trunkMat} position-y={0.6}>
        <cylinderGeometry args={[0.035, 0.05, 1.2, 6]} />
      </mesh>
      <mesh material={trunkMat} position={[0.18, 1.18, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 5]} />
      </mesh>
      <group ref={ref} position={[0.34, 1.16, 0]}>
        <mesh material={toon('#ff7a5c', { emissive: '#ff8a4a', emissiveIntensity: 2.6 })} position-y={-0.2} scale={[1, 1.25, 1]}>
          <sphereGeometry args={[0.15, 12, 10]} />
        </mesh>
        {light && <pointLight position-y={-0.2} color="#ff9a5a" intensity={4} distance={5} decay={2} />}
      </group>
    </group>
  );
}

function Moon() {
  return (
    <group position={[9, 9, -32]}>
      <mesh>
        <circleGeometry args={[2.2, 40]} />
        <meshBasicMaterial color="#fff6d8" toneMapped={false} fog={false} />
      </mesh>
      <mesh position-z={-0.1}>
        <circleGeometry args={[3.6, 40]} />
        <meshBasicMaterial color="#c9b8ff" transparent opacity={0.18} toneMapped={false} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- fireflies

function Fireflies() {
  const low = useSettings((s) => s.quality) === 'low';
  const count = low ? 18 : 48;
  const ref = useRef<THREE.InstancedMesh>(null);
  const flies = useMemo(() => {
    const r = seeded(99);
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * 16,
      z: (r() - 0.5) * 14 - 1,
      y: 0.5 + r() * 2.2,
      s: 0.5 + r() * 1.2,
      p: r() * 10,
    }));
  }, [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    flies.forEach((f, i) => {
      o.position.set(f.x + Math.sin(t * 0.3 * f.s + f.p) * 1.2, f.y + Math.sin(t * 0.9 * f.s + f.p * 2) * 0.3, f.z + Math.cos(t * 0.25 * f.s + f.p) * 1.2);
      o.scale.setScalar(0.5 + Math.max(0, Math.sin(t * 2 * f.s + f.p)) * 0.8);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.035, 6, 4]} />
      <meshBasicMaterial color={[2.6, 3.2, 1.1]} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- the whole pond

export function Pond({ onPick, water, drifts, eaten }: { onPick: (e: ThreeEvent<MouseEvent>) => void; water: React.Ref<WaterHandle>; drifts: React.Ref<DriftHandle>; eaten: boolean }) {
  return (
    <group>
      <LagoonWater ref={water} />
      <IceSheet onPick={onPick} />
      <SnowRim />
      <Rocks />
      <SnowDrifts ref={drifts} />
      <Basket eaten={eaten} />
      <Shore />
      <Fireflies />
    </group>
  );
}
