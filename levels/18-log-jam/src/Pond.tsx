import { useFrame } from '@react-three/fiber';
import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CHANNEL_HALF, EXIT_Z, HALF, LAGOON } from './layout';

// ---------------------------------------------------------------------------
// Instanced helper

type Inst = { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; c?: string };

/** Many copies of one mesh in one draw call. */
export function Instances({ items, geometry, material, cast = true }: { items: Inst[]; geometry: THREE.BufferGeometry; material: THREE.Material; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.scale.set(...it.s);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.c) m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, geometry, material]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow />;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const CONE = new THREE.ConeGeometry(1, 1, 5);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 7);
const BALL = new THREE.IcosahedronGeometry(1, 1);
const CAP = (() => {
  const g = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  return g;
})();
const PAD = (() => {
  // A lily pad with its little notch.
  const g = new THREE.CircleGeometry(1, 18, 0.35, Math.PI * 2 - 0.7);
  g.rotateX(-Math.PI / 2);
  return g;
})();

/** Is (x, z) open water: the pond, the channel or the lagoon? */
export function isWater(x: number, z: number, pad = 0) {
  const inPond = Math.abs(x) < HALF + 0.15 + pad && Math.abs(z) < HALF + 0.15 + pad;
  const inChannel = x > 0 && x < LAGOON.x && Math.abs(z - EXIT_Z) < CHANNEL_HALF + pad;
  const inLagoon = Math.hypot(x - LAGOON.x, z - LAGOON.z) < LAGOON.r + pad;
  return inPond || inChannel || inLagoon;
}

// ---------------------------------------------------------------------------
// Water

const waterVertex = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    w.y += sin(w.x * 1.7 + uTime * 1.3) * 0.012 + sin(w.z * 2.1 - uTime * 1.1) * 0.01;
    vWorld = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uHalf;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uGlow;
  uniform vec3 uGrid;
  uniform float uGridOn;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vWorld.xz;
    float n = fbm(p * 0.9 + vec2(uTime * 0.05, -uTime * 0.04));
    float n2 = fbm(p * 2.3 - vec2(uTime * 0.09, uTime * 0.03));
    vec3 col = mix(uDeep, uShallow, smoothstep(0.25, 0.85, n));

    // Moonlit ripples.
    float rip = smoothstep(0.62, 0.7, n2) * (1.0 - smoothstep(0.7, 0.8, n2));
    col += vec3(0.55, 0.75, 1.0) * rip * 0.16;

    // Soft glow pools, as if the fireflies and lanterns light the water.
    float pools = smoothstep(0.55, 1.0, fbm(p * 0.35 + 7.0 + uTime * 0.02));
    col += uGlow * pools * 0.25;

    // A faint grid of cells inside the pond, so you can count the spaces.
    vec2 g = abs(fract(p - uHalf) - 0.5);
    float line = 1.0 - smoothstep(0.455, 0.49, max(g.x, g.y));
    float inPond = step(abs(p.x), uHalf) * step(abs(p.y), uHalf);
    col = mix(col, uGrid, (1.0 - line) * inPond * 0.28 * uGridOn);
    // Dots at the cell centres, like tiny floating seeds.
    float dotC = 1.0 - smoothstep(0.04, 0.07, length(fract(p - uHalf) - 0.5));
    col += uGrid * dotC * inPond * 0.25 * uGridOn;

    // Glints.
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 nrm = normalize(vec3((n2 - 0.5) * 0.6, 1.0, (n - 0.5) * 0.6));
    float fres = pow(1.0 - max(dot(viewDir, nrm), 0.0), 3.0);
    col = mix(col, vec3(0.35, 0.45, 0.75), fres * 0.45);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function PondWater() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uHalf: { value: HALF },
          uDeep: { value: new THREE.Color('#0b2b45') },
          uShallow: { value: new THREE.Color('#1d6b78') },
          uGlow: { value: new THREE.Color('#9cf2a8') },
          uGrid: { value: new THREE.Color('#bff5ff') },
          uGridOn: { value: 1 },
        },
      ]),
    [],
  );
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh position={[2, 0, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[26, 22, 60, 50]} />
      <shaderMaterial ref={mat} vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} fog />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Banks: one big mossy slab with the pond, the channel and the lagoon cut out.

