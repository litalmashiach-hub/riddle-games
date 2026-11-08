import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Clickable, DizzyStars, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { COLS, ROWS, type Tilt } from './rules';
import { BEAM_Y, PAD_Y, cellPos, type V3 } from './layout';

/** Gentle bob of the lily pad at a cell, shared by everything that sits on it. */
export const padBob = (c: number, r: number, t: number) => Math.sin(t * 1.3 + c * 1.7 + r * 2.3) * 0.018;

// ---------------------------------------------------------------- lily pads

function padGeometry(radius: number) {
  const s = new THREE.Shape();
  const notch = 0.42;
  s.moveTo(0, 0);
  s.absarc(0, 0, radius, notch / 2, Math.PI * 2 - notch / 2, false);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 20 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.03, 0);
  return g;
}

/** The 5x5 grid of lily pads (one draw call), plus scattered extra pads outside it. */
export function LilyPads({ extra = [] }: { extra?: { x: number; z: number; s: number; a: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const veins = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => padGeometry(0.6), []);
  const veinGeo = useMemo(() => new THREE.RingGeometry(0.18, 0.22, 20, 1, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, flatShading: true }), []);
  const veinMat = useMemo(() => toon('#a6e36b', { emissive: '#7bd35a', emissiveIntensity: 0.35 }), []);
  const cells = useMemo(() => {
    const out: { c: number; r: number; x: number; z: number; s: number; a: number }[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const [x, , z] = cellPos(c, r);
        out.push({ c, r, x, z, s: 1, a: ((c * 7 + r * 13) % 10) * 0.63 });
      }
    extra.forEach((e, i) => out.push({ c: 9 + i, r: 9 + i * 2, ...e }));
    return out;
  }, [extra]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const greens = ['#4fa35a', '#5cb365', '#46994f', '#62b85c'];
    cells.forEach((p, i) => m.setColorAt(i, new THREE.Color(greens[(p.c * 3 + p.r) % greens.length])));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cells]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cells.forEach((p, i) => {
      dummy.position.set(p.x, PAD_Y + padBob(p.c, p.r, t), p.z);
      dummy.rotation.set(Math.sin(t * 0.9 + i) * 0.03, p.a + Math.sin(t * 0.3 + i) * 0.05, Math.cos(t * 1.1 + i) * 0.03);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.035;
      dummy.updateMatrix();
      veins.current?.setMatrixAt(i, dummy.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (veins.current) veins.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, cells.length]} castShadow receiveShadow />
      <instancedMesh ref={veins} args={[veinGeo, veinMat, cells.length]} />
    </group>
  );
}

// ---------------------------------------------------------------- crystal mirror

function shardShape() {
  // An elongated crystal: pointed top, flat-ish bottom.
  const s = new THREE.Shape();
  const w = 0.5;
  s.moveTo(-w, 0);
  s.lineTo(w, 0);
  s.lineTo(w * 0.95, 0.5);
  s.lineTo(w * 0.45, 0.78);
  s.lineTo(0, 0.86);
  s.lineTo(-w * 0.45, 0.78);
  s.lineTo(-w * 0.95, 0.5);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -0.03);
  return g;
}

let crystalGeo: THREE.ExtrudeGeometry | null = null;
const tiltAngle = (t: Tilt) => (t === '/' ? Math.PI / 4 : -Math.PI / 4);

export interface CrystalProps {
  c: number;
  r: number;
  tilt: Tilt;
  /** Is the moonbeam bouncing off this crystal right now? (read every frame) */
  lit: RefObject<boolean[]>;
  index: number;
  onClick(): void;
  disabled: boolean;
  /** Spin wildly (the toad's sneeze). */
  blown: boolean;
  /** Little happy dance on a win. */
  party: boolean;
}

