import type { SceneProps } from '@riddle/engine';
import { useFrame } from '@react-three/fiber';
import { Burst, Clickable, ComicWord, DizzyStars, FocusCam, Shake, sfx, usePath, usePhases, useFaceYaw, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing } from '@riddle/props';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Bonk, Splash } from './Effects';
import { Frog, type FrogMood, type FrogTeam } from './Frog';
import { Lagoon, PAD_TOP, padX } from './Lagoon';
import { noseToNose, target, type Move, type State } from './rules';
import { frogSfx } from './sounds';

const HOP_MS = 520;
const LEAP_MS = 760;
export const MOVE_MS = 820;

/** Fail-scene beats (after the move has landed). */
const BEATS: ['windup' | 'bonk' | 'tumble' | 'after', number][] = [
  ['windup', 550],
  ['bonk', 750],
  ['tumble', 900],
  ['after', 60000],
];
export const FAIL_MS = 550 + 750 + 900 + 900;

/** Frogs turn three-quarters toward the camera so their faces show. */
const YAW: Record<FrogTeam, number> = { G: Math.PI / 2 - 0.6, O: -Math.PI / 2 + 0.6 };
const DIR: Record<FrogTeam, number> = { G: 1, O: -1 };

const FROGS: { team: FrogTeam; rank: number }[] = [
  { team: 'G', rank: 0 },
  { team: 'G', rank: 1 },
  { team: 'G', rank: 2 },
  { team: 'O', rank: 0 },
  { team: 'O', rank: 1 },
  { team: 'O', rank: 2 },
];

/** Frogs never pass a frog of their own colour, so "the k-th green from the left" is always the same frog. */
function padOf(s: State, team: FrogTeam, rank: number) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === team && n++ === rank) return i;
  return -1;
}

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  // Direction of the latest change, worked out during render (see level 1).
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    dir.current = { count: moveCount, reset: resetCount, forward: resetCount === dir.current.reset && moveCount > dir.current.count };
  }
  const forward = dir.current.forward;
  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const lost = status.kind === 'lost';

  const dips = useRef<number[]>([]);
  const [nope, setNope] = useState<{ pad: number; at: number } | null>(null);
  useEffect(() => {
    if (!nope) return;
    const t = setTimeout(() => setNope(null), 1000);
    return () => clearTimeout(t);
  }, [nope]);

  // ---- Win party ----
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => {
      setBurst((b) => b + 1);
      frogSfx.ribbit(1.2);
    }, MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  // ---- Fail scene: the first nose-to-nose pair bonks heads, the green one tumbles into the water. ----
  const pairs = lost ? noseToNose(state) : [];
  const pair = pairs[0] ?? -1;
  const phase = usePhases(lost && !busy, BEATS);
  const failStart = useRef(0);
  const [shake, setShake] = useState(0);
  const [bonkAt, setBonkAt] = useState(0);
  const [splashAt, setSplashAt] = useState(0);
  useEffect(() => {
    if (phase === 'windup') {
      failStart.current = performance.now();
      sfx.squeak();
    } else if (phase === 'bonk') {
      setTimeout(() => {
        frogSfx.bonk();
        sfx.boing();
        setBonkAt(performance.now());
        setShake((s) => s + 1);
      }, 180);
    } else if (phase === 'tumble') {
      frogSfx.whistle();
      setTimeout(() => {
        sfx.splash();
        setSplashAt(performance.now());
        setShake((s) => s + 1);
      }, 720);
    } else if (phase === 'after') {
      setTimeout(() => frogSfx.glub(), 150);
    } else if (phase === null) failStart.current = 0;
  }, [phase]);

  const bonkPos: Vec3 = pair >= 0 ? [(padX(pair) + padX(pair + 1)) / 2, 0.55, 0] : [0, 0.5, 0];
  const splashPos: Vec3 = pair >= 0 ? [padX(pair) - 0.68, 0, 0.85] : [0, 0, 0];

  const tap = (pad: number) => {
    if (busy || over) return;
    if (target(state, pad) == null) {
      sfx.denied();
      setNope({ pad, at: performance.now() });
      return;
    }
    play({ from: pad });
  };

  return (
    <Shake trigger={shake} intensity={0.14}>
      <Lagoon dips={dips} />

      {FROGS.map((f, i) => (
        <FrogActor
          key={`${f.team}${f.rank}`}
          team={f.team}
          rank={f.rank}
          seed={i}
          state={state}
          previous={previous}
          lastMove={lastMove}
          forward={forward}
          animKey={`${moveCount}|${resetCount}`}
          won={won && !busy}
          role={pair < 0 || !phase ? 'none' : padOf(state, f.team, f.rank) === pair ? 'faller' : padOf(state, f.team, f.rank) === pair + 1 ? 'bonker' : 'watcher'}
          phase={phase}
          failStart={failStart}
          nopeAt={nope && padOf(state, f.team, f.rank) === nope.pad ? nope.at : 0}
          disabled={busy || over}
          dips={dips}
          onTap={tap}
        />
      ))}

      {hint && !busy && !over && <HintRing position={[padX(hint.from), PAD_TOP + 0.04, 0]} radius={0.68} />}
      {nope && <Bubble position={[padX(nope.pad), 1.25, 0]} tone="white">Can't hop!</Bubble>}

      <Bonk at={bonkAt} position={bonkPos} />
      <Splash at={splashAt} position={splashPos} big />
      {(phase === 'bonk' || phase === 'tumble') && <ComicWord position={[bonkPos[0], 1.55, 0]} text="BONK!" />}
      {phase === 'after' && <ComicWord position={[splashPos[0], 1.25, 0.3]} text="SPLOOSH!" color="#9be7ff" ink="#0e2a3b" tilt={6} />}
      <FocusCam target={[bonkPos[0] - 0.3, 0.4, 0]} active={!!phase} closer={0.62} />

      <Burst trigger={burst} position={[0, 1.2, 0]} />
    </Shake>
  );
}