function bankShape() {
  // Shape space is (x, -z) because the slab is rotated flat.
  const outer = new THREE.Shape();
  outer.absarc(2, 0, 17, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  const E = HALF + 0.15;
  const R = 0.35;
  const z0 = EXIT_Z - CHANNEL_HALF;
  const z1 = EXIT_Z + CHANNEL_HALF;
  const P = (x: number, z: number) => new THREE.Vector2(x, -z);
  const pts: THREE.Vector2[] = [];
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(P(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
  };
  // Clockwise when seen from above, starting at the back-left corner.
  arc(-E + R, -E + R, R, Math.PI, Math.PI * 1.5, 4);
  arc(E - R, -E + R, R, Math.PI * 1.5, Math.PI * 2, 4);
  pts.push(P(E, z0));
  const dx = Math.sqrt(LAGOON.r * LAGOON.r - CHANNEL_HALF * CHANNEL_HALF);
  pts.push(P(LAGOON.x - dx, z0));
  const a0 = Math.atan2(z0 - LAGOON.z, -dx);
  const a1 = Math.atan2(z1 - LAGOON.z, -dx) + Math.PI * 2;
  // Around the far side of the lagoon (through -z, then +x, then +z).
  for (let i = 1; i < 40; i++) {
    const a = a0 + ((a1 - a0) * i) / 40;
    pts.push(P(LAGOON.x + Math.cos(a) * LAGOON.r, LAGOON.z + Math.sin(a) * LAGOON.r));
  }
  pts.push(P(LAGOON.x - dx, z1));
  pts.push(P(E, z1));
  arc(E - R, E - R, R, 0, Math.PI * 0.5, 4);
  arc(-E + R, E - R, R, Math.PI * 0.5, Math.PI, 4);
  h.setFromPoints(pts);
  outer.holes.push(h);
  return outer;
}

function Banks() {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(bankShape(), { depth: 0.5, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.25, 0);
    return g;
  }, []);
  return (
    <mesh geometry={geo} material={toon('#2f6b4a', { rough: 0.95 })} receiveShadow />
  );
}

// ---------------------------------------------------------------------------
// Scenery

function Rocks() {
  const items = useMemo(() => {
    const rnd = seeded(18);
    const out: Inst[] = [];
    const tones = ['#5d6b80', '#4f5d73', '#6c7a8f', '#55657a', '#7a8798'];
    const add = (x: number, z: number, big = 1) => {
      const s = (0.2 + rnd() * 0.17) * big;
      out.push({ p: [x, 0.28 + rnd() * 0.05, z], s: [s * 1.25, s * 0.75, s], r: [rnd(), rnd() * 6, rnd()], c: tones[Math.floor(rnd() * tones.length)] });
    };
    const E = HALF + 0.42;
    for (let t = -E; t <= E; t += 0.46) {
      add(t, -E);
      add(-E, t);
      add(t, E);
      if (Math.abs(t - EXIT_Z) > CHANNEL_HALF + 0.3) add(E, t);
    }
    // Along the lagoon, leaving the channel open.
    for (let a = 0; a < Math.PI * 2; a += 0.27) {
      const x = LAGOON.x + Math.cos(a) * (LAGOON.r + 0.28);
      const z = LAGOON.z + Math.sin(a) * (LAGOON.r + 0.28);
      if (x < LAGOON.x - 1 && Math.abs(z - EXIT_Z) < CHANNEL_HALF + 0.3) continue;
      add(x, z, 0.9);
    }
    // The channel walls.
    for (let x = HALF + 0.6; x < LAGOON.x - 1.7; x += 0.42) {
      add(x, EXIT_Z - CHANNEL_HALF - 0.28, 0.8);
      add(x, EXIT_Z + CHANNEL_HALF + 0.28, 0.8);
    }
    return out;
  }, []);
  return <Instances items={items} geometry={ROCK} material={toon('#ffffff', { rough: 0.9 })} />;
}

/** Spots on the bank for plants: random but never in the water. */
function bankSpots(seed: number, n: number, minR = 0, maxR = 11) {
  const rnd = seeded(seed);
  const out: [number, number][] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const x = 1.5 + (rnd() - 0.5) * 2 * maxR;
    const z = (rnd() - 0.6) * 2 * maxR * 0.8;
    if (isWater(x, z, 0.75)) continue;
    if (Math.hypot(x - 1.5, z) < minR) continue;
    // Keep the front of the view clear so nothing hides the pond.
    if (z > HALF + 1.6) continue;
    out.push([x, z]);
  }
  return out;
}