export function Crystal({ c, r, tilt, lit, index, onClick, disabled, blown, party }: CrystalProps) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const glowRing = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => (crystalGeo ??= shardShape()), []);
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e3efff',
        metalness: 0.75,
        roughness: 0.08,
        emissive: new THREE.Color('#6d5bd0'),
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.93,
        flatShading: true,
      }),
    [],
  );
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#b9a8ff', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }), []);
  const anim = useRef({ angle: tiltAngle(tilt), vel: 0, target: tiltAngle(tilt), hop: -1, blownVel: 0, glow: 0 });

  // Always turn forward by a quarter turn (the crystal looks the same after half a turn).
  useEffect(() => {
    const a = anim.current;
    const want = tiltAngle(tilt);
    let d = (want - a.target) % Math.PI;
    if (d < 0) d += Math.PI;
    if (d > 0.01) {
      a.target += d;
      a.hop = performance.now();
    }
  }, [tilt]);

  useEffect(() => {
    if (blown) anim.current.blownVel = 26 + index * 2;
  }, [blown, index]);

  useFrame(({ clock }, dt) => {
    const a = anim.current;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 1 / 30);
    if (a.blownVel > 0.05) {
      a.angle += a.blownVel * step;
      a.blownVel *= Math.exp(-1.6 * step);
      if (a.blownVel < 1.5) {
        // Settle back to the nearest correct facing.
        let d = (tiltAngle(tilt) - a.angle) % Math.PI;
        if (d < 0) d += Math.PI;
        a.target = a.angle + d;
        a.blownVel = 0;
      }
    } else {
      // Springy turn with a little overshoot.
      a.vel += (a.target - a.angle) * 140 * step;
      a.vel *= Math.exp(-11 * step);
      a.angle += a.vel * step;
    }
    const hopT = a.hop < 0 ? 1 : (performance.now() - a.hop) / 420;
    const hopY = hopT < 1 ? Math.sin(Math.PI * hopT) * 0.22 : 0;
    const dance = party ? Math.abs(Math.sin(t * 5 + index)) * 0.15 : 0;
    if (spin.current) spin.current.rotation.y = a.angle;
    if (root.current) {
      root.current.position.y = padBob(c, r, t) + hopY + dance;
      root.current.rotation.z = party ? Math.sin(t * 5 + index) * 0.08 : 0;
    }
    const on = lit.current?.[index] ?? false;
    a.glow = THREE.MathUtils.damp(a.glow, on ? 1 : 0, 6, dt);
    glass.emissiveIntensity = 0.45 + a.glow * 1.5 + Math.sin(t * 2 + index) * 0.08 + (hopT < 1 ? (1 - hopT) * 1.5 : 0);
    glass.emissive.setRGB(0.43 + a.glow * 0.25, 0.36 + a.glow * 0.35, 0.82 + a.glow * 0.18);
    ringMat.opacity = disabled ? 0.12 : 0.28 + Math.sin(t * 3 + index) * 0.1;
    if (glowRing.current) glowRing.current.rotation.z = t * 0.6;
  });

  const [x, , z] = cellPos(c, r);
  return (
    <group position={[x, 0, z]}>
      <group ref={root}>
        <Clickable onClick={onClick} disabled={disabled} hoverScale={1.08}>
          {/* turn track: shows the crystal can spin */}
          <mesh ref={glowRing} rotation-x={-Math.PI / 2} position-y={PAD_Y + 0.07} material={ringMat}>
            <ringGeometry args={[0.46, 0.5, 40, 1, 0, Math.PI * 1.7]} />
          </mesh>
          {/* moonstone pedestal */}
          <mesh position-y={PAD_Y + 0.1} castShadow receiveShadow material={toon('#8d93b8', { rough: 0.6 })}>
            <cylinderGeometry args={[0.2, 0.26, 0.12, 7]} />
          </mesh>
          <group ref={spin}>
            <mesh geometry={geo} material={glass} position-y={PAD_Y + 0.14} scale={[0.95, 0.85, 1]} castShadow />
            {/* silver rim along the bottom */}
            <mesh position-y={PAD_Y + 0.15} material={toon('#d9dcf2', { metal: 0.8, rough: 0.3 })}>
              <boxGeometry args={[1.0, 0.05, 0.14]} />
            </mesh>
          </group>
          {/* little shards around the foot */}
          {[0, 1, 2].map((i) => {
            const a = i * 2.1 + index;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.3, PAD_Y + 0.1, Math.sin(a) * 0.3]}
                rotation={[0.3, a, 0.2]}
                scale={[0.05, 0.13 + i * 0.03, 0.05]}
                material={toon(i === 1 ? '#7ef0d8' : '#c4b5fd', { emissive: i === 1 ? '#2dd4bf' : '#8b5cf6', emissiveIntensity: 2.2 })}
              >
                <octahedronGeometry args={[1, 0]} />
              </mesh>
            );
          })}
          <mesh position-y={0.45} visible={false}>
            <sphereGeometry args={[0.62, 8, 8]} />
          </mesh>
        </Clickable>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- moon-flower

