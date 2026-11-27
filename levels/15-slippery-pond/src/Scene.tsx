import type { SceneProps } from '@riddle/engine';
import { Burst, ComicWord, DizzyStars, FocusCam, Shake, reducedMotion, sfx, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, RefusalMark, useRefusal } from '@riddle/props';
import { useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
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
import { usePond } from './context';
import { DIRS, STEP, type Dir, type Move, type State, type Stopper } from './rules';

export { MOVE_MS } from './layout';

type Beat = 'teeter' | 'splash' | 'brrr' | null;

/**
 * How far (CSS pixels) a finger may wander between press and lift and still count as a press on an arrow.
 * Further than this, it was turning the camera. iOS's own tap allows about as much.
 */
const PRESS_SLOP = 12;
/** After an arrow press, the click that the browser sends for the same touch is not a second tap on the ice. */
const PRESS_ECHO_MS = 600;

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const puzzle = usePond();
  const { basket: BASKET, rules } = puzzle;
  const SNOW = useMemo(() => puzzle.cellsOf('S'), [puzzle]);
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

  // The fail scene's late beats (the shiver, the spat-out water). An undo or restart cancels the ones still to come.
  const later = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelLater = () => {
    later.current.forEach(clearTimeout);
    later.current = [];
  };
  useEffect(() => cancelLater, []);

  // Undo or restart: clear the gags.
  useEffect(() => {
    if (!forward) {
      cancelLater();
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
        later.current.push(
          setTimeout(() => pond.brrr(), 350),
          setTimeout(() => particles.current?.spit(at[0], 0.25, at[2] + 0.2), 700),
        );
      },
      spray(x: number, z: number, d: Dir) {
        const [dx, dy] = STEP[d];
        particles.current?.spray(x, z, dx, dy);
      },
    }),
    [],
  );

  // Input ------------------------------------------------------------------
  const legal = useMemo(() => new Set(rules.legalMoves(state).map((m) => m.dir)), [state]);
  const canPlay = !busy && !over;
  const [nope, setNope] = useState(0);
  const refusal = useRefusal();
  const go = (d: Dir) => {
    if (!canPlay) return;
    if (!legal.has(d)) {
      // Blocked that way (a rock or the rim right beside it): say so, with a sound and a shake of the head.
      sfx.denied();
      setNope((n) => n + 1);
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

  // Arrow presses count when the finger lifts, not on the browser's click. iOS sends no click for a press
  // held a little long (or one that a busy device stretches out), and a click also needs the very object
  // that was pressed to be under the finger still. The press is kept here by direction, so an arrow that is
  // drawn again between press and lift still takes it.
  const press = useRef<{ dir: Dir; id: number; x: number; y: number } | null>(null);
  const pressedAt = useRef(-Infinity);
  const arrowDown = (d: Dir, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    press.current = { dir: d, id: e.pointerId, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };
  const arrowUp = (d: Dir, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const p = press.current;
    press.current = null;
    if (!p || p.dir !== d || p.id !== e.pointerId) return;
    if (Math.hypot(e.nativeEvent.clientX - p.x, e.nativeEvent.clientY - p.y) > PRESS_SLOP) return;
    pressedAt.current = performance.now();
    go(d);
  };

  // Tap anywhere on the ice in line with the otter to slide that way.
  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (performance.now() - pressedAt.current < PRESS_ECHO_MS) return;
    if (!canPlay || e.delta > 8) return;
    const c = posCell(e.point.x, e.point.z);
    if (c.x === state.x && c.y === state.y) return;
    if (c.x === state.x) go(c.y < state.y ? 'up' : 'down');
    else if (c.y === state.y) go(c.x < state.x ? 'left' : 'right');
    else {
      // Not in line with the otter, so no way to slide there: the otter's head shake is for a blocked way, so say this one.
      sfx.denied();
      refusal.refuse([e.point.x, e.point.y + 0.7, e.point.z], 'Tap in line with the otter');
    }
  };

  const here = cellPos(state.x, state.y);
  const basket = cellPos(BASKET.x, BASKET.y);

  return (
    <Shake trigger={shake} intensity={0.1}>
      <Pond onPick={onPick} water={water} drifts={drifts} eaten={ate} />
      <Particles ref={particles} />
      <RefusalMark refusal={refusal.refusal} />

      <OtterActor
        state={state}
        previous={previous}
        lastMove={lastMove}
        forward={forward}
        animKey={`${moveCount}|${resetCount}`}
        won={won}
        dizzy={dizzy > 0}
        nope={nope}
        events={events}
      />

      {canPlay &&
        DIRS.filter((d) => legal.has(d)).map((d) => (
          <ArrowPad
            key={`${d}|${moveCount}|${resetCount}`}
            dir={d}
            at={here}
            hinted={hint?.dir === d}
            onDown={(e) => arrowDown(d, e)}
            onUp={(e) => arrowUp(d, e)}
          />
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

const NOPE_MS = 450;

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
  nope,
  events,
}: {
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  animKey: string;
  won: boolean;
  dizzy: boolean;
  /** Counts up each time a press asks for a slide the otter can't make. */
  nope: number;
  events: Events;
}) {
  const { slide } = usePond();
  const mover = useRef<THREE.Group>(null);
  const yawG = useRef<THREE.Group>(null);
  const rig = useRef<OtterRig>(newRig());
  const run = useRef<Run | null>(null);
  const first = useRef(true);
  const lastSpray = useRef(0);
  const shakeG = useRef<THREE.Group>(null);
  const nopeAt = useRef({ n: nope, t: -Infinity });
  if (nopeAt.current.n !== nope) nopeAt.current = { n: nope, t: performance.now() };

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

  // A quick shake of the head when a slide is asked for that can't be made.
  useFrame(() => {
    const sg = shakeG.current;
    if (!sg) return;
    const k = (performance.now() - nopeAt.current.t) / NOPE_MS;
    sg.rotation.y = k >= 0 && k < 1 ? Math.sin(k * Math.PI * 4) * 0.35 * (1 - k) : 0;
  });

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
      // With Reduce Motion on, the otter keeps still in the water instead of bobbing.
      const bob = reducedMotion() ? 0 : Math.sin(now / 320) * 0.03;
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
        <group ref={shakeG}>
          <group scale={1.3}>
            <Otter rig={rig} />
          </group>
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

/**
 * A glowing arrow on the ice next to the otter. Press it to slide that way.
 *
 * What takes the touch is a still, full-size pad over the arrow's side of the otter. Only the arrow drawn
 * on it pops in and bobs, so a press lands the same from the first frame the arrow shows, however slowly
 * the device draws. The pad passes press and lift to the scene, which counts the press on the lift.
 */
function ArrowPad({
  dir,
  at,
  hinted,
  onDown,
  onUp,
}: {
  dir: Dir;
  at: Vec3;
  hinted: boolean;
  onDown(e: ThreeEvent<PointerEvent>): void;
  onUp(e: ThreeEvent<PointerEvent>): void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const [dx, dy] = STEP[dir];
  const color = hinted ? '#ffd166' : '#bef264';
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 }), [color]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 4;
    // Bob along the slide direction, 0.72 to 0.80 from the otter, around the pad's middle.
    const push = (Math.sin(t) * 0.5 + 0.5) * 0.08 - 0.04;
    g.position.set(dx * push, 0, dy * push);
    // Pop in.
    g.scale.setScalar(Math.min(1, g.scale.x + 0.08));
  });
  return (
    <group
      position={[at[0] + dx * PAD_AT, 0.06, at[2] + dy * PAD_AT]}
      onPointerDown={onDown}
      onPointerUp={onUp}
      // The click that follows a press is the pad's own: it must not reach the ice under it.
      onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <group ref={ref} scale={0.01}>
        {/* Shape points along +y; lay it flat and turn it to face the slide direction. */}
        <group rotation={[0, dirYaw(dir), 0]}>
          <mesh geometry={arrowGeo} material={mat} rotation-x={Math.PI / 2} scale={(hinted ? 1.25 : 1) * (hover ? 1.06 : 1)} castShadow />
        </group>
      </group>
      <mesh visible={false} rotation={[0, dirYaw(dir), 0]}>
        <boxGeometry args={[PAD_WIDE, 0.4, PAD_LONG]} />
      </mesh>
    </group>
  );
}

/** Where the arrow's pad sits, out from the otter's middle, and its size: it covers the arrow as it bobs, with room to spare. */
const PAD_AT = 0.76;
const PAD_WIDE = 0.7;
const PAD_LONG = 0.72;