function Reeds() {
  const quality = useSettings((s) => s.quality);
  const { stems, tops } = useMemo(() => {
    const rnd = seeded(5);
    const stems: Inst[] = [];
    const tops: Inst[] = [];
    // Clumps hugging the water's edge.
    const clumps: [number, number][] = [
      [-HALF - 0.9, -1.8], [-HALF - 0.85, 1.6], [-1.4, -HALF - 0.95], [1.8, -HALF - 0.95],
      [LAGOON.x + 1.2, LAGOON.z - LAGOON.r - 0.6], [LAGOON.x + LAGOON.r + 0.6, LAGOON.z + 0.8], [HALF + 0.95, 2.1],
    ];
    for (const [cx, cz] of clumps) {
      const n = quality === 'high' ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - 0.5) * 0.7;
        const z = cz + (rnd() - 0.5) * 0.5;
        const h = 0.7 + rnd() * 0.7;
        const lean: [number, number, number] = [(rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25];
        stems.push({ p: [x, 0.3 + h / 2, z], s: [0.022, h, 0.022], r: lean, c: rnd() > 0.5 ? '#4f8f4a' : '#3f7a43' });
        if (rnd() > 0.35) tops.push({ p: [x + lean[2] * -h * 0.5, 0.3 + h * 0.98, z + lean[0] * h * 0.5], s: [0.05, 0.17, 0.05], r: lean, c: '#7a4a2a' });
      }
    }
    return { stems, tops };
  }, [quality]);
  return (
    <>
      <Instances items={stems} geometry={CYL} material={toon('#ffffff')} cast={false} />
      <Instances items={tops} geometry={BALL} material={toon('#ffffff')} />
    </>
  );
}

