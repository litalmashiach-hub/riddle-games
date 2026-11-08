import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, ComicWord, DizzyStars, FocusCam, Shake, sfx, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing } from '@riddle/props';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { pond } from './audio';
import {
  CELL,
  DROP_MS,
  REACT_MS,
  TEETER_MS,
  UNDER_MS,
  WIND_MS,
  cellPos,
  dirYaw,
  posCell,
  slideMs,
} from './layout';
import { Otter, newRig, type OtterRig } from './Otter';
import { Particles, type ParticlesHandle } from './Particles';
import { Pond, type DriftHandle, type WaterHandle } from './Pond';
import { BASKET, DIRS, STEP, cellsOf, rules, slide, type Dir, type Move, type State, type Stopper } from './rules';

export { MOVE_MS } from './layout';

const SNOW = cellsOf('S');
type Beat = 'teeter' | 'splash' | 'brrr' | null;

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  // Work out during render whether the newest change is a forward move (animate the slide)
  // or an undo / restart (glide back), like level 1.
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    dir.current = { count: moveCount, reset: resetCount, forward: resetCount === dir.current.reset && moveCount > dir.current.count };
  }
  const forward = dir.current.forward;

  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const lost = status.kind === 'lost';

  const particles = useRef<ParticlesHandle>(null);
  const water = useRef<WaterHandle>(null);
  const drifts = useRef<DriftHandle>(null);
  const [beat, setBeat] = useState<Beat>(null);
  const [dizzy, setDizzy] = useState(0);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(0);
  const [ate, setAte] = useState(false);

  // Undo or restart: clear the gags.
  useEffect(() => {
    if (!forward) {
      setBeat(null);
      setDizzy(0);
      setAte(false);
    }
  }, [moveCount, resetCount, forward]);

  useEffect(() => {
    if (!dizzy) return;
    const t = setTimeout(() => setDizzy(0), 1300);
    return () => clearTimeout(t);
  }, [dizzy]);

  const events = useMemo(
    () => ({
      bump(stopper: Stopper, at: Vec3, d: Dir) {
        const [dx, dy] = STEP[d];
        if (stopper === 'rock') {
          pond.bonk();
          setDizzy((n) => n + 1);
          particles.current?.poof(at[0] + dx * CELL * 0.5, at[2] + dy * CELL * 0.5, 8);
        } else if (stopper === 'edge') {
          pond.thud();
          particles.current?.poof(at[0] + dx * CELL * 0.6, at[2] + dy * CELL * 0.6, 22);
        } else if (stopper === 'snow') {
          pond.poof();
          particles.current?.poof(at[0], at[2], 34);
          const i = SNOW.findIndex((s) => {
            const p = cellPos(s.x, s.y);
            return Math.abs(p[0] - at[0]) < 0.1 && Math.abs(p[2] - at[2]) < 0.1;
          });
          if (i >= 0) drifts.current?.hit(i);
        } else if (stopper === 'basket') {
          pond.yum();
          setAte(true);
          setBurst((b) => b + 1);
        }
      },
      teeter() {
        pond.uhoh();
        setBeat('teeter');
      },
      drop() {
        pond.whistle();
      },
      splash(at: Vec3) {
        pond.splash();
        sfx.splash();
        particles.current?.splash(at[0], at[2]);
        water.current?.splash(at[0], at[2]);
        setShake((s) => s + 1);
        setBeat('splash');
      },
      popup(at: Vec3) {
        pond.bloop();
        setBeat('brrr');
        setTimeout(() => pond.brrr(), 350);
        setTimeout(() => particles.current?.spit(at[0], 0.25, at[2] + 0.2), 700);
      },
      spray(x: number, z: number, d: Dir) {
        const [dx, dy] = STEP[d];
        particles.current?.spray(x, z, dx, dy);
      },
    }),
    [],
  );

  // Phones held upright: pull the camera back so the whole pond fits.
  const size = useThree((st) => st.size);
  useFrame(({ camera }) => {
    const aspect = size.width / size.height;
    const zoom = aspect >= 1.15 ? 1 : Math.max(0.42, aspect * 0.82);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.zoom - zoom) > 1e-3) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
  });

  // Input ------------------------------------------------------------------
  const legal = useMemo(() => new Set(rules.legalMoves(state).map((m) => m.dir)), [state]);
  const canPlay = !busy && !over;
  const go = (d: Dir) => {
    if (!canPlay) return;
    if (!legal.has(d)) {
      sfx.denied();
      return;
    }
    pond.hup();
    play({ dir: d });
  };
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const keys: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const d = keys[e.key];
      if (!d || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      goRef.current(d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tap anywhere on the ice in line with the otter to slide that way.
  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!canPlay || e.delta > 8) return;
    const c = posCell(e.point.x, e.point.z);
    if (c.x === state.x && c.y === state.y) return;
    if (c.x === state.x) go(c.y < state.y ? 'up' : 'down');
    else if (c.y === state.y) go(c.x < state.x ? 'left' : 'right');
    else sfx.denied();
  };

  const here = cellPos(state.x, state.y);
  const basket = cellPos(BASKET.x, BASKET.y);

  return (
    <Shake trigger={shake} intensity={0.1}>
      <Pond onPick={onPick} water={water} drifts={drifts} eaten={ate} />
      <Particles ref={particles} />

      <OtterActor
        state={state}
        previous={previous}
        lastMove={lastMove}
        forward={forward}
        animKey={`${moveCount}|${resetCount}`}
        won={won}
        dizzy={dizzy > 0}
        events={events}
      />

      {canPlay &&
        DIRS.filter((d) => legal.has(d)).map((d) => (
          <ArrowPad key={`${d}|${moveCount}|${resetCount}`} dir={d} at={here} hinted={hint?.dir === d} onClick={() => go(d)} />
        ))}
      {canPlay && hint && (
        <HintRing position={[here[0] + STEP[hint.dir][0] * 0.78, 0.04, here[2] + STEP[hint.dir][1] * 0.78]} radius={0.42} />
      )}

      {beat === 'teeter' && <ComicWord position={[here[0], 1.6, here[2]]} text="Uh-oh!" color="#c4f1ff" size={36} tilt={6} />}
      {beat === 'splash' && <ComicWord position={[here[0], 1.5, here[2]]} text="SPLASH!" color="#7fdcff" ink="#0b2e4a" size={54} />}
      {beat === 'brrr' && (
        <>
          <ComicWord position={[here[0], 1.6, here[2]]} text="SPLASH!" color="#7fdcff" ink="#0b2e4a" size={40} />
          <Bubble position={[here[0] + 0.55, 0.85, here[2]]} tone="white">
            Brrr! 🥶
          </Bubble>
        </>
      )}
      <FocusCam target={[here[0], 0, here[2]]} active={lost && beat !== null} closer={0.6} />
      <Burst trigger={burst} position={[basket[0], 0.8, basket[2]]} />
    </Shake>
  );
}

