import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { LilyPads } from './Pieces';

// ---------------------------------------------------------------- night water

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec2 uMoon;
  uniform float uMoonGlow;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec2 p = vWorld.xz;
    float n = noise(p * 1.4 + vec2(uTime * 0.15, uTime * 0.08)) * 0.6 + noise(p * 3.1 - vec2(uTime * 0.2, -uTime * 0.12)) * 0.4;
    float centre = smoothstep(14.0, 2.0, length(p));
    vec3 col = mix(uDeep, uShallow, centre * 0.65 + n * 0.25);
    // soft ripple lines
    float rip = sin((p.x * 0.7 + p.y) * 2.2 + n * 6.0 + uTime * 0.9);
    col += vec3(0.08, 0.12, 0.25) * smoothstep(0.85, 1.0, rip) * 0.6;
    // the moon's reflection: a glowing disc and a shimmering streak toward the viewer
    vec2 d = p - uMoon;
    float disc = smoothstep(1.3, 0.2, length(d * vec2(1.0, 0.7)));
    float streak = exp(-abs(d.x + sin(p.y * 3.0 + uTime * 2.0) * 0.15) * 2.4) * smoothstep(-0.5, 6.0, d.y) * smoothstep(14.0, 2.0, d.y);
    float shimmer = 0.55 + 0.45 * noise(vec2(p.x * 6.0, p.y * 2.0 - uTime * 1.5));
    col += vec3(0.95, 0.92, 1.0) * (disc * 0.9 + streak * 0.35 * shimmer) * uMoonGlow;
    // twinkles (reflected stars and fireflies)
    vec2 cell = floor(p * 3.0);
    float tw = step(0.985, hash(cell)) * (0.5 + 0.5 * sin(uTime * 3.0 + hash(cell + 3.0) * 30.0));
    col += vec3(0.7, 0.8, 1.0) * tw * 0.5 * smoothstep(0.5, 0.0, length(fract(p * 3.0) - 0.5));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function NightWater({ moon, moonGlow }: { moon: RefObject<[number, number]>; moonGlow: RefObject<number> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 },
          uMoon: { value: new THREE.Vector2(-2, -6) },
          uMoonGlow: { value: 1 },
          uDeep: { value: new THREE.Color('#141b3d') },
          uShallow: { value: new THREE.Color('#1f4a5e') },
        },
      }),
    [],
  );
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    const m = moon.current;
    if (m) (mat.uniforms.uMoon.value as THREE.Vector2).set(m[0], m[1]);
    mat.uniforms.uMoonGlow.value = moonGlow.current ?? 1;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.02} material={mat} receiveShadow>
      <planeGeometry args={[80, 80, 1, 1]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- fireflies

export function Fireflies({ swarm }: { swarm: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  const count = high ? 46 : 18;
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const flies = useMemo(() => {
    const rnd = seeded(17);
    return Array.from({ length: 46 }, () => {
      // Mostly around the banks, a few over the water.
      const a = rnd() * Math.PI * 2;
      const rad = 4.2 + rnd() * 3.5;
      return { x: Math.cos(a) * rad, z: Math.sin(a) * rad * 0.8 - 0.6, y: 0.4 + rnd() * 1.6, ph: rnd() * 10, sp: 0.4 + rnd() * 0.6, r: 0.3 + rnd() * 0.7 };
    });
  }, []);
  const mix = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    mix.current = THREE.MathUtils.damp(mix.current, swarm ? 1 : 0, 1.5, dt);
    const m = mix.current;
    for (let i = 0; i < count; i++) {
      const f = flies[i];
      const wx = f.x + Math.sin(t * f.sp + f.ph) * f.r;
      const wy = f.y + Math.sin(t * f.sp * 1.7 + f.ph) * 0.3;
      const wz = f.z + Math.cos(t * f.sp * 0.8 + f.ph) * f.r;
      // On a win they swirl into a glowing ring over the lagoon.
      const a = (i / count) * Math.PI * 2 + t * 0.9;
      const rr = 2.2 + Math.sin(t * 2 + i) * 0.4;
      const sx = Math.cos(a) * rr;
      const sy = 1.6 + Math.sin(a * 3 + t * 2) * 0.35;
      const sz = Math.sin(a) * rr * 0.8;
      dummy.position.set(wx + (sx - wx) * m, wy + (sy - wy) * m, wz + (sz - wz) * m);
      const blink = 0.5 + 0.5 * Math.sin(t * 3 + f.ph * 5);
      dummy.scale.setScalar(0.03 + blink * 0.04 + m * 0.02);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    }
    if (ref.current) {
      ref.current.count = count;
      ref.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <instancedMesh ref={ref} args={[undefined, mat, 46]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- banks and plants

function Instanced({ geo, mat, items, color }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: THREE.Matrix4[]; color?: (i: number) => THREE.Color }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((mx, i) => {
      m.setMatrixAt(i, mx);
      if (color) m.setColorAt(i, color(i));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items, color]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow receiveShadow />;
}

const mx = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** Mossy banks, reeds, cattails, glowing mushrooms, willows and paper lanterns around the lagoon. */
export function LagoonShore() {
  const high = useSettings((s) => s.quality) === 'high';
  const data = useMemo(() => {
    const rnd = seeded(1717);
    const banks: THREE.Matrix4[] = [];
    const moss: THREE.Matrix4[] = [];
    // [x, z, sx, sz]
    const lumps: [number, number, number, number][] = [
      [-7.6, -1.5, 2.6, 4.2],
      [-6.8, 3.2, 2.2, 2.2],
      [-5.6, -6.2, 3.4, 2.4],
      [-1.2, -7.6, 4.2, 2.2],
      [3.8, -7.0, 3.6, 2.4],
      [7.4, -3.4, 2.6, 3.4],
      [7.8, 1.8, 2.4, 3.0],
      [6.6, 5.2, 2.0, 1.8],
      [-8.6, 6.6, 2.6, 2.0],
    ];
    lumps.forEach(([x, z, sx, sz]) => {
      banks.push(mx(x, -0.15, z, sx, 0.75, sz, rnd() * 3));
      moss.push(mx(x, 0.35, z, sx * 0.85, 0.28, sz * 0.85, rnd() * 3));
    });
    const reeds: THREE.Matrix4[] = [];
    const tails: THREE.Matrix4[] = [];
    const stems: THREE.Matrix4[] = [];
    const caps: THREE.Matrix4[] = [];
    const capColors: THREE.Color[] = [];
    const glowCols = [new THREE.Color(0.4, 2.4, 2.6), new THREE.Color(2.6, 0.7, 2.0), new THREE.Color(1.6, 2.6, 0.5)];
    // Reeds along the inner edge of the banks.
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 4.9 + rnd() * 1.6;
      const x = Math.cos(a) * r * 1.15;
      const z = Math.sin(a) * r * 0.95 - 0.8;
      if (z > 3.4 && Math.abs(x) < 5) continue; // keep the front open
      if (Math.abs(z) < 0.9 && x < 0) continue; // keep the lantern clear
      const h = 0.6 + rnd() * 0.9;
      reeds.push(mx(x, h / 2 - 0.05, z, 1, h, 1, 0, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25));
      if (rnd() < 0.3) tails.push(mx(x, h - 0.05, z, 1, 1, 1));
    }
    // Glowing mushroom clusters on the banks.
    lumps.forEach(([x, z, sx, sz], li) => {
      const n = 3 + (li % 3);
      for (let k = 0; k < n; k++) {
        const ox = (rnd() - 0.5) * sx * 0.9;
        const oz = (rnd() - 0.5) * sz * 0.9;
        const s = 0.6 + rnd() * 0.9;
        const px = x + ox;
        const pz = z + oz;
        stems.push(mx(px, 0.5 + 0.1 * s, pz, s, s, s));
        caps.push(mx(px, 0.5 + 0.2 * s, pz, s, s * 0.7, s));
        capColors.push(glowCols[(li + k) % 3]);
      }
    });
    return { banks, moss, reeds, tails, stems, caps, capColors };
  }, []);

  const geos = useMemo(
    () => ({
      bank: new THREE.IcosahedronGeometry(1, 1),
      reed: new THREE.ConeGeometry(0.03, 1, 4),
      tail: new THREE.CapsuleGeometry(0.045, 0.16, 2, 6),
      stem: new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6),
      cap: new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    }),
    [],
  );
  const capMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const capColor = useMemo(() => (i: number) => data.capColors[i], [data]);

  const willows: [number, number, number][] = [
    [-5.2, -6.0, 1.15],
    [4.4, -6.6, 1.0],
    [8.0, -1.5, 0.9],
    [-7.8, 1.0, 0.85],
  ];
  const lanterns: [number, number][] = [
    [-5.8, -4.4],
    [5.9, -4.6],
    [6.2, 3.4],
  ];

  return (
    <group>
      <Instanced geo={geos.bank} mat={toon('#24453f', { rough: 1 })} items={data.banks} />
      <Instanced geo={geos.bank} mat={toon('#3f7a4a', { rough: 1 })} items={data.moss} />
      <Instanced geo={geos.reed} mat={toon('#2f6b3f')} items={data.reeds} />
      <Instanced geo={geos.tail} mat={toon('#6b4226')} items={data.tails} />
      <Instanced geo={geos.stem} mat={toon('#e8eef8')} items={data.stems} />
      <Instanced geo={geos.cap} mat={capMat} items={data.caps} color={capColor} />
      {willows.map(([x, z, s], i) => (
        <Willow key={i} position={[x, 0.3, z]} scale={s} seed={i} />
      ))}
      {lanterns.map(([x, z], i) => (
        <PaperLantern key={i} position={[x, 0.3, z]} light={high && i < 2} seed={i} />
      ))}
      <LilyPads
        extra={[
          { x: -4.6, z: 2.9, s: 0.7, a: 1 },
          { x: 4.7, z: -2.6, s: 0.6, a: 2 },
          { x: 4.9, z: 3.6, s: 0.8, a: 4 },
          { x: -2.6, z: -4.6, s: 0.55, a: 5 },
          { x: 2.1, z: -4.8, s: 0.7, a: 0.5 },
          { x: -4.8, z: -2.4, s: 0.6, a: 3 },
        ]}
      />
      <Stars radius={60} depth={20} count={high ? 1500 : 500} factor={3} saturation={0.4} fade speed={0.6} />
    </group>
  );
}

function Willow({ position, scale, seed }: { position: [number, number, number]; scale: number; seed: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.z = Math.sin(clock.elapsedTime * 0.6 + seed) * 0.03;
  });
  const leaf = toon('#3b7d5c');
  const leafLight = toon('#4f9a6b');
  return (
    <group position={position} scale={scale}>
      <mesh position-y={1.2} castShadow material={toon('#4a3b35')}>
        <cylinderGeometry args={[0.16, 0.3, 2.4, 7]} />
      </mesh>
      <group ref={g} position-y={2.5}>
        <mesh scale={[1.5, 0.8, 1.5]} castShadow material={leaf}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 + seed;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.15, -0.8, Math.sin(a) * 1.15]} rotation={[Math.PI + Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]} material={i % 2 ? leaf : leafLight} castShadow>
              <coneGeometry args={[0.38, 1.9, 6]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function PaperLantern({ position, light, seed }: { position: [number, number, number]; light: boolean; seed: number }) {
  const sway = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (sway.current) sway.current.rotation.z = Math.sin(clock.elapsedTime * 1.2 + seed * 2) * 0.12;
  });
  return (
    <group position={position}>
      <mesh position-y={0.8} material={toon('#a16207')}>
        <cylinderGeometry args={[0.035, 0.045, 1.6, 6]} />
      </mesh>
      <mesh position={[0.25, 1.58, 0]} rotation-z={Math.PI / 2} material={toon('#a16207')}>
        <cylinderGeometry args={[0.025, 0.025, 0.55, 5]} />
      </mesh>
      <group ref={sway} position={[0.48, 1.55, 0]}>
        <mesh position-y={-0.3} scale={[1, 1.15, 1]} material={toon('#fdba74', { emissive: '#fb923c', emissiveIntensity: 2.6 })}>
          <icosahedronGeometry args={[0.2, 1]} />
        </mesh>
        <mesh position-y={-0.08} material={toon('#7c2d12')}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 8]} />
        </mesh>
        <mesh position-y={-0.53} material={toon('#7c2d12')}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 8]} />
        </mesh>
        {light && <pointLight position-y={-0.3} color="#ffb366" intensity={3} distance={5} decay={2} />}
      </group>
    </group>
  );
}