function Grass() {
  const quality = useSettings((s) => s.quality);
  const items = useMemo(() => {
    const rnd = seeded(12);
    const tones = ['#3f8a55', '#4c9a5c', '#357a4d', '#5aa865'];
    return bankSpots(22, quality === 'high' ? 260 : 110, 0, 10).map(([x, z]) => {
      const h = 0.16 + rnd() * 0.22;
      return { p: [x, 0.33 + h / 2, z] as Inst['p'], s: [0.06, h, 0.06] as Inst['s'], r: [(rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4] as Inst['r'], c: tones[Math.floor(rnd() * 4)] };
    });
  }, [quality]);
  return <Instances items={items} geometry={CONE} material={toon('#ffffff')} cast={false} />;
}

/** Twilight trees: stacked cones in deep teal, with a few round bushes. */
function Trees() {
  const { trunks, crowns, bushes } = useMemo(() => {
    const rnd = seeded(77);
    const trunks: Inst[] = [];
    const crowns: Inst[] = [];
    const bushes: Inst[] = [];
    const tones = ['#1f4f4f', '#245a55', '#1b4648', '#2c6458'];
    const spots: [number, number, number][] = [
      [-7.5, -5.5, 1.3], [-5.2, -7.5, 1.1], [-1.5, -8.6, 1.4], [3.5, -8.2, 1.2], [7.5, -6.8, 1.35], [11.2, -4.2, 1.1],
      [12.2, 1.2, 1.25], [-8.8, -1.5, 1.2], [-9.5, 3.2, 1.0], [10.5, 4.6, 0.95], [-3.8, -6.4, 0.8], [9.5, -2.8, 0.75],
    ];
    for (const [x, z, s] of spots) {
      trunks.push({ p: [x, 0.3 + 0.5 * s, z], s: [0.16 * s, 1 * s, 0.16 * s], c: '#4a3426' });
      for (let k = 0; k < 3; k++) {
        crowns.push({ p: [x, 0.3 + (1.3 + k * 0.75) * s, z], s: [(1.25 - k * 0.3) * s, 1.25 * s, (1.25 - k * 0.3) * s], r: [0, rnd() * 6, 0], c: tones[(k + Math.floor(x)) & 3] });
      }
    }
    for (const [x, z] of bankSpots(41, 14, 5.2, 10)) {
      const s = 0.35 + rnd() * 0.35;
      bushes.push({ p: [x, 0.3 + s * 0.5, z], s: [s * 1.2, s, s * 1.2], r: [0, rnd() * 6, 0], c: tones[Math.floor(rnd() * 4)] });
    }
    return { trunks, crowns, bushes };
  }, []);
  return (
    <>
      <Instances items={trunks} geometry={CYL} material={toon('#ffffff')} />
      <Instances items={crowns} geometry={CONE} material={toon('#ffffff')} />
      <Instances items={bushes} geometry={BALL} material={toon('#ffffff')} />
    </>
  );
}

/** Glowing mushrooms: clusters of cyan, pink and gold caps that light up the bloom. */
function Mushrooms() {
  const { stems, caps } = useMemo(() => {
    const rnd = seeded(9);
    const stems: Inst[] = [];
    const caps: Record<string, Inst[]> = { cyan: [], pink: [], gold: [] };
    const clusters: [number, number, keyof typeof caps, number][] = [
      [-HALF - 1.0, -0.4, 'cyan', 1], [-HALF - 1.4, 2.4, 'pink', 0.9], [0.4, -HALF - 1.1, 'gold', 0.9], [-2.6, -HALF - 1.3, 'pink', 1],
      [HALF + 1.0, -2.6, 'cyan', 1], [HALF + 0.9, 1.1, 'pink', 0.8], [LAGOON.x + 0.4, LAGOON.z - LAGOON.r - 0.9, 'cyan', 1.2],
      [LAGOON.x + LAGOON.r + 0.9, LAGOON.z - 0.9, 'gold', 1], [-6, -4, 'cyan', 2.2], [8.6, -4.6, 'pink', 2.4], [-4.5, 1.4, 'gold', 1.6],
    ];
    for (const [cx, cz, kind, big] of clusters) {
      const n = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const s = (0.1 + rnd() * 0.12) * big * (i === 0 ? 1.5 : 1);
        const x = cx + (rnd() - 0.5) * 0.55 * big;
        const z = cz + (rnd() - 0.5) * 0.45 * big;
        const h = s * (1.6 + rnd());
        stems.push({ p: [x, 0.3 + h / 2, z], s: [s * 0.28, h, s * 0.28], c: '#f3ead2' });
        caps[kind].push({ p: [x, 0.3 + h, z], s: [s, s * 0.7, s], r: [(rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3] });
      }
    }
    return { stems, caps };
  }, []);
  return (
    <>
      <Instances items={stems} geometry={CYL} material={toon('#ffffff', { emissive: '#fff4d0', emissiveIntensity: 0.25 })} />
      <Instances items={caps.cyan} geometry={CAP} material={toon('#58f0ff', { emissive: '#36e6ff', emissiveIntensity: 2.6 })} cast={false} />
      <Instances items={caps.pink} geometry={CAP} material={toon('#ff7ad9', { emissive: '#ff4fcf', emissiveIntensity: 2.4 })} cast={false} />
      <Instances items={caps.gold} geometry={CAP} material={toon('#ffd36b', { emissive: '#ffbb33', emissiveIntensity: 2.4 })} cast={false} />
    </>
  );
}

function LilyPads() {
  const { pads, flowers } = useMemo(() => {
    const rnd = seeded(3);
    const pads: Inst[] = [];
    const flowers: Inst[] = [];
    const tones = ['#3f9a52', '#4fae5c', '#368a4c'];
    // In the lagoon, around the edge so the raft has room to park.
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.55 + rnd() * 0.2;
      const rr = LAGOON.r * (0.62 + rnd() * 0.25);
      const x = LAGOON.x + Math.cos(a) * rr;
      const z = LAGOON.z + Math.sin(a) * rr;
      const s = 0.22 + rnd() * 0.16;
      pads.push({ p: [x, 0.025, z], s: [s, 1, s], r: [0, rnd() * 6, 0], c: tones[i % 3] });
      if (i % 3 === 1) flowers.push({ p: [x + 0.04, 0.09, z], s: [0.08, 0.07, 0.08], c: '#ffb3e6' });
    }
    return { pads, flowers };
  }, []);
  return (
    <>
      <Instances items={pads} geometry={PAD} material={toon('#ffffff', { rough: 0.6 })} cast={false} />
      <Instances items={flowers} geometry={BALL} material={toon('#ffc4ee', { emissive: '#ff6fcf', emissiveIntensity: 1.4 })} cast={false} />
    </>
  );
}