export function MoonFlower({ c, r, index, lit, closed, party }: { c: number; r: number; index: number; lit: RefObject<boolean[]>; closed: boolean; party: boolean }) {
  const high = useSettings((s) => s.quality) === 'high';
  const root = useRef<THREE.Group>(null);
  const petals = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const pollen = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const open = useRef(0);
  const petalMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b4f8a', emissive: new THREE.Color('#b8a6ff'), emissiveIntensity: 0.15, roughness: 0.6, flatShading: true }), []);
  const innerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b5fa0', emissive: new THREE.Color('#e9d5ff'), emissiveIntensity: 0.15, roughness: 0.6, flatShading: true }), []);
  const heartMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffe8a3', emissive: new THREE.Color('#ffd166'), emissiveIntensity: 0.4, roughness: 0.4, flatShading: true }), []);
  const dim = useMemo(() => new THREE.Color('#5b4f8a'), []);
  const bright = useMemo(() => new THREE.Color('#f5f0ff'), []);
  const OUTER = 7;
  const INNER = 5;

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const on = !closed && (lit.current?.[index] ?? false);
    open.current = THREE.MathUtils.damp(open.current, on ? 1 : 0, on ? 3.2 : 5, dt);
    const o = open.current;
    petals.current?.children.forEach((p, i) => {
      p.children[0].rotation.x = 0.25 + o * 1.05 + Math.sin(t * 2 + i) * 0.03 * (1 + o);
    });
    inner.current?.children.forEach((p, i) => {
      p.children[0].rotation.x = 0.12 + o * 0.6 + Math.sin(t * 2.4 + i) * 0.03;
    });
    petalMat.color.copy(dim).lerp(bright, o);
    petalMat.emissiveIntensity = 0.15 + o * 1.6;
    innerMat.color.copy(dim).lerp(bright, o);
    innerMat.emissiveIntensity = 0.15 + o * 2.4;
    heartMat.emissiveIntensity = 0.4 + o * 3.2;
    if (light.current) light.current.intensity = o * 2.2;
    if (pollen.current) {
      pollen.current.visible = o > 0.4;
      pollen.current.children.forEach((p, i) => {
        const k = (t * 0.35 + i / 6) % 1;
        const a = i * 1.05 + t * 0.8;
        p.position.set(Math.cos(a) * 0.12 * (1 + k), 0.25 + k * 0.7, Math.sin(a) * 0.12 * (1 + k));
        p.scale.setScalar((1 - k) * 0.025 * o);
      });
    }
    if (root.current) {
      root.current.position.y = padBob(c, r, t) + (party ? Math.abs(Math.sin(t * 4 + index)) * 0.18 : 0);
      root.current.rotation.y = t * (party ? 1.5 : 0.15) + index;
      const s = 1 + o * 0.12 + (closed ? Math.sin(t * 20) * 0.02 : 0);
      root.current.scale.setScalar(s);
    }
  });

  const [x, , z] = cellPos(c, r);
  return (
    <group position={[x, 0, z]}>
      <group ref={root}>
        {/* leaf collar */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, (i / 4) * Math.PI * 2 + 0.4, 0]} position-y={PAD_Y + 0.07} material={toon('#3f8f52')}>
            <mesh position={[0, 0, 0.2]} scale={[0.1, 0.025, 0.2]} material={toon('#3f8f52')}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          </mesh>
        ))}
        <group position-y={PAD_Y + 0.12}>
          <group ref={petals}>
            {Array.from({ length: OUTER }, (_, i) => (
              <group key={i} rotation-y={(i / OUTER) * Math.PI * 2}>
                <group>
                  <mesh position={[0, 0.2, 0]} scale={[0.1, 0.22, 0.035]} material={petalMat} castShadow>
                    <icosahedronGeometry args={[1, 1]} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
          <group ref={inner}>
            {Array.from({ length: INNER }, (_, i) => (
              <group key={i} rotation-y={(i / INNER) * Math.PI * 2 + 0.3}>
                <group>
                  <mesh position={[0, 0.15, 0]} scale={[0.07, 0.16, 0.03]} material={innerMat}>
                    <icosahedronGeometry args={[1, 1]} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
          <mesh position-y={0.1} material={heartMat}>
            <icosahedronGeometry args={[0.07, 1]} />
          </mesh>
          <group ref={pollen}>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} material={heartMat}>
                <octahedronGeometry args={[1, 0]} />
              </mesh>
            ))}
          </group>
        </group>
        {high && <pointLight ref={light} position={[0, 0.6, 0]} color="#c9b8ff" intensity={0} distance={2.6} decay={2} />}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- moss rock

export function MossRock({ c, r }: { c: number; r: number }) {
  const [x, , z] = cellPos(c, r);
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.25} scale={[0.5, 0.42, 0.45]} castShadow receiveShadow material={toon('#6b7280')}>
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position={[0.05, 0.52, 0]} scale={[0.42, 0.14, 0.36]} material={toon('#4d8f4a')}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      {[
        [0.18, 0.62, 0.1, 1],
        [0.05, 0.6, 0.2, 0.7],
      ].map(([mx, my, mz, s], i) => (
        <group key={i} position={[mx, my, mz]} scale={s}>
          <mesh position-y={0.05} material={toon('#f1f5f9')}>
            <cylinderGeometry args={[0.025, 0.03, 0.1, 6]} />
          </mesh>
          <mesh position-y={0.11} material={toon('#67e8f9', { emissive: '#22d3ee', emissiveIntensity: 2.6 })}>
            <sphereGeometry args={[0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- moonstone lantern (beam source)

export function MoonLantern({ position }: { position: V3 }) {
  const high = useSettings((s) => s.quality) === 'high';
  const orb = useRef<THREE.Mesh>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const shaftMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.7, 1.2), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    orb.current?.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    shaftMat.opacity = 0.05 + Math.sin(t * 1.7) * 0.015;
    if (shaft.current) shaft.current.rotation.y = t * 0.2;
  });
  return (
    <group position={position}>
      {/* little rock island */}
      <mesh position-y={0.02} scale={[0.75, 0.22, 0.75]} receiveShadow castShadow material={toon('#4b5a6e')}>
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position-y={0.18} scale={[0.6, 0.08, 0.6]} material={toon('#4d8f4a')}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh position-y={0.3} castShadow material={toon('#a7adcf', { rough: 0.6 })}>
        <cylinderGeometry args={[0.12, 0.17, 0.26, 6]} />
      </mesh>
      {/* crescent cradle */}
      <mesh position-y={BEAM_Y} rotation={[0, Math.PI / 2, 0]} material={toon('#e5e7f5', { metal: 0.7, rough: 0.3 })}>
        <torusGeometry args={[0.2, 0.035, 6, 18, Math.PI * 1.25]} />
      </mesh>
      <mesh ref={orb} position-y={BEAM_Y} material={toon('#f1f5ff', { emissive: '#dbe6ff', emissiveIntensity: 4 })}>
        <icosahedronGeometry args={[0.14, 2]} />
      </mesh>
      {/* moonlight pouring down into the orb */}
      <mesh ref={shaft} position-y={BEAM_Y + 3.2} material={shaftMat}>
        <cylinderGeometry args={[0.32, 0.12, 6.4, 16, 1, true]} />
      </mesh>
      {high && <pointLight position={[0, BEAM_Y + 0.2, 0]} color="#c7d2fe" intensity={2.5} distance={4} decay={2} />}
    </group>
  );
}

// ---------------------------------------------------------------- sleepy toad

export type ToadMode = 'sleep' | 'tickle' | 'sneeze' | 'fly' | 'after' | 'yawn' | 'dream';

const TOAD = {
  skin: '#7cc95a',
  dark: '#4e9a3a',
  belly: '#e6f5b8',
  cap: '#5b6ee8',
  capBand: '#fef3c7',
};

/** Floating "z Z z" snore letters (HTML, mounted a moment after load so it never sticks empty). */
function Snore({ position }: { position: V3 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'relative', width: 60, height: 70, fontFamily: 'Fredoka, system-ui, sans-serif', fontWeight: 700, color: '#e0e7ff', textShadow: '0 2px 6px rgba(30,27,75,.8)' }}>
        {['z', 'Z', 'z'].map((ch, i) => (
          <span
            key={i}
            style={{ position: 'absolute', left: 8 + i * 14, bottom: 0, fontSize: 14 + i * 5, opacity: 0, animation: `toad-z 2.7s ease-out ${i * 0.9}s infinite` }}
          >
            {ch}
          </span>
        ))}
      </div>
      <style>{`@keyframes toad-z{0%{transform:translate(0,0) scale(.6);opacity:0}20%{opacity:1}100%{transform:translate(14px,-56px) scale(1.2);opacity:0}}`}</style>
    </Html>
  );
}

/**
 * The sleepy toad in his nightcap. `facing` is the yaw he looks along; `fly` is the
 * direction (x, z) he gets launched in by his own sneeze.
 */
export function Toad({ c, r, mode, facing, fly }: { c: number; r: number; mode: ToadMode; facing: number; fly: [number, number] }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const sac = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouthOpen = useRef<THREE.Mesh>(null);
  const since = useRef(performance.now());
  const capFly = useRef(new THREE.Vector3());
  useEffect(() => {
    since.current = performance.now();
  }, [mode]);

  const home = useMemo(() => new THREE.Vector3(...cellPos(c, r, PAD_Y + 0.02)), [c, r]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const e = (performance.now() - since.current) / 1000;
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    let pos = home.clone();
    pos.y += padBob(c, r, t);
    let tumble = 0;
    let squashY = 1 + Math.sin(t * 2.4) * 0.035;
    let sacS = 0.6 + Math.max(0, Math.sin(t * 2.4)) * 0.5;
    let awake = false;
    let mouth = 0;
    let wobble = 0;
    let capOff = false;

    if (mode === 'tickle') {
      // Nose twitches, the throat swells: "Ah... ah..."
      const k = Math.min(1, e / 0.9);
      squashY = 1 + k * 0.18 + Math.sin(t * 30) * 0.03 * k;
      sacS = 0.7 + k * 1.3;
      wobble = Math.sin(t * 24) * 0.06 * k;
      b.rotation.x = -0.25 * k; // head tips back
      mouth = 0.3 * k;
    } else if (mode === 'sneeze') {
      squashY = 0.7;
      sacS = 0.4;
      b.rotation.x = 0.45;
      mouth = 1;
      awake = true;
      capOff = true;
    } else if (mode === 'fly' || mode === 'after') {
      awake = true;
      capOff = true;
      const k = mode === 'fly' ? Math.min(1, e / 0.9) : 1;
      const dist = 1.7;
      pos = home.clone();
      pos.x += fly[0] * dist * k;
      pos.z += fly[1] * dist * k;
      pos.y += Math.sin(Math.PI * k) * 1.7 - k * 0.32;
      tumble = mode === 'fly' ? k * Math.PI * 4 : 0;
      if (mode === 'after') {
        // Bobbing in the water, only the head up, a bit dazed.
        pos.y = -0.12 + Math.sin(t * 2.2) * 0.05;
        wobble = Math.sin(t * 1.6) * 0.15;
        mouth = 0.2 + Math.max(0, Math.sin(t * 3)) * 0.2;
      }
      b.rotation.x = 0;
      squashY = 1;
      sacS = 0.5;
    } else if (mode === 'yawn') {
      awake = e > 0.4;
      const k = Math.min(1, e / 0.8);
      squashY = 1 + Math.sin(Math.min(1, e / 1.6) * Math.PI) * 0.25;
      mouth = Math.sin(Math.min(1, e / 1.6) * Math.PI) * 1.1;
      b.rotation.x = -0.2 * k;
    } else if (mode === 'dream') {
      sacS = 0.6 + Math.max(0, Math.sin(t * 2.4)) * 0.5;
      wobble = Math.sin(t * 1.8) * 0.05;
    } else {
      b.rotation.x = 0;
    }

    g.position.copy(pos);
    g.rotation.set(tumble * fly[1], facing + wobble, -tumble * fly[0]);
    b.scale.set(1 + (1 - squashY) * 0.6, squashY, 1 + (1 - squashY) * 0.4);
    sac.current?.scale.setScalar(sacS);
    if (lids.current) lids.current.visible = !awake;
    if (eyes.current) eyes.current.visible = awake;
    if (mouthOpen.current) {
      mouthOpen.current.visible = mouth > 0.05;
      mouthOpen.current.scale.set(1, Math.max(0.05, mouth), 1);
    }
    // The nightcap pops off on the sneeze and floats away on the water.
    const cp = cap.current;
    if (cp) {
      if (capOff && mode !== 'sneeze') {
        const k = Math.min(1, e / 1.2);
        const target = capFly.current.set(home.x - fly[0] * 0.2 + fly[1] * 0.9, 0.05 + Math.sin(t * 2) * 0.02, home.z - fly[1] * 0.2 + fly[0] * 0.9);
        if (mode === 'fly') {
          cp.position.lerpVectors(home.clone().setY(0.95), target, k);
          cp.position.y += Math.sin(Math.PI * k) * 1.4;
          cp.rotation.set(k * 6, k * 3, 0);
        } else {
          cp.position.copy(target);
          cp.rotation.set(Math.PI / 2.4, t * 0.3, 0);
        }
      } else if (capOff) {
        cp.position.set(home.x, home.y + 1.05, home.z);
      }
    }
  });

  return (
    <group>
      <group ref={root} scale={1.25}>
        <group ref={body}>
          {/* body */}
          <mesh position-y={0.26} scale={[0.44, 0.28, 0.4]} castShadow material={toon(TOAD.skin)}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          {/* back spots */}
          {[
            [0.18, 0.47, -0.1, 0.07],
            [-0.15, 0.45, -0.16, 0.06],
            [0.02, 0.5, -0.25, 0.05],
          ].map(([x, y, z, s], i) => (
            <mesh key={i} position={[x, y, z]} scale={s} material={toon(TOAD.dark)}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
          {/* head */}
          <mesh position={[0, 0.4, 0.14]} scale={[0.38, 0.22, 0.3]} castShadow material={toon(TOAD.skin)}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          {/* belly */}
          <mesh position={[0, 0.2, 0.2]} scale={[0.32, 0.18, 0.22]} material={toon(TOAD.belly)}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          {/* throat sac (snores) */}
          <mesh ref={sac} position={[0, 0.27, 0.36]} material={toon('#f6f0c4', { rough: 0.4 })}>
            <icosahedronGeometry args={[0.12, 2]} />
          </mesh>
          {/* eye bumps */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.17, 0.56, 0.18]} scale={0.12} material={toon(TOAD.skin)}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          ))}
          {/* sleeping lids: happy closed arcs */}
          <group ref={lids}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.17, 0.57, 0.29]} rotation={[0, 0, Math.PI]} material={toon('#1f2937')}>
                <torusGeometry args={[0.05, 0.012, 4, 10, Math.PI]} />
              </mesh>
            ))}
          </group>
          {/* awake: big googly eyes */}
          <group ref={eyes} visible={false}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.17, 0.58, 0.25]}>
                <mesh scale={0.09} material={toon('#ffffff', { rough: 0.3 })}>
                  <icosahedronGeometry args={[1, 1]} />
                </mesh>
                <mesh position={[s * -0.01, 0, 0.07]} scale={0.045} material={toon('#111827', { rough: 0.3 })}>
                  <icosahedronGeometry args={[1, 1]} />
                </mesh>
              </group>
            ))}
          </group>
          {/* smile */}
          <mesh position={[0, 0.38, 0.42]} rotation={[0.2, 0, Math.PI]} material={toon('#2f5d2a')}>
            <torusGeometry args={[0.15, 0.014, 4, 16, Math.PI]} />
          </mesh>
          <mesh ref={mouthOpen} position={[0, 0.33, 0.41]} scale={[1, 0.1, 1]} visible={false} material={toon('#7f1d1d')}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
          {/* rosy cheeks */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.28, 0.4, 0.3]} scale={[0.05, 0.03, 0.02]} material={toon('#fda4af', { emissive: '#fb7185', emissiveIntensity: 0.4 })}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
          {/* feet */}
          {[
            [-0.32, 0.05, 0.22],
            [0.32, 0.05, 0.22],
            [-0.3, 0.05, -0.2],
            [0.3, 0.05, -0.2],
          ].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]} scale={[0.13, 0.05, 0.15]} material={toon(TOAD.dark)}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
          {/* nightcap on the head (hidden once it pops off) */}
          {(mode === 'sleep' || mode === 'tickle' || mode === 'dream' || mode === 'yawn') && <Nightcap position={[0.02, 0.6, 0.0]} rotation={[-0.35, 0, -0.45]} />}
        </group>
        {mode === 'after' && <DizzyStars position={[0, 0.8, 0.1]} radius={0.3} />}
      </group>
      {/* the cap once it has popped off */}
      <group ref={cap}>{!(mode === 'sleep' || mode === 'tickle' || mode === 'dream' || mode === 'yawn') && <Nightcap position={[0, 0, 0]} rotation={[0, 0, 0]} />}</group>
      {(mode === 'sleep' || mode === 'dream') && <Snore position={[home.x + 0.25, 1.05, home.z]} />}
    </group>
  );
}

function Nightcap({ position, rotation }: { position: V3; rotation: V3 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position-y={0.02} rotation-x={Math.PI / 2} material={toon(TOAD.capBand)}>
        <torusGeometry args={[0.15, 0.04, 6, 14]} />
      </mesh>
      <mesh position-y={0.22} material={toon(TOAD.cap)} castShadow>
        <coneGeometry args={[0.15, 0.42, 10]} />
      </mesh>
      <mesh position-y={0.2} rotation-x={Math.PI / 2} material={toon(TOAD.capBand)}>
        <torusGeometry args={[0.085, 0.018, 4, 12]} />
      </mesh>
      <mesh position-y={0.45} material={toon('#ffffff')}>
        <icosahedronGeometry args={[0.065, 1]} />
      </mesh>
    </group>
  );
}
