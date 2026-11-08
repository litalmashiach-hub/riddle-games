import { useFrame } from '@react-three/fiber';
import { Clickable, type Vec3 } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import {
  BACK_MS,
  DIMS,
  FLOW_END,
  FLOW_START,
  GO_MS,
  HOME,
  RETURN_MS,
  SPILL_MS,
  YARD_Y,
  TILT_MS,
  UNTILT_MS,
  lerp,
  lerp3,
  moverSpot,
  phase,
  type Anim,
} from './layout';
import { sloshSound } from './audio';
import { Overlay } from './Overlay';
import { CAPACITY, GOAL, otherJug, type JugId, type State } from './rules';

// ---------------------------------------------------------------------------
// Liquid: the inside of the jug, cut by a world-space water plane. Front faces are
// the water seen through the glass; back faces showing through the cut read as the
// surface. Because the plane is in world space, the water stays level when the jug tips.
// ---------------------------------------------------------------------------
const liquidVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const liquidFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uLevel;
  uniform float uBottom;
  uniform vec3 uCenter;
  uniform vec2 uSlosh;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSurface;
  uniform float uGlow;
  uniform vec3 uSunDir;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  float surfaceAt(vec2 xz) {
    vec2 d = xz - uCenter.xz;
    return uLevel + dot(d, uSlosh) + sin(d.x * 18.0 + uTime * 5.0) * 0.004 + sin(d.y * 15.0 - uTime * 4.0) * 0.004;
  }

  void main() {
    if (uLevel <= uBottom + 0.002) discard;
    float s = surfaceAt(vWorld.xz);
    if (vWorld.y > s) discard;

    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 col;
    if (gl_FrontFacing) {
      // Water seen through the side of the glass: deeper is darker, bright rim near the top.
      float depth = clamp((s - vWorld.y) / 0.6, 0.0, 1.0);
      col = mix(uShallow, uDeep, depth);
      float lambert = max(dot(vNormalW, uSunDir), 0.0);
      col *= 0.75 + 0.35 * lambert;
      float fres = pow(1.0 - max(dot(viewDir, vNormalW), 0.0), 2.0);
      col += uShallow * fres * 0.5;
      float meniscus = smoothstep(0.03, 0.0, s - vWorld.y);
      col = mix(col, uSurface, meniscus * 0.7);
      // Caustic-like shimmer.
      float c = noise(vWorld.xz * 14.0 + vec2(uTime * 0.7, vWorld.y * 6.0 - uTime));
      col += vec3(0.6, 0.9, 1.0) * smoothstep(0.7, 0.95, c) * 0.25;
    } else {
      // The surface: find where the view ray meets the water plane, ripple and glint there.
      vec3 ro = cameraPosition;
      vec3 rd = -viewDir;
      float t = (uLevel - ro.y) / min(rd.y, -0.001);
      vec3 p = ro + rd * t;
      float n = noise(p.xz * 22.0 + uTime * 1.5) * 0.6 + noise(p.xz * 47.0 - uTime * 2.1) * 0.4;
      vec3 nrm = normalize(vec3((n - 0.5) * 0.5 + uSlosh.x * 4.0, 1.0, (noise(p.zx * 22.0 - uTime) - 0.5) * 0.5 + uSlosh.y * 4.0));
      float fres = pow(1.0 - max(dot(-rd, nrm), 0.0), 3.0);
      col = mix(uSurface, vec3(0.85, 0.95, 1.0), fres * 0.6);
      vec3 h = normalize(uSunDir - rd);
      col += vec3(1.0, 0.97, 0.85) * pow(max(dot(nrm, h), 0.0), 90.0) * 1.6;
      float ring = smoothstep(0.02, 0.0, abs(length(p.xz - uCenter.xz) - mod(uTime * 0.12, 0.25)));
      col += ring * 0.05;
    }
    // Win glow: the liquid lights up gold.
    vec3 gold = vec3(1.0, 0.74, 0.2) * (0.75 + dot(col, vec3(0.333)) * 0.9);
    col = mix(col, gold, uGlow * 0.8) * (1.0 + uGlow * 0.35 * (0.8 + 0.2 * sin(uTime * 4.0)));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function useLiquidMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: liquidVertex,
        fragmentShader: liquidFragment,
        side: THREE.DoubleSide,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uLevel: { value: -10 },
            uBottom: { value: 0 },
            uCenter: { value: new THREE.Vector3() },
            uSlosh: { value: new THREE.Vector2() },
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color('#0e6aa8') },
            uShallow: { value: new THREE.Color('#3cc6e8') },
            uSurface: { value: new THREE.Color('#8fe6f7') },
            uGlow: { value: 0 },
            uSunDir: { value: new THREE.Vector3(12, 9, 6).normalize() },
          },
        ]),
      }),
    [],
  );
}