/** A paper lantern on a post, with an optional real light on high quality. */
function Lantern({ position, color = '#ffb347', light = false, height = 1.3 }: { position: [number, number, number]; color?: string; light?: boolean; height?: number }) {
  const quality = useSettings((s) => s.quality);
  const lamp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.08;
  });
  return (
    <group position={position}>
      <mesh position-y={height / 2} material={toon('#5a3a26')} castShadow>
        <cylinderGeometry args={[0.045, 0.06, height, 6]} />
      </mesh>
      <mesh position={[0.16, height - 0.02, 0]} rotation-z={Math.PI / 2} material={toon('#5a3a26')}>
        <cylinderGeometry args={[0.025, 0.025, 0.34, 5]} />
      </mesh>
      <group ref={lamp} position={[0.3, height - 0.04, 0]}>
        <mesh position-y={-0.2} material={toon(color, { emissive: color, emissiveIntensity: 2.6 })}>
          <sphereGeometry args={[0.13, 10, 8]} />
        </mesh>
        <mesh position-y={-0.06} material={toon('#3d2a1c')}>
          <cylinderGeometry args={[0.06, 0.08, 0.05, 8]} />
        </mesh>
        <mesh position-y={-0.34} material={toon('#3d2a1c')}>
          <cylinderGeometry args={[0.07, 0.05, 0.04, 8]} />
        </mesh>
        {light && quality === 'high' && <pointLight position-y={-0.2} color={color} intensity={2.2} distance={4.5} decay={2} />}
      </group>
    </group>
  );
}

/** The way out: a gap in the bank, framed by an arch of hanging lanterns and a duck sign. */
function ExitGate() {
  const zA = EXIT_Z - CHANNEL_HALF - 0.42;
  const zB = EXIT_Z + CHANNEL_HALF + 0.42;
  const x = HALF + 0.55;
  const rope = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 1.65, zA), new THREE.Vector3(x, 1.35, EXIT_Z), new THREE.Vector3(x, 1.65, zB));
    return new THREE.TubeGeometry(curve, 16, 0.018, 5, false);
  }, [x, zA, zB]);
  const bulbs = [0.2, 0.4, 0.6, 0.8].map((t) => {
    const z = zA + (zB - zA) * t;
    const y = 1.65 - Math.sin(Math.PI * t) * 0.3 - 0.12;
    return [x, y, z] as [number, number, number];
  });
  const colors = ['#ffd36b', '#ff8fd8', '#7ef0ff', '#ffd36b'];
  return (
    <group>
      {[zA, zB].map((z) => (
        <group key={z} position={[x, 0.3, z]}>
          <mesh position-y={0.7} material={toon('#6a452c')} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 1.4, 6]} />
          </mesh>
          <mesh position-y={1.42} material={toon('#ffd36b', { emissive: '#ffb02e', emissiveIntensity: 2.5 })}>
            <icosahedronGeometry args={[0.1, 0]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={rope} material={toon('#c9a77a')} />
      {bulbs.map((p, i) => (
        <mesh key={i} position={p} material={toon(colors[i], { emissive: colors[i], emissiveIntensity: 2.8 })}>
          <sphereGeometry args={[0.075, 8, 6]} />
        </mesh>
      ))}
      {/* Sign: a wooden arrow with a little duck painted on it. */}
      <group position={[x + 0.15, 0.3, zA - 0.55]} rotation-y={-0.35}>
        <mesh position-y={0.35} material={toon('#6a452c')} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.7, 5]} />
        </mesh>
        <mesh position={[0.05, 0.66, 0]} material={toon('#d9a35f')} castShadow>
          <boxGeometry args={[0.6, 0.24, 0.05]} />
        </mesh>
        <mesh position={[0.42, 0.66, 0]} rotation-z={-Math.PI / 2} material={toon('#d9a35f')}>
          <coneGeometry args={[0.18, 0.18, 3]} />
        </mesh>
        <mesh position={[0.0, 0.66, 0.03]} scale={[1, 0.8, 0.3]} material={toon('#ffd84a')}>
          <sphereGeometry args={[0.08, 8, 6]} />
        </mesh>
        <mesh position={[0.1, 0.71, 0.03]} scale={[1, 1, 0.3]} material={toon('#ffd84a')}>
          <sphereGeometry args={[0.05, 8, 6]} />
        </mesh>
        <mesh position={[0.155, 0.7, 0.035]} scale={[1, 0.5, 0.3]} material={toon('#ff8a2a')}>
          <sphereGeometry args={[0.03, 6, 4]} />
        </mesh>
      </group>
    </group>
  );
}