// ---------------------------------------------------------------- otter mover

interface Events {
  bump(stopper: Stopper, at: Vec3, d: Dir): void;
  teeter(): void;
  drop(): void;
  splash(at: Vec3): void;
  popup(at: Vec3): void;
  spray(x: number, z: number, d: Dir): void;
}

interface Run {
  kind: 'slide' | 'back';
  start: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  dir: Dir;
  steps: number;
  stopper: Stopper;
  fired: Set<string>;
  yawFrom: number;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function OtterActor({
  state,
  previous,
  lastMove,
  forward,
  animKey,
  won,
  dizzy,
  events,
}: {
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  animKey: string;
  won: boolean;
  dizzy: boolean;
  events: Events;
}) {
  const mover = useRef<THREE.Group>(null);
  const yawG = useRef<THREE.Group>(null);
  const rig = useRef<OtterRig>(newRig());
  const run = useRef<Run | null>(null);
  const first = useRef(true);
  const lastSpray = useRef(0);

  useEffect(() => {
    const m = mover.current;
    if (!m) return;
    const target = new THREE.Vector3(...cellPos(state.x, state.y));
    if (first.current) {
      first.current = false;
      m.position.copy(target);
      return;
    }
    const yawFrom = yawG.current?.rotation.y ?? 0;
    if (forward && lastMove && previous) {
      const s = slide(previous, lastMove.dir);
      run.current = { kind: 'slide', start: performance.now(), from: new THREE.Vector3(...cellPos(previous.x, previous.y)), to: target, dir: lastMove.dir, steps: s.steps, stopper: s.stopper, fired: new Set(), yawFrom };
    } else {
      run.current = { kind: 'back', start: performance.now(), from: m.position.clone(), to: target, dir: 'down', steps: 0, stopper: 'edge', fired: new Set(), yawFrom };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  useFrame(() => {
    const m = mover.current;
    const yg = yawG.current;
    const r = run.current;
    const g = rig.current;
    if (!m || !yg) return;
    if (!r) {
      // Idle on the ice (first load).
      g.happy = won ? 1 : 0;
      return;
    }
    const now = performance.now();
    const e = now - r.start;
    const once = (name: string, fn: () => void) => {
      if (!r.fired.has(name)) {
        r.fired.add(name);
        fn();
      }
    };

    if (r.kind === 'back') {
      const u = clamp01(e / 380);
      m.position.lerpVectors(r.from, r.to, ease(u));
      m.position.y = Math.sin(Math.PI * u) * 0.35 + (r.from.y < -0.05 ? r.from.y * (1 - u) : 0);
      Object.assign(g, { lie: g.lie * (1 - u), flail: 0, shiver: 0, wet: 0, fish: 0, happy: 0, squash: 1 });
      yg.rotation.y = r.yawFrom + angleDiff(r.yawFrom, 0) * ease(u);
      return;
    }

    const d = r.dir;
    const [dx, dy] = STEP[d];
    const yawTo = dirYaw(d);
    const S = slideMs(r.steps);
    const tEnd = WIND_MS + S;
    const hard = r.stopper === 'rock' || r.stopper === 'edge';

    // 1. Wind-up: turn, crouch and flop onto the belly.
    if (e < WIND_MS) {
      const u = e / WIND_MS;
      yg.rotation.y = r.yawFrom + angleDiff(r.yawFrom, yawTo) * ease(Math.min(1, u * 1.6));
      g.lie = ease(u);
      g.squash = 1 - Math.sin(Math.PI * Math.min(1, u * 1.5)) * 0.25;
      m.position.set(r.from.x + dx * 0.1 * u, Math.sin(Math.PI * u) * 0.12, r.from.z + dy * 0.1 * u);
      return;
    }
    yg.rotation.y = yawTo;

    // 2. The slide itself.
    if (e < tEnd) {
      once('whoosh', () => pond.slide(S / 1000 + 0.15));
      const u = (e - WIND_MS) / S;
      const p = hard ? u : 1 - Math.pow(1 - u, 2);
      const sx = r.from.x + dx * 0.1;
      const sz = r.from.z + dy * 0.1;
      const ex = r.stopper === 'basket' ? r.to.x - dx * 0.5 : r.to.x;
      const ez = r.stopper === 'basket' ? r.to.z - dy * 0.5 : r.to.z;
      m.position.set(THREE.MathUtils.lerp(sx, ex, p), 0, THREE.MathUtils.lerp(sz, ez, p));
      g.lie = 1;
      g.squash = 1;
      if (now - lastSpray.current > 30) {
        lastSpray.current = now;
        events.spray(m.position.x, m.position.z, d);
      }
      return;
    }

    const k = e - tEnd;
    const at: Vec3 = [r.to.x, 0, r.to.z];
    // At the basket, stop just in front of it so it stays in view.
    const stopX = r.stopper === 'basket' ? r.to.x - dx * 0.5 : r.to.x;
    const stopZ = r.stopper === 'basket' ? r.to.z - dy * 0.5 : r.to.z;

    // 3a. The ice hole: cartoon teeter, drop, splash, pop back up shivering.
    if (r.stopper === 'hole') {
      if (k < TEETER_MS) {
        once('teeter', events.teeter);
        const u = k / TEETER_MS;
        m.position.set(r.to.x, Math.min(1, u * 4) * 0.12, r.to.z);
        g.lie = Math.max(0, 1 - u * 5);
        g.flail = Math.min(1, u * 4);
        g.squash = 1;
        // Look down, then at the camera, as cartoon characters do.
        yg.rotation.y = yawTo + angleDiff(yawTo, 0) * ease(clamp01(u * 2 - 0.6));
        return;
      }
      if (k < TEETER_MS + DROP_MS) {
        once('drop', events.drop);
        const u = (k - TEETER_MS) / DROP_MS;
        m.position.set(r.to.x, 0.12 - u * u * 1.3, r.to.z);
        g.squash = 1 + u * 0.35;
        g.flail = 1;
        yg.rotation.y = 0;
        return;
      }
      if (k < TEETER_MS + DROP_MS + UNDER_MS) {
        once('splash', () => events.splash(at));
        m.position.set(r.to.x, -1.3, r.to.z);
        g.flail = 0;
        g.squash = 1;
        return;
      }
      once('popup', () => events.popup(at));
      const u = clamp01((k - TEETER_MS - DROP_MS - UNDER_MS) / 450);
      const bob = Math.sin(now / 320) * 0.03;
      // Spring up with a little overshoot.
      const spring = 1 - Math.cos(u * Math.PI * 2.5) * Math.exp(-u * 4);
      m.position.set(r.to.x, -1.3 + 0.68 * spring + bob, r.to.z);
      g.wet = 1;
      g.shiver = 1;
      g.lie = 0;
      g.flail = 0;
      yg.rotation.y = 0;
      return;
    }

    // 3b. Bump into a rock, the rim, a snow drift or the basket.
    if (k < REACT_MS + 600) {
      once('bump', () => events.bump(r.stopper, at, d));
      const u = clamp01(k / REACT_MS);
      if (hard) {
        // Squash against it, bounce back a touch, then sit up.
        const back = Math.sin(Math.PI * clamp01(k / 260)) * 0.12;
        m.position.set(r.to.x - dx * back, 0, r.to.z - dy * back);
        g.squash = 1 - 0.35 * Math.exp(-k / 120) * Math.cos(k / 40);
      } else {
        m.position.set(stopX, Math.sin(Math.PI * clamp01(k / 300)) * 0.18, stopZ);
        g.squash = 1 + 0.2 * Math.exp(-k / 150) * Math.sin(k / 45);
      }
      g.lie = 1 - ease(u);
      if (r.stopper === 'basket') {
        g.fish = ease(u);
        g.happy = won ? clamp01(k / 300) : 0;
        yg.rotation.y = yawTo + angleDiff(yawTo, 0) * ease(u);
      }
      return;
    }
    g.squash = 1;
    g.lie = 0;
    m.position.set(stopX, 0, stopZ);
    if (r.stopper === 'basket') {
      g.fish = 1;
      g.happy = won ? 1 : 0;
      yg.rotation.y = 0;
    }
  });

  return (
    <group ref={mover}>
      <group ref={yawG}>
        <group scale={1.3}>
          <Otter rig={rig} />
        </group>
      </group>
      <DizzyStars position={[0, 1.2, 0]} visible={dizzy} radius={0.26} />
    </group>
  );
}

const angleDiff = (from: number, to: number) => {
  const d = to - from;
  return Math.atan2(Math.sin(d), Math.cos(d));
};

// ---------------------------------------------------------------- arrows

const arrowShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.26);
  s.lineTo(0.22, 0.02);
  s.lineTo(0.09, 0.02);
  s.lineTo(0.09, -0.2);
  s.lineTo(-0.09, -0.2);
  s.lineTo(-0.09, 0.02);
  s.lineTo(-0.22, 0.02);
  s.closePath();
  return s;
})();
const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });

