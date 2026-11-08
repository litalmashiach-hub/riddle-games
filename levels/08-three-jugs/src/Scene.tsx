import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, easeInOut, sfx, useSettings } from '@riddle/fx';
import { Bubble, HintRing, toon } from '@riddle/props';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Alchemist } from './Alchemist';
import { CAPACITY, FLASKS, GOAL, pourAmount, type Flask, type Move, type State } from './rules';
import { SkyLab } from './SkyLab';

// ---- Timeline of one pour (ms from the tap) ----
const LIFT_END = 700;
const TILT_START = 280;
const TILT_END = 820;
const FLOW_START = 820;
const LEVEL_START = 880;
const LEVEL_END = 1760;
const FLOW_END = 1840;
const UNTILT_END = 2150;
const RETURN_START = 1950;
export const MOVE_MS = 2600;

// ---- Layout ----
const X: Record<Flask, number> = { 0: -1.95, 1: 0, 2: 1.95 };
const PEDESTAL = 0.36;
const R = 0.4;
/** Height of one litre inside any flask (all flasks share a radius, so this is the same for all). */
const LITRE = 0.19;
const bodyH = (f: Flask) => CAPACITY[f] * LITRE;
const NECK = 0.46;
/** Height of a flask's mouth above its base. */
const mouthH = (f: Flask) => bodyH(f) + NECK;

const POTION = new THREE.Color('#7417ff');
const POTION_GLOW = new THREE.Color('#d63cff');
const GOLD = new THREE.Color('#ffc21a');
const GOLD_GLOW = new THREE.Color('#ffa000');

interface Anim {
  start: number;
  move: Move;
  prev: State;
  next: State;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const phase = (t: number, a: number, b: number) => easeInOut(clamp01((t - a) / (b - a)));

/** Where the pouring flask's mouth is, how far it is tipped, and how hard it is pouring, at time t. */
function pourPose(anim: Anim, t: number) {
  const f = anim.move.from;
  const to = anim.move.to;
  const dir = Math.sign(X[f] - X[to]);
  const home = new THREE.Vector3(X[f], PEDESTAL + mouthH(f), 0);
  const over = new THREE.Vector3(X[to] + dir * 0.32, PEDESTAL + mouthH(to) + 0.48, 0.05);
  const pos = new THREE.Vector3();
  if (t < RETURN_START) {
    const u = phase(t, 0, LIFT_END);
    pos.lerpVectors(home, over, u);
    pos.y += Math.sin(Math.PI * u) * (Math.abs(X[f] - X[to]) > 3 ? 0.9 : 0.5);
  } else {
    const u = phase(t, RETURN_START, MOVE_MS - 60);
    pos.lerpVectors(over, home, u);
    pos.y += Math.sin(Math.PI * u) * 0.4;
  }
  // Tip further as the flask empties.
  const share = anim.prev[f] > 0 ? 1 - anim.next[f] / anim.prev[f] : 1;
  const deep = 1.2 + 0.45 * share * phase(t, LEVEL_START, LEVEL_END);
  const tip = t < FLOW_END ? phase(t, TILT_START, TILT_END) : 1 - phase(t, FLOW_END, UNTILT_END);
  const tilt = dir * deep * tip;
  const flow = t < FLOW_START ? 0 : t < FLOW_END ? Math.min(clamp01((t - FLOW_START) / 90), clamp01((FLOW_END - t) / 110)) : 0;
  return { pos, tilt, flow };
}

/** The litres shown in each flask right now, animated. */
function useShownLevels(state: State, anim: MutableRefObject<Anim | null>) {
  const shown = useRef<number[]>([...state]);
  useFrame((_, dt) => {
    const a = anim.current;
    const t = a ? performance.now() - a.start : Infinity;
    for (const f of FLASKS) {
      if (a && t < MOVE_MS && (f === a.move.from || f === a.move.to)) {
        shown.current[f] = THREE.MathUtils.lerp(a.prev[f], a.next[f], phase(t, LEVEL_START, LEVEL_END));
      } else {
        shown.current[f] += (state[f] - shown.current[f]) * Math.min(1, dt * 7);
      }
    }
  });
  return shown;
}

// ---- Sound: a bubbly glug while potion flows ----
let ctx: AudioContext | null = null;
function glug(durationMs: number) {
  if (!useSettings.getState().sound || typeof window === 'undefined') return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  const a = ctx;
  const n = Math.round(durationMs / 70);
  for (let i = 0; i < n; i++) {
    const t = a.currentTime + (i / n) * (durationMs / 1000) + Math.random() * 0.03;
    const f0 = 260 + Math.random() * 260 + i * 6;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.1);
  }
}