/** A little dock in the lagoon where the ducklings wait. */
function Dock() {
  const x0 = LAGOON.x + 0.6;
  const z0 = LAGOON.z - LAGOON.r - 0.15;
  const planks = useMemo(() => {
    const out: Inst[] = [];
    for (let i = 0; i < 5; i++) out.push({ p: [x0 + (i - 2) * 0.24, 0.36, z0 + 0.45], s: [0.22, 0.05, 1.2], r: [0, (i % 2) * 0.03, 0], c: i % 2 ? '#a8774a' : '#b9875a' });
    return out;
  }, [x0, z0]);
  return (
    <group>
      <Instances items={planks} geometry={BOX} material={toon('#ffffff')} />
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[x0 + dx, 0.22, z0 + 1.0]} material={toon('#6a452c')} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.6, 6]} />
        </mesh>
      ))}
      <Lantern position={[x0 + 0.55, 0.38, z0 + 0.95]} color="#ffcf6b" light height={0.9} />
    </group>
  );
}

/** Fireflies drifting over the pond. Additive glowing dots, one draw call. */
function Fireflies() {
  const quality = useSettings((s) => s.quality);
  const n = quality === 'high' ? 90 : 36;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const rnd = seeded(51);
    return Array.from({ length: n }, () => ({
      x: 1.5 + (rnd() - 0.5) * 18,
      z: (rnd() - 0.55) * 13,
      y: 0.5 + rnd() * 2.2,
      a: rnd() * 6.28,
      s: 0.4 + rnd() * 0.8,
      r: 0.4 + rnd() * 1.1,
    }));
  }, [n]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    seeds.forEach((f, i) => {
      const a = f.a + t * f.s * 0.5;
      dummy.position.set(f.x + Math.cos(a) * f.r, f.y + Math.sin(a * 1.7) * 0.25, f.z + Math.sin(a * 0.8) * f.r);
      const blink = 0.5 + 0.5 * Math.sin(t * (2 + f.s * 2) + f.a * 3);
      dummy.scale.setScalar(0.025 + blink * 0.035);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, n]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#e4ff8a" toneMapped={false} />
    </instancedMesh>
  );
}

/** A big soft moon low in the sky behind the trees. */
function Moon() {
  return (
    <group position={[-6, 9, -22]}>
      <mesh>
        <circleGeometry args={[2.2, 40]} />
        <meshBasicMaterial color="#fff6d8" toneMapped={false} fog={false} />
      </mesh>
      <mesh position-z={-0.1}>
        <circleGeometry args={[3.4, 40]} />
        <meshBasicMaterial color="#fff0c0" transparent opacity={0.18} toneMapped={false} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Pond() {
  const quality = useSettings((s) => s.quality);
  return (
    <group>
      <PondWater />
      {/* A soft warm glow over the pond (like a cloud of fireflies), so the logs read clearly at dusk. */}
      <pointLight position={[0.5, 4.5, 1.5]} color="#ffe2b8" intensity={9} distance={14} decay={1.3} />
      <Banks />
      <Rocks />
      <Grass />
      <Reeds />
      <Trees />
      <Mushrooms />
      <LilyPads />
      <ExitGate />
      <Dock />
      <Moon />
      <Fireflies />
      <Lantern position={[-HALF - 0.85, 0.3, -HALF - 0.6]} light />
      <Lantern position={[-HALF - 0.75, 0.3, HALF + 0.3]} color="#ff9ad8" light={quality === 'high'} />
      <Lantern position={[HALF + 0.7, 0.3, HALF + 0.2]} color="#7ef0ff" />
    </group>
  );
}