/** Glass shell: a lathe with an outer wall, a rolled lip and an inner wall. */
function glassGeometry(d: { r: number; h: number; base: number }) {
  const t = 0.018;
  const pts = [
    [0, 0],
    [d.r - 0.05, 0],
    [d.r - 0.01, 0.012],
    [d.r, 0.05],
    [d.r, d.h - 0.02],
    [d.r + 0.012, d.h],
    [d.r - 0.004, d.h + 0.012],
    [d.r - t, d.h - 0.01],
    [d.r - t, d.base + 0.03],
    [d.r - t - 0.03, d.base],
    [0, d.base],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
}

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: '#eefaff',
  roughness: 0.04,
  metalness: 0,
  transparent: true,
  opacity: 0.28,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  envMapIntensity: 2.2,
  specularIntensity: 1,
  depthWrite: false,
});
const rimMaterial = toon('#ffffff', { emissive: '#dff6ff', emissiveIntensity: 0.6, flat: false, rough: 0.2 });
const sprayMaterial = new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#6fd3f2', emissiveIntensity: 0.5, roughness: 0.1 });
const tickMaterial = toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.2, flat: false });

export interface JugProps {
  id: JugId;
  anim: RefObject<Anim>;
  state: State;
  selected: boolean;
  glow: boolean;
  disabled: boolean;
  /** performance.now() of the last refused tap, to shake "no". */
  oops: number;
  onClick(): void;
}