/** The flask's glass outline, turned on a lathe: straight body, sloped shoulder, neck and lip. */
function flaskGeometry(f: Flask) {
  const H = bodyH(f);
  const pts = [
    [0.001, 0],
    [R - 0.05, 0],
    [R, 0.05],
    [R, H],
    [R - 0.03, H + 0.06],
    [0.2, H + 0.2],
    [0.15, H + 0.3],
    [0.15, H + 0.38],
    [0.2, H + 0.41],
    [0.2, NECK + H],
    [0.15, NECK + H],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 28);
}

const glass = (high: boolean) =>
  new THREE.MeshPhysicalMaterial({
    color: '#bfe3ff',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: high ? 0.24 : 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.2,
    depthWrite: false,
    side: THREE.FrontSide,
  });

interface FlaskProps {
  f: Flask;
  anim: MutableRefObject<Anim | null>;
  shown: MutableRefObject<number[]>;
  selected: boolean;
  shake: MutableRefObject<number[]>;
  winBlend: MutableRefObject<number>;
  disabled: boolean;
  onTap(): void;
}

function FlaskActor({ f, anim, shown, selected, shake, winBlend, disabled, onTap }: FlaskProps) {
  const high = useSettings((s) => s.quality) === 'high';
  const mover = useRef<THREE.Group>(null);
  const tilter = useRef<THREE.Group>(null);
  const liquid = useRef<THREE.Mesh>(null);
  const surface = useRef<THREE.Mesh>(null);
  const bubbles = useRef<THREE.InstancedMesh>(null);
  const H = bodyH(f);
  const M = mouthH(f);
  const geo = useMemo(() => flaskGeometry(f), [f]);
  const glassMat = useMemo(() => glass(high), [high]);
  const glassBack = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a5b4fc', transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false, roughness: 0.2 }),
    [],
  );
  const glint = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), []);
  const liquidMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: POTION.clone(), emissive: POTION_GLOW.clone(), emissiveIntensity: 0.9, roughness: 0.25, flatShading: false }),
    [],
  );
  const surfaceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffd6ff', emissive: POTION_GLOW.clone(), emissiveIntensity: 1.6, roughness: 0.15, toneMapped: false }),
    [],
  );
  const bubbleSeeds = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ a: i * 2.4, r: 0.08 + ((i * 37) % 10) / 45, sp: 0.25 + ((i * 13) % 7) / 18, ph: (i * 0.37) % 1 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, dt) => {
    const now = performance.now();
    const a = anim.current;
    const t = a ? now - a.start : Infinity;
    const g = mover.current;
    const tl = tilter.current;
    if (!g || !tl) return;

    // Position and tilt.
    if (a && a.move.from === f && t < MOVE_MS) {
      const p = pourPose(a, t);
      g.position.copy(p.pos);
      tl.rotation.z = p.tilt + Math.sin(t / 60) * 0.02 * p.flow;
    } else {
      const lift = selected ? 0.24 + Math.sin(clock.elapsedTime * 4) * 0.03 : 0;
      const k = Math.min(1, dt * 10);
      g.position.x += (X[f] - g.position.x) * k;
      g.position.y += (PEDESTAL + M + lift - g.position.y) * k;
      g.position.z += (0 - g.position.z) * k;
      tl.rotation.z += (0 - tl.rotation.z) * k;
    }
    const since = now - shake.current[f];
    if (since < 450) tl.rotation.z += Math.sin(since / 28) * 0.1 * (1 - since / 450);

    // Liquid.
    const lv = Math.max(0, shown.current[f]);
    const h = lv * LITRE;
    const has = lv > 0.02;
    if (liquid.current) {
      liquid.current.visible = has;
      liquid.current.scale.y = Math.max(h - 0.02, 0.001);
      liquid.current.position.y = 0.04 + Math.max(h - 0.02, 0.001) / 2;
    }
    if (surface.current) {
      surface.current.visible = has;
      surface.current.position.y = 0.04 + Math.max(h - 0.02, 0.001) + 0.002;
    }
    // Gold when the riddle is solved.
    const w = winBlend.current;
    liquidMat.color.copy(POTION).lerp(GOLD, w);
    liquidMat.emissive.copy(POTION_GLOW).lerp(GOLD_GLOW, w);
    liquidMat.emissiveIntensity = 0.4 + w * 0.4 + Math.sin(clock.elapsedTime * 2 + f) * 0.08;
    surfaceMat.emissive.copy(POTION_GLOW).lerp(GOLD_GLOW, w);
    surfaceMat.emissiveIntensity = 1.6 + w * 1.4;

    // Rising bubbles.
    const b = bubbles.current;
    if (b) {
      const tt = clock.elapsedTime;
      bubbleSeeds.forEach((s, i) => {
        const u = (tt * s.sp + s.ph) % 1;
        dummy.position.set(Math.cos(s.a + tt * 0.6) * s.r, 0.06 + u * Math.max(h - 0.1, 0), Math.sin(s.a + tt * 0.6) * s.r);
        dummy.scale.setScalar(h > 0.12 ? 0.6 + u * 0.6 : 0);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
    }

  });

  const ticks = useMemo(() => Array.from({ length: CAPACITY[f] - 1 }, (_, i) => i + 1), [f]);

  return (
    <group>
      {/* pedestal */}
      <group position={[X[f], 0, 0]}>
        <mesh position-y={PEDESTAL / 2} material={toon('#b9a8ec', { rough: 0.85 })} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.6, PEDESTAL, 8]} />
        </mesh>
        <mesh position-y={PEDESTAL} rotation-x={Math.PI / 2} material={toon('#f2c14e', { metal: 0.6, rough: 0.35 })}>
          <torusGeometry args={[0.5, 0.03, 5, 24]} />
        </mesh>
        <mesh position={[0, PEDESTAL * 0.5, 0.56]} rotation-x={-0.08} material={toon('#7df9ff', { emissive: '#38e1ff', emissiveIntensity: 2.5 })}>
          <octahedronGeometry args={[0.06, 0]} />
        </mesh>
        <Plaque f={f} shown={shown} />
      </group>

      {/* the flask: pivot is the mouth, so tipping pours from the lip */}
      <group ref={mover} position={[X[f], PEDESTAL + M, 0]}>
        <group ref={tilter}>
          <group position-y={-M}>
            <Clickable onClick={onTap} disabled={disabled} hoverScale={1.04}>
              <mesh ref={liquid} material={liquidMat} renderOrder={1}>
                <cylinderGeometry args={[R - 0.035, R - 0.035, 1, 28]} />
              </mesh>
              <mesh ref={surface} rotation-x={-Math.PI / 2} material={surfaceMat} renderOrder={1}>
                <circleGeometry args={[R - 0.03, 28]} />
              </mesh>
              <instancedMesh ref={bubbles} args={[undefined, undefined, 9]} renderOrder={1}>
                <icosahedronGeometry args={[0.028, 1]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffe6ff" emissiveIntensity={2} toneMapped={false} />
              </instancedMesh>
              <mesh geometry={geo} material={glassBack} renderOrder={0} />
              <mesh geometry={geo} material={glassMat} renderOrder={2} castShadow />
              {/* glints that sell the glass */}
              <mesh position={[-R * 0.62, H * 0.52 + 0.04, R * 0.79]} rotation-y={-0.66} material={glint} renderOrder={3}>
                <planeGeometry args={[0.06, H * 0.78]} />
              </mesh>
              <mesh position={[-R * 0.36, H * 0.5 + 0.04, R * 0.94]} rotation-y={-0.36} material={glint} renderOrder={3}>
                <planeGeometry args={[0.022, H * 0.6]} />
              </mesh>
              {/* litre marks; the 4 L line is gold on the two flasks that must end with 4 */}
              {ticks.map((i) => {
                const goal = i === GOAL && f !== 2;
                return (
                  <mesh
                    key={i}
                    position={[0, i * LITRE + 0.04, R + 0.004]}
                    material={goal ? toon('#ffd166', { emissive: '#ffb020', emissiveIntensity: 2.2 }) : toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 })}
                    renderOrder={3}
                  >
                    <boxGeometry args={[goal ? 0.3 : i % 2 === 0 ? 0.16 : 0.1, 0.014, 0.008]} />
                  </mesh>
                );
              })}
              <mesh position-y={0.02} material={toon('#f2c14e', { metal: 0.6, rough: 0.35 })}>
                <cylinderGeometry args={[R + 0.02, R + 0.04, 0.05, 28]} />
              </mesh>
              <mesh position-y={H + 0.02} rotation-x={Math.PI / 2} material={toon('#f2c14e', { metal: 0.6, rough: 0.35 })}>
                <torusGeometry args={[R + 0.004, 0.014, 4, 28]} />
              </mesh>
              <mesh position-y={H + 0.395} rotation-x={Math.PI / 2} material={toon('#f2c14e', { metal: 0.6, rough: 0.35 })}>
                <torusGeometry args={[0.19, 0.022, 6, 20]} />
              </mesh>
              {/* big invisible hit area, easy to tap on phones (covers the pedestal too) */}
              <mesh position-y={(M - PEDESTAL) / 2} visible={false}>
                <cylinderGeometry args={[0.62, 0.62, M + PEDESTAL + 0.2, 8]} />
              </mesh>
            </Clickable>
          </group>
        </group>
      </group>
    </group>
  );
}

