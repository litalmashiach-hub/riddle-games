import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, easeInOut, sfx, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { FOLK_HEIGHT, Folk, type FolkMood, type MotionInfo } from './Folk';
import { GAP_HALF, ISLAND_X, LANES, LANTERN_HOOK_Y, deckY, entry, lanternPost, sign, slot, waitSpot } from './layout';
import { Lantern, LanternPost } from './Lantern';
import { LANTERN_MINUTES, MINUTES, NAMES, TRAVELLERS, crossingMinutes, type Move, type Side, type State, type Traveller } from './rules';
import { SkyIslands } from './SkyIslands';

const WALK_ON_MS = 420;
const WALK_OFF_MS = 480;
/** Slow walkers take longer on screen too, so the speeds are easy to feel. */
const crossMs = (minutes: number) => 1100 + minutes * 130;
export const MOVE_MS = WALK_ON_MS + crossMs(12) + WALK_OFF_MS;

/** Lantern position relative to the walker carrying it. */
const CARRY: Vec3 = [0, 0.98, 0.24];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const hook = (side: Side): Vec3 => add(lanternPost(side), [0, LANTERN_HOOK_Y, 0]);

/** A point on the bridge, `u` from 0 (start side) to 1 (far side). */
function onBridge(from: Side, u: number, lane: number): Vec3 {
  const x0 = sign(from) * (GAP_HALF + 0.2);
  const x = x0 * (1 - 2 * u);
  return [x, deckY(x), LANES[lane]];
}

const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);

// ---------------------------------------------------------------------------------------------
// A tiny motion helper: like usePath from @riddle/fx, but a leg can also follow a curve (`at`),
// which the sagging bridge needs, and it reports speed so characters can waddle.

interface Leg {
  durationMs: number;
  delayMs?: number;
  /** Straight hop/glide to here. */
  to?: Vec3;
  height?: number;
  /** Or follow this curve, u from 0 to 1. */
  at?: (u: number) => Vec3;
  ease?: (t: number) => number;
  onStart?: () => void;
}

const legEnd = (l: Leg): Vec3 => (l.at ? l.at(1) : l.to!);

function useLegs(ref: RefObject<THREE.Object3D | null>, legs: Leg[], key: string, motion?: RefObject<MotionInfo & { vx: number; vz: number }>) {
  const legsRef = useRef(legs);
  legsRef.current = legs;
  const run = useRef<{ legs: Leg[]; start: number; from: THREE.Vector3; i: number; started: boolean } | null>(null);
  const first = useRef(true);
  const last = useRef(new THREE.Vector3());
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const o = ref.current;
    const ls = legsRef.current;
    if (!o || ls.length === 0) return;
    if (first.current) {
      first.current = false;
      o.position.set(...legEnd(ls[ls.length - 1]));
      last.current.copy(o.position);
      return;
    }
    run.current = { legs: ls, start: performance.now(), from: o.position.clone(), i: 0, started: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    const r = run.current;
    if (r && r.i < r.legs.length) {
      const leg = r.legs[r.i];
      const elapsed = performance.now() - r.start - (leg.delayMs ?? 0);
      if (elapsed >= 0) {
        if (!r.started) {
          r.started = true;
          leg.onStart?.();
        }
        const t = Math.min(elapsed / Math.max(leg.durationMs, 1), 1);
        const e = (leg.ease ?? easeInOut)(t);
        if (leg.at) o.position.set(...leg.at(e));
        else {
          tmp.set(...leg.to!);
          o.position.lerpVectors(r.from, tmp, e);
          o.position.y += Math.sin(Math.PI * t) * (leg.height ?? 0);
        }
        if (t >= 1) {
          r.from = o.position.clone();
          r.start = performance.now();
          r.i += 1;
          r.started = false;
        }
      }
    }
    if (motion?.current && dt > 0) {
      const vx = (o.position.x - last.current.x) / dt;
      const vz = (o.position.z - last.current.z) / dt;
      const sp = Math.hypot(vx, vz);
      motion.current.speed = THREE.MathUtils.lerp(motion.current.speed, sp, Math.min(1, dt * 12));
      if (sp > 0.2) {
        motion.current.vx = vx;
        motion.current.vz = vz;
      }
    }
    last.current.copy(o.position);
  });
}

// ---------------------------------------------------------------------------------------------