/** A glass measuring jug that walks through the move timeline on its own. */
export function Jug({ id, anim, state, selected, glow, disabled, oops, onClick }: JugProps) {
  const d = DIMS[id];
  const cap = CAPACITY[id];
  const root = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const liquid = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLSpanElement>(null);
  const mat = useLiquidMaterial();
  const geo = useMemo(() => glassGeometry(d), [d]);
  const innerR = d.r - 0.022;
  const liquidH = d.h - d.base - 0.01;

  // Pose kept between frames so undo / restart can glide from wherever we are.
  const cur = useRef({ pos: [...HOME[id]] as Vec3, tilt: 0, litres: state[id], dir: 1 as 1 | -1, lift: 0 });
  const snap = useRef({ id: -1, pos: [...HOME[id]] as Vec3, tilt: 0, litres: state[id] });
  const slosh = useRef({ vx: 0, vz: 0, x: 0, z: 0, last: new THREE.Vector3(), init: false });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const spray = useRef({ id: -1 });
  const drops = useMemo(() => Array.from({ length: 40 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sprayMesh = useRef<THREE.InstancedMesh>(null);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = cur.current;
    if (snap.current.id !== a.id) snap.current = { id: a.id, pos: [...c.pos] as Vec3, tilt: c.tilt, litres: c.litres };
    const s0 = snap.current;
    const el = performance.now() - a.start;
    const home = HOME[id];

    if (!a.forward || !a.move) {
      const spilling = s0.litres > a.next[id] + 0.2;
      if (spilling) {
        // Undo / restart takes water out: the jug does a silly backflip and sprays it everywhere.
        const k = phase(el, 0, SPILL_MS);
        c.dir = 1;
        c.pos = lerp3(s0.pos, home, k);
        c.pos[1] += Math.sin(Math.PI * k) * 0.7;
        c.tilt = lerp(s0.tilt, 0, k) + k * Math.PI * 2;
        c.litres = lerp(s0.litres, a.next[id], phase(el, 60, SPILL_MS * 0.45));
        if (spray.current.id !== a.id && el > 60) {
          spray.current.id = a.id;
          sloshSound();
          const top = new THREE.Vector3(c.pos[0], c.pos[1] + d.h, c.pos[2]);
          const n = Math.min(drops.length, Math.round(10 + (s0.litres - a.next[id]) * 9));
          for (let i = 0; i < n; i++) {
            const p = drops[i];
            const ang = Math.random() * Math.PI * 2;
            const sp = 0.8 + Math.random() * 1.6;
            p.p.copy(top);
            p.v.set(Math.cos(ang) * sp, 1.8 + Math.random() * 2.4, Math.sin(ang) * sp);
            p.life = 0.6 + Math.random() * 0.5;
          }
        }
      } else {
        const k = phase(el, 0, BACK_MS);
        c.pos = lerp3(s0.pos, home, k);
        c.tilt = lerp(s0.tilt, 0, k);
        c.litres = lerp(s0.litres, a.next[id], k);
      }
    } else if (a.move.jug === id) {
      const spot = moverSpot(a.move, a.prev);
      c.dir = spot.dir;
      const back = FLOW_END + UNTILT_MS;
      if (el < GO_MS) {
        const k = phase(el, 0, GO_MS);
        c.pos = lerp3(s0.pos, spot.base, k);
        c.pos[1] += Math.sin(Math.PI * k) * 0.55;
      } else if (el < back) {
        c.pos = [...spot.base];
      } else {
        const k = phase(el, back, RETURN_MS);
        c.pos = lerp3(spot.base, home, k);
        c.pos[1] += Math.sin(Math.PI * k) * 0.45;
      }
      const tipIn = phase(el, GO_MS, TILT_MS);
      const tipOut = phase(el, FLOW_END, UNTILT_MS);
      const pouring = el > FLOW_START && el < FLOW_END ? Math.sin(el * 0.012) * 0.03 : 0;
      c.tilt = spot.tilt * (tipIn - tipOut) + pouring;
      c.litres = lerp(a.prev[id], a.next[id], phase(el, FLOW_START, FLOW_END - FLOW_START));
    } else {
      c.pos = lerp3(s0.pos, home, phase(el, 0, GO_MS));
      c.tilt = lerp(s0.tilt, 0, phase(el, 0, GO_MS));
      const filling = a.move.kind === 'pour' && otherJug(a.move.jug) === id;
      c.litres = filling ? lerp(a.prev[id], a.next[id], phase(el, FLOW_START + 120, FLOW_END - FLOW_START)) : a.next[id];
    }

    // Selected jugs float up a little.
    c.lift += ((selected ? 0.14 : 0) - c.lift) * Math.min(1, dt * 10);

    const g = root.current;
    const p = pivot.current;
    const b = body.current;
    if (!g || !p || !b) return;
    // "Nuh-uh" head shake for a move that would do nothing.
    const since = performance.now() - oops;
    const shake = since >= 0 && since < 650 ? 1 - since / 650 : 0;
    g.position.set(c.pos[0], c.pos[1] + c.lift + Math.abs(Math.sin(since * 0.025)) * 0.08 * shake, c.pos[2]);
    g.rotation.z = Math.sin(since * 0.05) * 0.22 * shake;

    // Spray droplets (world space).
    const m = sprayMesh.current;
    if (m) {
      drops.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dt;
          p.v.y -= 9.8 * dt;
          p.p.addScaledVector(p.v, dt);
          if (p.p.y < YARD_Y) {
            p.p.y = YARD_Y;
            p.v.set(p.v.x * 0.3, Math.abs(p.v.y) * 0.25, p.v.z * 0.3);
          }
        }
        dummy.position.copy(p.p);
        dummy.scale.setScalar(p.life > 0 ? Math.min(1, p.life * 3) : 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    // Tip around the lip on the pouring side.
    p.position.set(c.dir * d.r, d.h, 0);
    b.position.set(-c.dir * d.r, -d.h, 0);
    p.rotation.z = -c.dir * c.tilt;

    // Water plane in world space. When tipped, the level drops toward the jug's middle.
    const frac = c.litres / cap;
    b.updateWorldMatrix(true, false);
    const center = tmp.set(0, d.base + liquidH / 2, 0).applyMatrix4(b.matrixWorld);
    const cos = Math.cos(c.tilt);
    const level = center.y + ((frac * d.hc) / liquidH - 0.5) * liquidH * Math.max(cos, 0.2);
    const u = mat.uniforms;
    u.uLevel.value = frac < 0.004 ? -10 : level;
    u.uBottom.value = -5;
    u.uCenter.value.copy(center);
    u.uTime.value += dt;
    u.uGlow.value += ((glow ? 1 : 0) - u.uGlow.value) * Math.min(1, dt * 3);

    // Slosh: a damped spring pushed by the jug's acceleration.
    const sl = slosh.current;
    if (!sl.init) {
      sl.last.copy(center);
      sl.init = true;
    }
    const vx = (center.x - sl.last.x) / Math.max(dt, 1e-3);
    const vz = (center.z - sl.last.z) / Math.max(dt, 1e-3);
    sl.last.copy(center);
    const ax = (vx - sl.vx) * 0.004;
    const az = (vz - sl.vz) * 0.004;
    sl.vx = vx;
    sl.vz = vz;
    sl.x = (sl.x - ax) * Math.exp(-dt * 2.5);
    sl.z = (sl.z - az) * Math.exp(-dt * 2.5);
    const wob = Math.sin(performance.now() * 0.011);
    u.uSlosh.value.set(THREE.MathUtils.clamp(sl.x * wob, -0.35, 0.35), THREE.MathUtils.clamp(sl.z * wob, -0.35, 0.35));

    if (label.current) {
      const shown = Math.round(c.litres);
      const text = `${shown} / ${cap} L`;
      if (label.current.textContent !== text) label.current.textContent = text;
      // Gold only once the water has settled at the goal, not while it flows past it.
      const settledAtGoal = shown === GOAL && Math.abs(c.litres - GOAL) < 1e-3;
      label.current.parentElement!.style.background = settledAtGoal ? 'linear-gradient(#fff3b0,#ffd166)' : 'rgba(255,255,255,.92)';
    }
  });

  return (
    <>
    <instancedMesh ref={sprayMesh} args={[undefined, sprayMaterial, 40]} frustumCulled={false}>
      <icosahedronGeometry args={[0.035, 0]} />
    </instancedMesh>
    <group ref={root}>
      <group ref={pivot}>
        <group ref={body}>
          <Clickable onClick={onClick} disabled={disabled} hoverScale={1.05}>
            <mesh ref={liquid} position-y={d.base + liquidH / 2} material={mat} renderOrder={1}>
              <cylinderGeometry args={[innerR, innerR, liquidH, 32, 1]} />
            </mesh>
            <mesh geometry={geo} material={glassMaterial} renderOrder={2} castShadow />
            <mesh position-y={d.h + 0.004} rotation-x={Math.PI / 2} material={rimMaterial}>
              <torusGeometry args={[d.r + 0.002, 0.012, 6, 40]} />
            </mesh>
            {/* Only the "full" line: there are no marks in between, that is the riddle. */}
            <mesh position-y={d.base + d.hc} rotation-x={Math.PI / 2} material={tickMaterial}>
              <torusGeometry args={[d.r + 0.002, 0.005, 4, 40]} />
            </mesh>
            {/* Handle at the back. */}
            <mesh position={[0, d.h * 0.55, -d.r - 0.08]} rotation-y={Math.PI / 2} material={glassMaterial} renderOrder={2}>
              <torusGeometry args={[d.h * 0.24, 0.028, 8, 20, Math.PI]} />
            </mesh>
            {/* Colored foot ring so the two jugs are easy to tell apart. */}
            <mesh position-y={0.012} material={toon(id === 'small' ? '#3aa58d' : '#e07a5f', { rough: 0.6 })} castShadow>
              <cylinderGeometry args={[d.r + 0.015, d.r + 0.025, 0.025, 32]} />
            </mesh>
            {/* Big invisible hit area for phones. */}
            <mesh position-y={d.h / 2} visible={false}>
              <cylinderGeometry args={[d.r + 0.25, d.r + 0.25, d.h + 0.4, 8]} />
            </mesh>
          </Clickable>
        </group>
      </group>
      <Overlay follow={root} position={[0, d.h + 0.32, 0]} zIndex={4} shrink>
        <div
          style={{
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            padding: '3px 10px',
            borderRadius: 999,
            color: '#1f2937',
            background: 'rgba(255,255,255,.92)',
            boxShadow: `0 3px 0 ${id === 'small' ? '#3aa58d' : '#e07a5f'}, 0 8px 16px rgba(0,0,0,.25)`,
            whiteSpace: 'nowrap',
            transition: 'background .3s',
          }}
        >
          <span ref={label} />
        </div>
      </Overlay>
    </group>
    </>
  );
}
