import { seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { glowTexture, hdr } from './glow';
import { FROG_HOME, LANTERN_COLORS, POND_R, WATER_Y, padPos, type Glows, type Ripple } from './layout';
import { CELLS } from './rules';

/** Where the moon hangs (also used for its reflection on the water). */
const FROG_ANGLE = Math.atan2(FROG_HOME[2], FROG_HOME[0]);
const MOON: [number, number, number] = [-9, 13, -34];

/** The whole twilight diorama around the pond: water, banks, reeds, mushrooms, trees, moon and stars. */
export function Lagoon({ glows, ripples }: { glows: Glows; ripples: Ripple[] }) {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <Pond glows={glows} ripples={ripples} />
      <PondBed />
      <Banks />
      <ShoreStones />
      <Reeds high={high} />
      <DecorPads />
      <Mushrooms />
      <Trees />
      <Moon />
      <Stars radius={70} depth={25} count={high ? 2200 : 700} factor={3.2} saturation={0.4} fade speed={0.6} />
      <AmbientFireflies count={high ? 70 : 28} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Water

const pondVertex = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec3 p = position;
    vec4 w = modelMatrix * vec4(p, 1.0);
    p.z += (sin(w.x * 1.1 + uTime * 0.9) * 0.5 + sin(w.z * 1.4 - uTime * 1.1) * 0.5) * 0.015;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const pondFragment = /* glsl */ `
  #include <fog_pars_fragment>
  #define N ${CELLS}
  uniform float uTime;
  uniform float uRadius;
  uniform vec3 uLights[N];     // x, z, glow
  uniform vec3 uLightCols[N];
  uniform vec4 uRipples[3];    // x, z, age (s), strength
  uniform vec3 uMoonDir;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 xz = vWorld.xz;
    float r = length(xz) / uRadius;
    // colours are linear (they get brighter on screen)
    vec3 deep = vec3(0.006, 0.010, 0.040);
    vec3 shallow = vec3(0.018, 0.075, 0.095);
    vec3 col = mix(deep, shallow, smoothstep(0.55, 1.0, r));

    // ripples push the normal outward
    vec2 rip = vec2(0.0);
    float ringGlow = 0.0;
    for (int i = 0; i < 3; i++) {
      vec4 R = uRipples[i];
      if (R.w <= 0.0) continue;
      vec2 d = xz - R.xy;
      float dist = length(d);
      float front = R.z * 1.7;
      float band = exp(-pow((dist - front) * 7.0, 2.0)) * exp(-R.z * 1.6) * R.w;
      float band2 = exp(-pow((dist - front * 0.6) * 9.0, 2.0)) * exp(-R.z * 2.2) * R.w * 0.6;
      rip += normalize(d + 1e-4) * (band + band2);
      ringGlow += band + band2;
    }

    float n1 = fbm(xz * 0.9 + vec2(uTime * 0.05, uTime * 0.03));
    float n2 = fbm(xz * 1.6 - vec2(uTime * 0.04, -uTime * 0.06) + 7.0);
    vec3 normal = normalize(vec3((n1 - 0.5) * 0.22 + rip.x * 0.9, 1.0, (n2 - 0.5) * 0.22 + rip.y * 0.9));
    vec3 viewDir = normalize(cameraPosition - vWorld);

    // sky reflection: violet at grazing angles
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);
    col = mix(col, vec3(0.08, 0.06, 0.24), fresnel * 0.5);

    // moon reflection: a shimmering streak
    vec3 refl = reflect(-viewDir, normal);
    float moon = pow(max(dot(refl, uMoonDir), 0.0), 220.0);
    float moonSoft = pow(max(dot(refl, uMoonDir), 0.0), 18.0);
    col += vec3(1.0, 0.94, 0.78) * (moon * 2.5 + moonSoft * 0.05);

    // lantern light pools and reflections
    for (int i = 0; i < N; i++) {
      vec3 L = uLights[i];
      if (L.z <= 0.001) continue;
      vec2 d = xz - L.xy;
      float pool = exp(-dot(d, d) * 1.4);
      // a long wobbly streak toward the camera
      float wob = (n1 - 0.5) * 0.35;
      float streak = exp(-pow((d.x + wob) * 4.0, 2.0) - pow(max(d.y, 0.0) * 1.1, 2.0) - pow(min(d.y, 0.0) * 3.0, 2.0));
      float shimmer = 0.65 + 0.35 * sin(uTime * 3.0 + d.y * 9.0 + n2 * 6.0);
      col += uLightCols[i] * L.z * (pool * 0.4 + streak * 0.28 * shimmer);
    }

    col += vec3(0.3, 0.6, 0.8) * ringGlow * 0.3;

    // a soft bright rim where the water meets the bank
    col += vec3(0.05, 0.16, 0.18) * smoothstep(0.95, 1.0, r) * 0.5;

    gl_FragColor = vec4(col, 0.94);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function Pond({ glows, ripples }: { glows: Glows; ripples: Ripple[] }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uRadius: { value: POND_R },
          uLights: { value: Array.from({ length: CELLS }, (_, i) => new THREE.Vector3(padPos(i)[0], padPos(i)[2], 0)) },
          uLightCols: { value: LANTERN_COLORS.map((c) => new THREE.Color(c)) },
          uRipples: { value: [0, 1, 2].map(() => new THREE.Vector4(0, 0, 0, 0)) },
          uMoonDir: { value: new THREE.Vector3(...MOON).normalize() },
        },
      ]),
    [],
  );
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value += dt;
    const lights = m.uniforms.uLights.value as THREE.Vector3[];
    for (let i = 0; i < CELLS; i++) lights[i].z = glows[i];
    const rs = m.uniforms.uRipples.value as THREE.Vector4[];
    const now = performance.now();
    ripples.forEach((r, i) => {
      const age = (now - r.t) / 1000;
      rs[i].set(r.x, r.z, age, r.t < 0 || age > 3 ? 0 : r.strength);
    });
  });
  return (
    <mesh position-y={WATER_Y} rotation-x={-Math.PI / 2} renderOrder={1}>
      <circleGeometry args={[POND_R + 0.4, 96, 0, Math.PI * 2]} />
      <shaderMaterial ref={mat} vertexShader={pondVertex} fragmentShader={pondFragment} uniforms={uniforms} transparent fog depthWrite={false} />
    </mesh>
  );
}

/** A dark bowl under the water so the pond has depth. */
function PondBed() {
  return (
    <mesh position-y={-0.55} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[POND_R + 0.6, 48]} />
      <meshStandardMaterial color="#0b1430" roughness={1} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------------------------
// Land

/** Gently rolling twilight meadow around the pond, with a muddy shore. */
function Banks() {
  const geo = useMemo(() => {
    const inner = POND_R - 0.1;
    const g = new THREE.RingGeometry(inner, 34, 120, 26);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const mud = new THREE.Color('#3b4a3f');
    const grass = new THREE.Color('#2f6b4f');
    const far = new THREE.Color('#1e3b44');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const t = (r - inner) / (34 - inner);
      // shore lip, then rolling hills that rise toward the horizon
      let h = Math.min(1, (r - inner) / 0.9) * 0.28 - 0.12;
      h += Math.sin(a * 3 + 1.3) * Math.sin(a * 5 - 0.4) * 0.35 * Math.min(1, t * 6);
      h += Math.max(0, r - 12) * 0.12 * (0.6 + 0.4 * Math.sin(a * 2.0 + 0.7));
      h += (Math.sin(x * 1.7) * Math.cos(y * 1.3)) * 0.08;
      pos.setZ(i, h);
      const k = Math.min(1, (r - inner) / 1.2);
      tmp.copy(mud).lerp(grass, k).lerp(far, Math.min(1, Math.max(0, (r - 9) / 14)));
      tmp.offsetHSL(0, 0, (Math.sin(x * 3.1 + y * 2.3) * 0.5 + 0.5) * 0.03);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  );
}

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, mats: THREE.Matrix4[], colors?: THREE.Color[]) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((mat, i) => m.setMatrixAt(i, mat));
    colors?.forEach((c, i) => m.setColorAt(i, c));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, mats, colors]);
}

const compose = (p: [number, number, number], r: [number, number, number], s: [number, number, number]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));

/** Mossy stones around the water's edge, plus the frog's stone on the front bank. */
function ShoreStones() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mats = useMemo(() => {
    const rnd = seeded(14);
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd() * 0.08;
      // keep the front-centre gap clear for the frog's stone
      if (Math.abs(a - FROG_ANGLE) < 0.16) continue;
      const r = POND_R + 0.05 + rnd() * 0.35;
      const s = 0.18 + rnd() * 0.3;
      out.push(compose([Math.cos(a) * r, 0.02, Math.sin(a) * r], [rnd() * 3, rnd() * 3, rnd() * 3], [s * 1.3, s * 0.7, s]));
    }
    out.push(compose([FROG_HOME[0], 0.0, FROG_HOME[2]], [0.1, 0.4, 0], [0.62, 0.36, 0.5]));
    return out;
  }, []);
  useInstances(ref, mats);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]} castShadow receiveShadow material={toon('#6f7d92')}>
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

/** Reeds and cattails in clumps around the shore; they sway in the evening breeze. */
function Reeds({ high }: { high: boolean }) {
  const blades = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const rnd = seeded(7);
    const out: { x: number; z: number; h: number; lean: number; yaw: number; phase: number; cattail: boolean }[] = [];
    const clumps = [0.3, 0.9, 1.25, 2.2, 2.6, 3.4, 3.9, 4.4, 5.1, 5.6, 6.0];
    for (const ca of clumps) {
      const n = 6 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const a = ca + (rnd() - 0.5) * 0.28;
        const r = POND_R + (rnd() - 0.3) * 0.7;
        out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: 0.6 + rnd() * 0.9, lean: (rnd() - 0.5) * 0.3, yaw: rnd() * Math.PI * 2, phase: rnd() * 6, cattail: rnd() < 0.35 });
      }
    }
    return out;
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const place = (t: number) => {
    const b = blades.current;
    const hd = heads.current;
    if (!b || !hd) return;
    let hi = 0;
    data.forEach((d, i) => {
      const sway = Math.sin(t * 1.3 + d.phase) * 0.06;
      dummy.position.set(d.x, 0, d.z);
      dummy.rotation.set(d.lean + sway, d.yaw, sway * 0.6);
      dummy.scale.set(1, d.h, 1);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
      if (d.cattail) {
        // head sits at the top of the (leaning) blade
        const tip = new THREE.Vector3(0, d.h, 0).applyEuler(dummy.rotation);
        dummy.position.set(d.x + tip.x, tip.y, d.z + tip.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        hd.setMatrixAt(hi++, dummy.matrix);
      }
    });
    hd.count = hi;
    b.instanceMatrix.needsUpdate = true;
    hd.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => place(0));
  useFrame(({ clock }) => {
    if (high) place(clock.elapsedTime);
  });
  return (
    <group>
      <instancedMesh ref={blades} args={[undefined, undefined, data.length]} castShadow material={toon('#3f8f5a')} frustumCulled={false}>
        <coneGeometry args={[0.035, 1, 4, 1]} onUpdate={(g) => g.translate(0, 0.5, 0)} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, data.length]} material={toon('#6b3f2a')} frustumCulled={false}>
        <capsuleGeometry args={[0.05, 0.16, 3, 6]} />
      </instancedMesh>
    </group>
  );
}

/** Extra lily pads and lotus flowers drifting in the corners of the pond (just for looks). */
function DecorPads() {
  const pads = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const { padMats, flowerMats, flowerCols } = useMemo(() => {
    const rnd = seeded(3);
    const padMats: THREE.Matrix4[] = [];
    const flowerMats: THREE.Matrix4[] = [];
    const flowerCols: THREE.Color[] = [];
    const spots: [number, number][] = [
      [-4.3, -1.6], [-3.9, 2.4], [4.2, 1.9], [3.6, -3.0], [-2.6, -4.1], [2.4, 3.9], [4.6, -0.6], [-4.7, 0.4], [1.2, -4.6], [-1.6, 4.4],
    ];
    for (const [x, z] of spots) {
      const s = 0.28 + rnd() * 0.22;
      padMats.push(compose([x, 0.02, z], [0, rnd() * 6, 0], [s, 1, s]));
      if (rnd() < 0.6) {
        flowerMats.push(compose([x + 0.05, 0.08, z], [0, rnd() * 6, 0], [0.14, 0.14, 0.14]));
        flowerCols.push(hdr(rnd() < 0.5 ? '#ff9ad5' : '#fff1f7', 1.4));
      }
    }
    return { padMats, flowerMats, flowerCols };
  }, []);
  useInstances(pads, padMats);
  useInstances(flowers, flowerMats, flowerCols);
  return (
    <group>
      <instancedMesh ref={pads} args={[undefined, undefined, padMats.length]} receiveShadow material={toon('#3f9a55')}>
        <cylinderGeometry args={[1, 1, 0.04, 14, 1, false, 0.35, Math.PI * 2 - 0.7]} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, flowerMats.length]}>
        <coneGeometry args={[1, 1.2, 7, 1, true]} />
        <meshStandardMaterial flatShading roughness={0.6} side={THREE.DoubleSide} emissive="#ff8fcf" emissiveIntensity={0.25} />
      </instancedMesh>
    </group>
  );
}

/** Clusters of glowing mushrooms on the banks. */
function Mushrooms() {
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const { stemMats, capMats, capCols } = useMemo(() => {
    const rnd = seeded(21);
    const palette = ['#5ef2ff', '#c08bff', '#ff7ad9', '#8dff9e'];
    const stemMats: THREE.Matrix4[] = [];
    const capMats: THREE.Matrix4[] = [];
    const capCols: THREE.Color[] = [];
    const clusters: [number, number][] = [
      [-5.9, -2.2], [6.1, -1.3], [-6.4, 1.6], [5.7, 2.9], [-3.2, -5.6], [3.9, -5.1], [-5.0, 3.9], [6.8, 0.6], [0.6, -6.3], [-6.6, -0.4],
    ];
    clusters.forEach(([cx, cz], ci) => {
      const col = palette[ci % palette.length];
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - 0.5) * 0.7;
        const z = cz + (rnd() - 0.5) * 0.7;
        const h = 0.15 + rnd() * 0.3;
        const s = 0.09 + rnd() * 0.12;
        stemMats.push(compose([x, 0.05 + h / 2, z], [(rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3], [s * 0.45, h, s * 0.45]));
        capMats.push(compose([x, 0.05 + h, z], [0, rnd() * 3, 0], [s * 1.6, s, s * 1.6]));
        capCols.push(hdr(col, 1.25));
      }
    });
    return { stemMats, capMats, capCols };
  }, []);
  useInstances(stems, stemMats);
  useInstances(caps, capMats, capCols);
  return (
    <group>
      <instancedMesh ref={stems} args={[undefined, undefined, stemMats.length]} material={toon('#e9e2d0')}>
        <cylinderGeometry args={[1, 1.2, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, capMats.length]}>
        <sphereGeometry args={[1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Two weeping willows framing the pond and a ring of dark pines toward the hills. */
function Trees() {
  const pines = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const { pineMats, trunkMats } = useMemo(() => {
    const rnd = seeded(5);
    const pineMats: THREE.Matrix4[] = [];
    const trunkMats: THREE.Matrix4[] = [];
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + rnd() * 0.1;
      // leave the view toward the camera open
      if (Math.sin(a) > 0.55) continue;
      const r = 10 + rnd() * 9;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = 2.2 + rnd() * 2.6;
      const y = Math.max(0, r - 12) * 0.12 * 0.8 + 0.1;
      pineMats.push(compose([x, y + h * 0.55, z], [0, rnd() * 3, 0], [h * 0.34, h, h * 0.34]));
      trunkMats.push(compose([x, y + 0.2, z], [0, 0, 0], [0.12, 0.5, 0.12]));
    }
    return { pineMats, trunkMats };
  }, []);
  useInstances(pines, pineMats);
  useInstances(trunks, trunkMats);
  return (
    <group>
      <instancedMesh ref={pines} args={[undefined, undefined, pineMats.length]} castShadow material={toon('#1f4a48')}>
        <coneGeometry args={[1, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, trunkMats.length]} material={toon('#3b2a2a')}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
      </instancedMesh>
      <Willow position={[-7.2, 0, -3.6]} seed={1} />
      <Willow position={[7.4, 0, -2.8]} seed={2} flip />
    </group>
  );
}

function Willow({ position, seed, flip }: { position: [number, number, number]; seed: number; flip?: boolean }) {
  const strands = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(() => {
    const rnd = seeded(seed * 31);
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.6 + rnd() * 1.3;
      const len = 1.4 + rnd() * 1.4;
      out.push(compose([Math.cos(a) * r, 3.3 - len / 2 + rnd() * 0.3, Math.sin(a) * r], [0, rnd() * 3, 0], [0.22, len, 0.22]));
    }
    return out;
  }, [seed]);
  useInstances(strands, mats);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.7 + seed) * 0.015;
  });
  return (
    <group position={position} scale={[flip ? -1 : 1, 1, 1]}>
      <mesh position={[0, 1.4, 0]} rotation-z={0.12} castShadow material={toon('#4a3530')}>
        <cylinderGeometry args={[0.16, 0.3, 2.8, 7]} />
      </mesh>
      <mesh position={[0.25, 3.3, 0]} scale={[1.9, 0.9, 1.7]} castShadow material={toon('#3d8a63')}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <group ref={group}>
        <instancedMesh ref={strands} args={[undefined, undefined, mats.length]} castShadow material={toon('#4fa874')}>
          <coneGeometry args={[1, 1, 5, 1]} onUpdate={(g) => g.rotateX(Math.PI)} />
        </instancedMesh>
      </group>
    </group>
  );
}

/** A big friendly moon with a soft halo. */
function Moon() {
  const tex = glowTexture();
  return (
    <group position={MOON}>
      <mesh>
        <icosahedronGeometry args={[2.6, 2]} />
        <meshBasicMaterial color={hdr('#fff3d1', 1.6)} toneMapped={false} fog={false} />
      </mesh>
      {/* craters */}
      {[
        [-0.8, 0.6, 2.3, 0.55],
        [0.9, -0.4, 2.35, 0.4],
        [0.2, 1.2, 2.25, 0.3],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={[s, s, 0.1]}>
          <circleGeometry args={[1, 10]} />
          <meshBasicMaterial color={hdr('#e8d6a8', 1.3)} toneMapped={false} fog={false} />
        </mesh>
      ))}
      <sprite scale={[16, 16, 1]}>
        <spriteMaterial map={tex} color="#d8c8ff" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  );
}

/** Fireflies wandering over the meadow and blinking. */
function AmbientFireflies({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const flies = useMemo(() => {
    const rnd = seeded(99);
    return Array.from({ length: count }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 2.5 + rnd() * 7;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.4 + rnd() * 2.2, sp: 0.3 + rnd() * 0.5, ph: rnd() * 10, blink: 0.6 + rnd() * 1.4 };
    });
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    flies.forEach((_, i) => m.setColorAt(i, hdr(i % 3 === 0 ? '#d9ff6a' : '#fff07a', 3)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [flies]);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    flies.forEach((f, i) => {
      const k = t * f.sp + f.ph;
      dummy.position.set(f.x + Math.sin(k) * 0.8, f.y + Math.sin(k * 1.7) * 0.3, f.z + Math.cos(k * 0.8) * 0.8);
      const b = Math.max(0, Math.sin(t * f.blink + f.ph));
      dummy.scale.setScalar(0.02 + 0.035 * b);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