/** A glowing arrow on the ice next to the otter. Tap it to slide that way. */
function ArrowPad({ dir, at, hinted, onClick }: { dir: Dir; at: Vec3; hinted: boolean; onClick(): void }) {
  const ref = useRef<THREE.Group>(null);
  const [dx, dy] = STEP[dir];
  const color = hinted ? '#ffd166' : '#bef264';
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 }), [color]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 4;
    const push = 0.72 + (Math.sin(t) * 0.5 + 0.5) * 0.08;
    g.position.set(at[0] + dx * push, 0.06, at[2] + dy * push);
    // Pop in.
    g.scale.setScalar(Math.min(1, g.scale.x + 0.08));
  });
  return (
    <group ref={ref} position={[at[0] + dx * 0.72, 0.06, at[2] + dy * 0.72]} scale={0.01}>
      <Clickable onClick={onClick}>
        {/* Shape points along +y; lay it flat and turn it to face the slide direction. */}
        <group rotation={[0, dirYaw(dir), 0]}>
          <mesh geometry={arrowGeo} material={mat} rotation-x={Math.PI / 2} scale={hinted ? 1.25 : 1} castShadow />
          <mesh visible={false}>
            <boxGeometry args={[0.6, 0.4, 0.6]} />
          </mesh>
        </group>
      </Clickable>
    </group>
  );
}