/** A little floating plaque in front of each pedestal: "5 / 8 L". Drawn to a canvas, redrawn when the number changes. */
function Plaque({ f, shown }: { f: Flask; shown: MutableRefObject<number[]> }) {
  const ref = useRef<THREE.Group>(null);
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, tex: t };
  }, []);
  const drawn = useRef(-1);
  const draw = (n: number) => {
    const g = canvas.getContext('2d');
    if (!g) return;
    const goal = n === GOAL && f !== 2;
    g.clearRect(0, 0, 256, 96);
    const grad = g.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, goal ? '#fff3c4' : '#ffffff');
    grad.addColorStop(1, goal ? '#ffc94a' : '#e0e7ff');
    g.fillStyle = 'rgba(30,27,75,.28)';
    g.beginPath();
    g.roundRect(6, 12, 244, 80, 40);
    g.fill();
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(6, 4, 244, 80, 40);
    g.fill();
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    g.fillStyle = goal ? '#7c2d12' : '#312e81';
    g.font = '700 54px Fredoka, system-ui, sans-serif';
    g.fillText(String(n), 112, 46);
    g.textAlign = 'left';
    g.globalAlpha = 0.6;
    g.font = '600 36px Fredoka, system-ui, sans-serif';
    g.fillText(`/ ${CAPACITY[f]} L`, 124, 48);
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  // Fonts may load after the first draw, so draw again once they are ready.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      drawn.current = -1;
    });
    return () => {
      alive = false;
      tex.dispose();
    };
  }, [tex]);
  useFrame(({ clock }) => {
    const n = Math.round(Math.max(0, shown.current[f]));
    if (n !== drawn.current) {
      drawn.current = n;
      draw(n);
    }
    if (ref.current) ref.current.position.y = 0.22 + Math.sin(clock.elapsedTime * 1.8 + f) * 0.025;
  });
  return (
    <group ref={ref} position={[0, 0.22, 0.98]} rotation-x={-0.45}>
      <mesh renderOrder={4}>
        <planeGeometry args={[1.15, 0.43]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** The glowing stream of potion from the tipped flask's lip into the other flask, plus splashes. */
function Stream({ anim, shown, winBlend }: { anim: MutableRefObject<Anim | null>; shown: MutableRefObject<number[]>; winBlend: MutableRefObject<number> }) {
  const high = useSettings((s) => s.quality) === 'high';
  const DROPS = 42;
  const SPLASH = 14;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const v = useMemo(() => ({ p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), q: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const a = anim.current;
    const t = a ? performance.now() - a.start : Infinity;
    const p = a && t < MOVE_MS ? pourPose(a, t) : null;
    const flow = p?.flow ?? 0;
    if (mat.current) mat.current.emissive.copy(POTION_GLOW).lerp(GOLD_GLOW, winBlend.current);
    if (!p || flow <= 0 || !a) {
      if (m.visible) m.visible = false;
      if (light.current) light.current.intensity = 0;
      return;
    }
    m.visible = true;
    const up = new THREE.Vector3(-Math.sin(p.tilt), Math.cos(p.tilt), 0);
    v.p0.copy(p.pos).addScaledVector(up, 0.03);
    v.p1.copy(v.p0).addScaledVector(up, 0.22);
    v.p1.y -= 0.05;
    const to = a.move.to;
    v.p2.set(X[to], PEDESTAL + 0.04 + Math.max(shown.current[to], 0) * LITRE, 0.0);
    const tt = clock.elapsedTime;
    for (let i = 0; i < DROPS; i++) {
      const u = (i / DROPS + tt * 1.6) % 1;
      const iu = 1 - u;
      v.q.set(0, 0, 0).addScaledVector(v.p0, iu * iu).addScaledVector(v.p1, 2 * iu * u).addScaledVector(v.p2, u * u);
      v.q.x += Math.sin(i * 7.3 + tt * 20) * 0.012;
      v.q.z += Math.cos(i * 5.1 + tt * 18) * 0.012;
      dummy.position.copy(v.q);
      const s = flow * (1.15 - u * 0.45) * (0.85 + Math.sin(i * 3.1 + tt * 30) * 0.15);
      dummy.scale.set(s, s * 1.5, s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    for (let j = 0; j < SPLASH; j++) {
      const u = (j / SPLASH + tt * 2.2) % 1;
      const ang = j * 2.39996;
      const r = 0.06 + u * 0.22;
      dummy.position.set(v.p2.x + Math.cos(ang) * r, v.p2.y + Math.sin(Math.PI * u) * 0.25, v.p2.z + Math.sin(ang) * r);
      dummy.scale.setScalar(flow * 0.55 * (1 - u));
      dummy.updateMatrix();
      m.setMatrixAt(DROPS + j, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (light.current) {
      light.current.position.copy(v.p2).setY(v.p2.y + 0.3);
      light.current.intensity = flow * 6;
    }
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, DROPS + SPLASH]} frustumCulled={false} visible={false}>
        <icosahedronGeometry args={[0.062, 1]} />
        <meshStandardMaterial ref={mat} color="#f0b3ff" emissive="#ff4fd8" emissiveIntensity={2.4} roughness={0.2} toneMapped={false} />
      </instancedMesh>
      {high && <pointLight ref={light} color="#ff7ae0" intensity={0} distance={4} decay={2} />}
    </group>
  );
}

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const [selected, setSelected] = useState<Flask | null>(null);
  const [burst, setBurst] = useState(0);
  const [note, setNote] = useState<{ f: Flask; text: string; id: number } | null>(null);
  const anim = useRef<Anim | null>(null);
  const shake = useRef<number[]>([-1e9, -1e9, -1e9]);
  const winBlend = useRef(0);
  const lastCount = useRef(moveCount);
  const shown = useShownLevels(state, anim);
  const won = status.kind === 'won';
  const over = status.kind !== 'playing';

  // Start the pour animation before the next frame, so levels never jump.
  useLayoutEffect(() => {
    const forward = moveCount > lastCount.current;
    lastCount.current = moveCount;
    setSelected(null);
    if (forward && previous && lastMove) {
      anim.current = { start: performance.now(), move: lastMove, prev: previous, next: state };
      const t = setTimeout(() => glug(LEVEL_END - LEVEL_START), LEVEL_START);
      return () => clearTimeout(t);
    }
    anim.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, resetCount]);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS - 200);
    return () => clearTimeout(t);
  }, [won]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 1100);
    return () => clearTimeout(t);
  }, [note]);

  useFrame((_, dt) => {
    const a = anim.current;
    const settled = !a || performance.now() - a.start > LEVEL_END;
    const target = won && settled ? 1 : 0;
    winBlend.current += (target - winBlend.current) * Math.min(1, dt * (target ? 2.5 : 8));
  });

  const deny = (f: Flask, text: string) => {
    sfx.denied();
    shake.current[f] = performance.now();
    setNote({ f, text, id: Math.random() });
  };

  const tap = (f: Flask) => {
    if (busy || over) return;
    if (selected === null) {
      if (state[f] === 0) return deny(f, 'Empty!');
      sfx.select();
      setSelected(f);
      return;
    }
    if (selected === f) {
      sfx.deselect();
      setSelected(null);
      return;
    }
    if (pourAmount(state, selected, f) === 0) return deny(f, 'Full!');
    sfx.click();
    play({ from: selected, to: f });
  };

  const hintFlask: Flask | null = hint ? (selected === hint.from ? hint.to : hint.from) : null;
  const pouring = busy && anim.current != null;
  const lookAt: Flask | null = pouring && anim.current ? anim.current.move.to : selected;
  const ALCH: [number, number, number] = [3.15, 0, -0.75];
  const bodyYaw = -0.75;
  const lookYaw = lookAt === null ? 0 : Math.atan2(X[lookAt] - ALCH[0], 0 - ALCH[2]) - bodyYaw;

  return (
    <group>
      <SkyLab />

      {FLASKS.map((f) => (
        <FlaskActor
          key={f}
          f={f}
          anim={anim}
          shown={shown}
          selected={selected === f}
          shake={shake}
          winBlend={winBlend}
          disabled={busy || over}
          onTap={() => tap(f)}
        />
      ))}
      <Stream anim={anim} shown={shown} winBlend={winBlend} />

      {selected !== null && !busy && <HintRing position={[X[selected], 0.04, 0]} radius={0.82} color="#7ee0b0" />}
      {hintFlask !== null && !busy && !over && <HintRing position={[X[hintFlask], 0.05, 0]} radius={0.95} />}
      {note && <Bubble key={note.id} position={[X[note.f], PEDESTAL + mouthH(note.f) + 0.45, 0]} tone="red">{note.text}</Bubble>}
      {selected !== null && !busy && !over && (
        <Html position={[X[selected], PEDESTAL + mouthH(selected) + 0.75, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontFamily: 'Fredoka, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              color: '#1f2937',
              padding: '4px 12px',
              borderRadius: 999,
              background: 'linear-gradient(#ffffff,#e0e7ff)',
              boxShadow: '0 4px 0 rgba(0,0,0,.15), 0 8px 16px rgba(0,0,0,.2)',
              whiteSpace: 'nowrap',
            }}
          >
            Pour into…
          </div>
        </Html>
      )}

      <group position={ALCH} rotation-y={bodyYaw}>
        <Alchemist mood={won && !busy ? 'happy' : pouring || selected !== null ? 'focus' : 'idle'} lookYaw={lookYaw} />
      </group>
      {won && !busy && <Bubble position={[ALCH[0], 2.1, ALCH[2]]} tone="gold">4 + 4!</Bubble>}

      <Burst trigger={burst} position={[0, 2.6, 0]} />
    </group>
  );
}