interface Crossing {
  from: Side;
  to: Side;
  walkers: Traveller[];
  minutes: number;
  ms: number;
  /** Fraction of the bridge walked before the lantern dies (1 = made it). */
  frac: number;
  startTime: number;
}

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const [picked, setPicked] = useState<Traveller[]>([]);
  const [burst, setBurst] = useState(0);
  const [dark, setDark] = useState(false);
  const lastCount = useRef(moveCount);
  const forward = moveCount > lastCount.current;
  const stepKey = `${moveCount}|${resetCount}`;

  // Frozen on the first render of each move, so later re-renders don't change it.
  const crossing = useMemo<Crossing | null>(() => {
    if (!forward || !lastMove || !previous) return null;
    const minutes = crossingMinutes(lastMove.walkers);
    const over = previous.time + minutes > LANTERN_MINUTES;
    return {
      from: previous.lantern,
      to: state.lantern,
      walkers: lastMove.walkers,
      minutes,
      ms: crossMs(minutes),
      frac: over ? Math.max(0.08, (LANTERN_MINUTES - previous.time) / minutes) : 1,
      startTime: previous.time,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  useEffect(() => {
    lastCount.current = moveCount;
    setPicked([]);
  }, [moveCount, resetCount]);

  const lost = status.kind === 'lost';
  const won = status.kind === 'won';
  const over = status.kind !== 'playing';

  // The lantern dies part-way across the bridge.
  useEffect(() => {
    setDark(false);
    if (!lost) return;
    const at = crossing ? WALK_ON_MS + crossing.ms * crossing.frac : 0;
    const t = setTimeout(() => {
      setDark(true);
      sfx.splash();
    }, at);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, lost]);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), crossing ? WALK_ON_MS + crossing.ms + WALK_OFF_MS : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  // ---- Minutes shown on the timer and the candle, animated during a crossing ----
  const shown = useRef(state.time);
  const timerRun = useRef<{ start: number; from: number; to: number; delay: number; dur: number } | null>(null);
  useEffect(() => {
    if (crossing) {
      const to = Math.min(LANTERN_MINUTES, state.time);
      timerRun.current = { start: performance.now(), from: crossing.startTime, to, delay: WALK_ON_MS, dur: crossing.ms * crossing.frac };
    } else {
      timerRun.current = { start: performance.now(), from: shown.current, to: state.time, delay: 0, dur: 350 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);
  useFrame(() => {
    const r = timerRun.current;
    if (!r) return;
    const t = Math.min(1, Math.max(0, (performance.now() - r.start - r.delay) / r.dur));
    shown.current = r.from + (r.to - r.from) * t;
  });

  // ---- Lantern ----
  const lanternRef = useRef<THREE.Group>(null);
  const lanternMotion = useRef({ speed: 0, vx: 0, vz: 0 });
  const lanternSpeed = useRef(0);
  useFrame(() => {
    lanternSpeed.current = lanternMotion.current.speed;
  });
  const lanternLegs = useMemo<Leg[]>(() => {
    if (!crossing) return [{ to: hook(state.lantern), durationMs: 450, height: 0.3 }];
    const legs: Leg[] = [
      { to: add(entry(crossing.from, 0), CARRY), durationMs: WALK_ON_MS, height: 0.15 },
      {
        at: (u) => add(onBridge(crossing.from, u * crossing.frac, 0), CARRY),
        durationMs: crossing.ms * crossing.frac,
        ease: crossing.frac < 1 ? sineOut : sineInOut,
      },
    ];
    if (crossing.frac >= 1) legs.push({ to: hook(crossing.to), durationMs: WALK_OFF_MS, height: 0.3 });
    return legs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);
  useLegs(lanternRef, lanternLegs, stepKey, lanternMotion);

  // ---- Input ----
  const toggle = (t: Traveller) => {
    if (busy || over) return;
    if (state.pos[t] !== state.lantern) {
      sfx.denied();
      return;
    }
    if (picked.includes(t)) {
      sfx.deselect();
      setPicked(picked.filter((p) => p !== t));
    } else {
      sfx.select();
      setPicked(picked.length >= 2 ? [picked[1], t] : [...picked, t]);
    }
  };
  const cross = () => {
    if (busy || over || picked.length === 0) {
      if (picked.length === 0) sfx.denied();
      return;
    }
    sfx.hop();
    play({ walkers: picked });
  };

  const hinted = hint?.walkers ?? [];
  const hintMatches = hint != null && hinted.length === picked.length && hinted.every((h) => picked.includes(h));
  const pickMinutes = picked.length ? crossingMinutes(picked) : 0;
  const goingRight = state.lantern === 'L';
  const buttonPos: Vec3 = [sign(state.lantern) * (GAP_HALF + 0.55), -0.15, 1.45];

  return (
    <group>
      <SkyIslands goalGlow={won && !busy ? 1 : 0} />
      <LanternPost position={lanternPost('L')} hookY={LANTERN_HOOK_Y} />
      <LanternPost position={lanternPost('R')} hookY={LANTERN_HOOK_Y} />

      <group ref={lanternRef}>
        <group scale={1.35}>
          <Lantern minutes={shown} out={dark} moving={lanternSpeed} />
        </group>
      </group>

      {TRAVELLERS.map((t, i) => (
        <Actor
          key={t}
          kind={t}
          seed={i}
          side={state.pos[t]}
          crossing={crossing}
          pickedIndex={picked.indexOf(t)}
          stepKey={stepKey}
          mood={won && !busy ? 'happy' : dark && crossing?.walkers.includes(t) ? 'scared' : 'idle'}
          bubble={dark && crossing ? (crossing.walkers[0] === t ? "Eek! It's dark!" : crossing.walkers[1] === t ? (t === 'tuk' ? '...' : 'Who blew it out?!') : null) : null}
          canPick={!busy && !over && state.pos[t] === state.lantern}
          hideBadge={won && !busy}
          disabled={busy || over}
          onClick={() => toggle(t)}
        />
      ))}

      <TimerBadge minutes={shown} />

      {!busy && !over && (
        <Html position={buttonPos} center zIndexRange={[5, 0]}>
          <button
            onClick={cross}
            style={{
              fontFamily: 'Fredoka, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 17,
              padding: '8px 16px',
              borderRadius: 999,
              border: '2px solid rgba(255,255,255,.85)',
              background: picked.length ? 'linear-gradient(#ffe08a,#f4b03e)' : 'linear-gradient(#ffffff,#e0e7ff)',
              color: '#1f2937',
              boxShadow: '0 4px 0 rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.25)',
              whiteSpace: 'nowrap',
              cursor: picked.length ? 'pointer' : 'default',
              opacity: picked.length ? 1 : 0.92,
            }}
          >
            {picked.length === 0 ? (
              <span style={{ fontSize: 14 }}>Tap 1 or 2 travellers</span>
            ) : (
              <>
                {goingRight ? 'Cross ➜' : '⬅ Cross back'}
                <span style={{ opacity: 0.75, fontSize: 13, marginLeft: 6 }}>
                  {pickMinutes} min{state.time + pickMinutes > LANTERN_MINUTES ? ' ⚠' : ''}
                </span>
              </>
            )}
          </button>
        </Html>
      )}

      {hint && !busy && !over && (
        <>
          {hinted
            .filter((h) => !picked.includes(h))
            .map((h) => {
              const p = slot(h, state.pos[h]);
              return <HintRing key={h} position={[p[0], 0.04, p[2]]} radius={0.55} />;
            })}
          {hintMatches && <HintRing position={[sign(state.lantern) * (GAP_HALF + 0.3), 0.08, 0]} radius={0.9} />}
        </>
      )}

      <Burst trigger={burst} position={[ISLAND_X, 1.4, 0.4]} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------

interface ActorProps {
  kind: Traveller;
  seed: number;
  side: Side;
  crossing: Crossing | null;
  pickedIndex: number;
  stepKey: string;
  mood: FolkMood;
  bubble: string | null;
  canPick: boolean;
  hideBadge: boolean;
  disabled: boolean;
  onClick(): void;
}

function Actor({ kind, seed, side, crossing, pickedIndex, stepKey, mood, bubble, canPick, hideBadge, disabled, onClick }: ActorProps) {
  const ref = useRef<THREE.Group>(null);
  const facing = useRef<THREE.Group>(null);
  const motion = useRef({ speed: 0, vx: 0, vz: 0 });
  const lane = crossing ? crossing.walkers.indexOf(kind) : -1;
  const animKey = `${stepKey}|${pickedIndex}`;

  const legs = useMemo<Leg[]>(() => {
    if (crossing && lane >= 0) {
      const ls: Leg[] = [
        { to: entry(crossing.from, lane), durationMs: WALK_ON_MS, height: 0.15 },
        {
          // The second walker trails a little behind, so the two don't hide each other.
          at: (u) => onBridge(crossing.from, (lane === 0 ? u : Math.max(0, u * 1.14 - 0.14)) * crossing.frac, lane),
          durationMs: crossing.ms * crossing.frac,
          ease: crossing.frac < 1 ? sineOut : sineInOut,
        },
      ];
      if (crossing.frac >= 1) ls.push({ to: slot(kind, crossing.to), durationMs: WALK_OFF_MS, height: 0.4 });
      return ls;
    }
    if (pickedIndex >= 0) return [{ to: waitSpot(side, pickedIndex), durationMs: 420, height: 0.5 }];
    return [{ to: slot(kind, side), durationMs: 420, height: 0.5 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);
  useLegs(ref, legs, animKey, motion);

  // Face the way we walk; at rest, look towards the bridge and a little towards the camera.
  useFrame((_, dt) => {
    const f = facing.current;
    if (!f) return;
    const m = motion.current;
    const atRest = side === 'L' ? 0.95 : -0.95;
    const yaw = mood === 'happy' ? 0 : m.speed > 0.35 ? Math.atan2(m.vx, m.vz) : atRest;
    let d = yaw - f.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    f.rotation.y += d * Math.min(1, dt * 6);
  });

  const picked = pickedIndex >= 0;
  const h = FOLK_HEIGHT[kind];

  return (
    <group ref={ref}>
      <group ref={facing}>
        <Clickable onClick={onClick} disabled={disabled}>
          <Folk kind={kind} mood={mood} motion={motion} seed={seed} />
          {/* bigger invisible hit area, easier to tap on phones */}
          <mesh position-y={0.45} visible={false}>
            <sphereGeometry args={[0.5, 8, 8]} />
          </mesh>
        </Clickable>
      </group>
      {picked && <HintRing position={[0, 0.05, 0]} radius={0.45} color="#7ee0b0" />}
      {/* Always mounted (hidden with opacity): unmounting a drei <Html> while a Bubble mounts breaks the DOM. */}
      <Html position={[0, h + 0.18, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
        <div
          title={NAMES[kind]}
          style={{
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1,
            padding: '4px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            background: picked ? '#ffd166' : canPick ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.6)',
            color: '#1f2937',
            boxShadow: '0 3px 8px rgba(0,0,0,.25)',
            transition: 'background .2s, opacity .2s',
            opacity: bubble || hideBadge ? 0 : 1,
          }}
        >
          ⏱ {MINUTES[kind]} min
        </div>
      </Html>
      {bubble && <Bubble position={[0, h + 0.4, 0]} tone={kind === 'tuk' ? 'white' : 'red'}>{bubble}</Bubble>}
    </group>
  );
}

/** "12 / 30 min" with a burning-down bar, floating above the bridge. Updated every frame from a ref. */
function TimerBadge({ minutes }: { minutes: RefObject<number> }) {
  const num = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lastShown = useRef(-1);
  useFrame(() => {
    const m = Math.min(LANTERN_MINUTES, minutes.current ?? 0);
    const whole = Math.round(m * 10) / 10;
    if (whole === lastShown.current) return;
    lastShown.current = whole;
    if (num.current) num.current.textContent = String(Math.round(m));
    if (bar.current) {
      const left = 1 - m / LANTERN_MINUTES;
      bar.current.style.width = `${left * 100}%`;
      bar.current.style.background = left < 0.15 ? 'linear-gradient(90deg,#ef476f,#ff8a5b)' : left < 0.35 ? 'linear-gradient(90deg,#f59e0b,#ffd166)' : 'linear-gradient(90deg,#ffb547,#fff1a8)';
    }
    if (box.current) box.current.style.transform = m >= LANTERN_MINUTES ? 'scale(1.08)' : 'scale(1)';
  });
  return (
    <Html position={[0, -1.25, 0.9]} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={box}
        style={{
          fontFamily: 'Fredoka, system-ui, sans-serif',
          color: '#1f2937',
          background: 'rgba(255,255,255,.88)',
          borderRadius: 18,
          padding: '6px 14px 8px',
          boxShadow: '0 6px 18px rgba(30,27,75,.3)',
          minWidth: 150,
          textAlign: 'center',
          transition: 'transform .3s',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
          🕯️ <span ref={num} style={{ fontSize: 22 }} />
          <span style={{ opacity: 0.6 }}> / {LANTERN_MINUTES} min</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'rgba(30,27,75,.15)', overflow: 'hidden', marginTop: 4 }}>
          <div ref={bar} style={{ height: '100%', width: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#ffb547,#fff1a8)' }} />
        </div>
      </div>
    </Html>
  );
}