interface ActorProps {
  team: FrogTeam;
  rank: number;
  seed: number;
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  animKey: string;
  won: boolean;
  role: 'none' | 'faller' | 'bonker' | 'watcher';
  phase: 'windup' | 'bonk' | 'tumble' | 'after' | null;
  failStart: MutableRefObject<number>;
  nopeAt: number;
  disabled: boolean;
  dips: MutableRefObject<number[]>;
  onTap(pad: number): void;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function FrogActor({ team, rank, seed, state, previous, lastMove, forward, animKey, won, role, phase, failStart, nopeAt, disabled, dips, onTap }: ActorProps) {
  const pad = padOf(state, team, rank);
  const prevPad = previous ? padOf(previous, team, rank) : pad;
  const moved = forward && previous != null && prevPad !== pad;
  const leap = moved && Math.abs(pad - prevPad) === 2;
  // Was this frog leapt over by the last move? Then it ducks.
  let jumpedOver = false;
  if (forward && previous && lastMove && !moved) {
    const mover = previous[lastMove.from] as FrogTeam;
    const landed = lastMove.from + 2 * DIR[mover];
    jumpedOver = state[landed] === mover && previous[landed] === '.' && pad === lastMove.from + DIR[mover];
  }

  const home: Vec3 = [padX(pad), PAD_TOP, 0];
  const segs = useMemo<PathSegment[]>(() => {
    if (moved) {
      return [
        {
          to: home,
          durationMs: leap ? LEAP_MS : HOP_MS,
          height: leap ? 1.3 : 0.55,
          onStart: leap ? frogSfx.leap : sfx.hop,
          onEnd: () => {
            frogSfx.plop();
            dips.current[pad] = performance.now();
          },
        },
      ];
    }
    return [{ to: home, durationMs: 320, height: previous && prevPad !== pad ? 0.4 : 0 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  const root = useRef<THREE.Group>(null);
  usePath(root, segs, animKey, { face: false });

  // Remember when this frog's own hop or duck started, for squash, stretch and flips.
  const hop = useRef({ start: -1, dur: 1, leap: false, duck: -1 });
  useEffect(() => {
    if (moved) hop.current = { ...hop.current, start: performance.now(), dur: leap ? LEAP_MS : HOP_MS, leap };
    if (jumpedOver) hop.current = { ...hop.current, duck: performance.now() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  const yaw = useRef<THREE.Group>(null);
  useFaceYaw(yaw, won ? 0 : YAW[team], 6);
  const act = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const squash = useRef<THREE.Group>(null);
  const roleRef = useRef(role);
  roleRef.current = role;
  const wonRef = useRef(won);
  wonRef.current = won;
  const nopeRef = useRef(nopeAt);
  nopeRef.current = nopeAt;

  useFrame(({ clock }, dt) => {
    const now = performance.now();
    const a = act.current;
    const p = pivot.current;
    const q = squash.current;
    if (!a || !p || !q) return;
    const d = DIR[team];
    const r = roleRef.current;
    const ft = failStart.current ? (now - failStart.current) / 1000 : -1;

    // ---- Squash and stretch for hops, flip for leaps, duck when leapt over ----
    let sx = 1, sy = 1, flip = 0;
    const h = hop.current;
    const k = (now - h.start) / h.dur;
    if (h.start > 0 && k >= 0 && k <= 1.25) {
      if (k < 0.12) sy = 1 - 0.3 * (k / 0.12);
      else if (k < 0.85) sy = 1.18 - 0.18 * Math.abs(k - 0.5) * 2;
      else sy = 1 - 0.28 * Math.sin(((k - 0.85) / 0.4) * Math.PI);
      if (h.leap && k > 0.12 && k < 0.9) flip = ease((k - 0.12) / 0.78) * Math.PI * 2;
    }
    const dk = (now - h.duck) / 1000;
    if (h.duck > 0 && dk >= 0 && dk < 0.9) sy = Math.min(sy, 1 - 0.45 * Math.sin((dk / 0.9) * Math.PI));
    sx = 1 / Math.sqrt(Math.max(sy, 0.4));

    // ---- Fail-scene offsets (world space) ----
    const off = new THREE.Vector3();
    let roll = 0;
    let lean = 0;
    if (ft >= 0 && r !== 'none') {
      if (r === 'faller' || r === 'bonker') {
        // windup 0..0.55: lean back. bonk 0.55..1.3: lunge and recoil.
        lean = -0.35 * ease(clamp01(ft / 0.5));
        if (ft > 0.55) {
          const b = ft - 0.55;
          const lunge = b < 0.18 ? ease(b / 0.18) * 0.32 : b < 0.6 ? 0.32 - ease((b - 0.18) / 0.42) * 0.5 : -0.18;
          off.x += d * lunge;
          lean = b < 0.18 ? 0.3 : -0.25;
        }
      }
      if (r === 'faller' && ft > 1.3) {
        // tumble 1.3..2.2: back-flip off the pad into the water, then bob with eyes above the surface.
        const tt = clamp01((ft - 1.3) / 0.75);
        off.x += -d * (0.5 * ease(tt) + 0.18 * (1 - tt));
        off.y += Math.sin(Math.PI * tt) * 0.9 - (PAD_TOP + 0.36) * ease(tt);
        off.z += 0.85 * ease(tt);
        roll = d * tt * Math.PI * 2.2;
        if (ft > 2.05) {
          off.y += Math.sin((ft - 2.05) * 3) * 0.05;
          roll = d * Math.PI * 2 + Math.sin(ft * 2.2) * 0.25;
        }
      }
      if (r === 'bonker' && ft > 1.3) lean = -0.25 + Math.sin(ft * 4) * 0.15;
      if (r === 'watcher' && ft > 0.75) {
        // Startled jump when the heads bonk, then shaking with giggles.
        const w = ft - 0.75;
        off.y += w < 0.45 ? Math.sin((w / 0.45) * Math.PI) * 0.35 : Math.abs(Math.sin(ft * 14)) * 0.02;
      }
    }
    // ---- Win: everyone bounces ----
    if (wonRef.current) {
      const t = clock.elapsedTime * 5 + seed * 0.9;
      off.y += Math.abs(Math.sin(t)) * 0.32;
      sy *= 1 + Math.cos(t) * 0.06;
    }
    a.position.lerp(off, r === 'none' && !wonRef.current ? Math.min(1, dt * 10) : 1);
    a.rotation.z = THREE.MathUtils.lerp(a.rotation.z, roll, r === 'none' ? Math.min(1, dt * 8) : 1);
    // "Can't hop!" head shake.
    const nk = (now - nopeRef.current) / 1000;
    a.rotation.y = nopeRef.current && nk < 0.5 ? Math.sin(nk * 40) * 0.25 * (1 - nk / 0.5) : 0;

    q.scale.set(sx, sy, sx);
    p.rotation.x = flip + lean;
  });

  const dizzy = (phase === 'tumble' || phase === 'after') && (role === 'faller' || role === 'bonker');

  const mood: FrogMood = won ? 'happy' : dizzy ? 'dizzy' : phase === 'after' && role === 'watcher' ? 'happy' : 'idle';

  return (
    <group ref={root}>
      <group ref={act}>
        <group ref={yaw}>
          <group ref={squash}>
            <group ref={pivot} position-y={0.38}>
              <group position-y={-0.38} scale={1.25}>
            <Clickable onClick={() => onTap(pad)} disabled={disabled}>
              <Frog team={team} mood={mood} seed={seed} />
              {/* bigger invisible tap target */}
              <mesh position-y={0.35} visible={false}>
                <sphereGeometry args={[0.62, 8, 8]} />
              </mesh>
            </Clickable>
              </group>
            </group>
          </group>
        </group>
        <DizzyStars position={[0, 0.85, 0]} radius={0.28} count={4} visible={dizzy} />
        {phase === 'windup' && role !== 'watcher' && role !== 'none' && <Bubble position={[0, 1.15, 0]} tone="red">?!</Bubble>}
        {won && seed % 2 === 0 && <Bubble position={[0, 1.2, 0]} tone="gold">Ribbit!</Bubble>}
      </group>
    </group>
  );
}
