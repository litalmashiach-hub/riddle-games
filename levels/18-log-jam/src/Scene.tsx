import type { SceneProps } from '@riddle/engine';
import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Burst, ComicWord, DizzyStars, FocusCam, Shake, sfx, usePath, usePhases, type PathSegment, type Vec3 } from '@riddle/fx';
import { HintRing, toon } from '@riddle/props';
import { useCursor } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { pond } from './audio';
import { Dottie, Duckling, type DuckMood } from './Duck';
import { EXIT_Z, FLOAT_Y, HALF, LAGOON, LOG_R, MOVE_MS, RAFT_HOME, SAIL_MS, SLIDE_MS, cellX, cellZ, pieceCenter } from './layout';
import { Frog, LogFlowers, LogModel, LogMushrooms, RaftModel, Snail } from './Logs';
import { Pond } from './Pond';
import { EXIT_ROW, PATIENCE, PIECES, SIZE, grid, reach, type Move, type State } from './rules';

export { MOVE_MS };

type Phase = 'huff' | 'hop' | 'slip' | 'splash' | 'after';
const PHASES: [Phase, number][] = [
  ['huff', 900],
  ['hop', 1500],
  ['slip', 650],
  ['splash', 1300],
  ['after', 60000],
];

/** The grid cell a piece's leading end moves into when it slides to `to`. */
function leadCell(i: number, from: number, to: number): [number, number] {
  const pc = PIECES[i];
  const k = to > from ? to + pc.len - 1 : to;
  return pc.axis === 'h' ? [pc.line, k] : [k, pc.line];
}

const DUCKLING_HOME: Vec3[] = [
  [LAGOON.x + 0.9, 0.02, LAGOON.z - 0.9],
  [LAGOON.x + 1.25, 0.02, LAGOON.z - 0.4],
  [LAGOON.x + 0.95, 0.02, LAGOON.z + 0.15],
];
const DUCKLING_PARTY: Vec3[] = [
  [RAFT_HOME[0] + 1.05, 0.02, RAFT_HOME[2] - 0.45],
  [RAFT_HOME[0] + 1.15, 0.02, RAFT_HOME[2] + 0.15],
  [RAFT_HOME[0] + 0.6, 0.02, RAFT_HOME[2] + 0.62],
];

export function Scene({ state, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [snap, setSnap] = useState(0);
  const [burst, setBurst] = useState(0);
  const [splashBurst, setSplashBurst] = useState(0);
  const [shake, setShake] = useState(0);

  // Is the latest change a new move (animate it) or an undo / restart (glide back fast)?
  // Worked out during render so the first frame of the move already knows.
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    dir.current = { count: moveCount, reset: resetCount, forward: resetCount === dir.current.reset && moveCount > dir.current.count };
    if (selected !== null) setSelected(null);
  }
  const forward = dir.current.forward;

  const won = status.kind === 'won';
  const lost = status.kind === 'lost';
  const over = won || lost;
  const locked = busy || over;
  const phase = usePhases(lost && !busy, PHASES);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => {
      setBurst((b) => b + 1);
      pond.sparkle();
      pond.quack(0, 1);
      pond.peep(0.15);
      pond.peep(0.3);
      pond.peep(0.42);
    }, forward ? SLIDE_MS + SAIL_MS - 200 : 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  // The fail beats: sounds and the screen shake.
  useEffect(() => {
    if (phase === 'huff') {
      pond.quack(0, 0.8);
      pond.quack(0.18, 0.75);
      pond.quack(0.36, 0.7);
    } else if (phase === 'slip') sfx.squeak();
    else if (phase === 'splash') {
      const t = setTimeout(() => {
        pond.bigSplash();
        setSplashBurst((b) => b + 1);
        setShake((s) => s + 1);
      }, 380);
      return () => clearTimeout(t);
    } else if (phase === 'after') {
      sfx.sadTrombone();
      pond.peep(0.6);
      pond.peep(0.75);
      pond.croak(1.0);
    }
  }, [phase]);

  // ---- Dragging ----
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const pieceRefs = useMemo(() => PIECES.map(() => ({ current: null as THREE.Group | null })), []);
  const drag = useRef<{ i: number; start: THREE.Vector3; base: number; min: number; max: number; off: number; moved: boolean } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const groundHit = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOAT_Y), hit) ? hit : null;
  };

  const onPieceDown = (i: number, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (locked) {
      if (!over) sfx.denied();
      return;
    }
    const start = groundHit(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (!start) return;
    const s = stateRef.current;
    const r = reach(s.pos, i);
    const base = s.pos[i];
    drag.current = { i, start, base, min: Math.min(base, ...r), max: Math.max(base, ...r), off: 0, moved: false };
    if (controls) controls.enabled = false;

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = groundHit(ev.clientX, ev.clientY);
      if (!p) return;
      const delta = PIECES[d.i].axis === 'h' ? p.x - d.start.x : p.z - d.start.z;
      if (Math.abs(delta) > 0.18) d.moved = true;
      if (!d.moved) return;
      // A little rubber band past the ends, so a blocked log still feels alive.
      let at = d.base + delta;
      if (at < d.min) at = d.min - Math.min(0.12, (d.min - at) * 0.25);
      if (at > d.max) at = d.max + Math.min(0.12, (at - d.max) * 0.25);
      d.off = at - d.base;
      const g = pieceRefs[d.i].current;
      if (g) g.position.set(...pieceCenter(d.i, at));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (controls) controls.enabled = true;
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (!d.moved) {
        // A tap: pick this log (or drop it).
        if (selected === d.i) {
          sfx.deselect();
          setSelected(null);
        } else {
          if (d.min === d.max) sfx.denied();
          else pond.select();
          setSelected(d.i);
        }
        return;
      }
      const to = Math.max(d.min, Math.min(d.max, Math.round(d.base + d.off)));
      setSelected(null);
      if (to !== d.base) play({ piece: d.i, to });
      else {
        if (d.min === d.max) sfx.denied();
        setSnap((n) => n + 1);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // Never leave the orbit camera switched off.
  useEffect(
    () => () => {
      if (controls) controls.enabled = true;
    },
    [controls],
  );

  const targets = useMemo(() => {
    if (selected === null || locked) return [];
    const from = state.pos[selected];
    return reach(state.pos, selected).map((to) => ({ to, cell: leadCell(selected, from, to) }));
  }, [selected, locked, state.pos]);

  const left = PATIENCE - state.moves;
  const grump = Math.max(0, Math.min(1, 1 - left / 20));

  // ---- The fail: Dottie hops along her row towards the gap, slips, and splashes. ----
  const failPlan = useMemo(() => {
    const g = grid(state.pos);
    const raft = pieceCenter(0, state.pos[0]);
    const start: Vec3 = [raft[0] + 0.15, FLOAT_Y + 0.12, raft[2]];
    const hops: Vec3[] = [];
    let splash: Vec3 | null = null;
    for (let c = state.pos[0] + 2; c < SIZE; c++) {
      if (g[EXIT_ROW * SIZE + c] === -1) {
        splash = [cellX(c), -0.1, EXIT_Z];
        break;
      }
      hops.push([cellX(c), FLOAT_Y + LOG_R + 0.02, EXIT_Z]);
      if (hops.length >= 3) break;
    }
    if (!splash) {
      const last = hops[hops.length - 1] ?? start;
      splash = [last[0] + 0.15, -0.1, last[2] + 0.75];
    }
    const perch = hops[hops.length - 1] ?? start;
    return { start, hops, perch, splash };
  }, [state.pos]);

  const raftHidden = phase !== null && phase !== 'huff';
  const hintTarget = hint && !busy ? leadCell(hint.piece, state.pos[hint.piece], hint.to) : null;

  return (
    <Shake trigger={shake} intensity={0.18}>
      <Pond />

      {PIECES.map((pc, i) => (
        <PieceActor
          key={i}
          index={i}
          groupRef={pieceRefs[i]}
          to={state.pos[i]}
          moved={forward && lastMove?.piece === i}
          forward={forward}
          animKey={`${moveCount}|${resetCount}|${snap}`}
          won={won && i === 0}
          selected={selected === i}
          hinted={hint?.piece === i && !busy}
          disabled={locked}
          onDown={(e) => onPieceDown(i, e)}
        >
          {i === 0 && (
            <group position={[0.15, 0.23, 0]} rotation-y={Math.PI / 2} visible={!raftHidden}>
              <Dottie mood={won && !busy ? 'happy' : phase === 'huff' ? 'huff' : 'idle'} grump={over ? 0 : grump} scale={1.35} />
              {!over && left <= 12 && left > 0 && (
                <Html position={[0, 1.45, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                  <div style={pill(left <= 5)}>{left <= 5 ? `😤 ${left} slide${left > 1 ? 's' : ''} left!` : `Dottie is getting grumpy… ${left} left`}</div>
                  <style>{`@keyframes lj-throb{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
                </Html>
              )}
            </group>
          )}
          {pc.rider === 'frog' && <FrogRider index={i} moveCount={moveCount} lastMove={lastMove} forward={forward} />}
          {pc.rider === 'snail' && <Snail />}
          {pc.rider === 'mushrooms' && <LogMushrooms seed={i} />}
          {pc.rider === 'flowers' && <LogFlowers />}
        </PieceActor>
      ))}

      {targets.map(({ to, cell: [r, c] }) => (
        <TargetMarker key={`${to}`} position={[cellX(c), 0.03, cellZ(r)]} onClick={() => play({ piece: selected!, to })} />
      ))}
      {hintTarget && <HintRing position={[cellX(hintTarget[1]), 0.04, cellZ(hintTarget[0])]} radius={0.45} />}

      <Ducklings won={won && !busy} giggle={phase === 'after'} />

      {phase && <FailDuck phase={phase} plan={failPlan} />}
      {phase === 'huff' && <ComicWord position={[failPlan.start[0], 1.5, failPlan.start[2]]} text="QUACK!!" color="#fff36b" />}
      {phase === 'slip' && <ComicWord position={[failPlan.perch[0], 1.4, failPlan.perch[2]]} text="WHOOPS!" color="#7ef0ff" tilt={8} />}
      {(phase === 'splash' || phase === 'after') && <ComicWord position={[failPlan.splash[0], 1.5, failPlan.splash[2]]} text="SPLOOSH!" color="#9be7ff" />}
      {phase === 'after' && <ComicWord position={[DUCKLING_HOME[1][0], 0.9, DUCKLING_HOME[1][2]]} text="hee hee!" color="#ffe14d" size={28} tilt={-4} />}
      <FocusCam target={[failPlan.splash[0] * 0.6, 0.2, EXIT_Z + 0.4]} active={phase !== null} closer={0.72} />

      <Burst trigger={splashBurst} position={[failPlan.splash[0], 0.1, failPlan.splash[2]]} colors={['#bfefff', '#7fd8ff', '#ffffff', '#5fb24f']} power={0.55} size={0.8} count={120} />
      <Burst trigger={burst} position={[RAFT_HOME[0], 0.8, RAFT_HOME[2]]} colors={['#e4ff8a', '#ffd36b', '#ff8fd8', '#7ef0ff', '#ffffff']} />
    </Shake>
  );
}

const pill = (hot: boolean): React.CSSProperties => ({
  fontFamily: 'Fredoka, system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 14,
  padding: '4px 12px',
  borderRadius: 999,
  background: hot ? '#ff5d73' : 'rgba(255,255,255,.92)',
  color: hot ? '#fff' : '#3b2a55',
  boxShadow: '0 4px 12px rgba(0,0,0,.35)',
  whiteSpace: 'nowrap',
  animation: hot ? 'lj-throb .6s ease-in-out infinite' : undefined,
});

// ---------------------------------------------------------------------------

interface ActorProps {
  index: number;
  groupRef: RefObject<THREE.Group | null>;
  to: number;
  moved: boolean;
  forward: boolean;
  animKey: string;
  won: boolean;
  selected: boolean;
  hinted: boolean;
  disabled: boolean;
  onDown(e: ThreeEvent<PointerEvent>): void;
  children?: React.ReactNode;
}

function PieceActor({ index, groupRef, to, moved, forward, animKey, won, selected, hinted, disabled, onDown, children }: ActorProps) {
  const pc = PIECES[index];
  const inner = useRef<THREE.Group>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const bumpAt = useRef(-1e9);
  const [hover, setHover] = useState(false);
  useCursor(hover && !disabled);

  const target = pieceCenter(index, to);
  const segs: PathSegment[] = useMemo(() => {
    if (moved) {
      const slide: PathSegment = {
        to: target,
        durationMs: SLIDE_MS,
        onStart: pond.slide,
        onEnd: () => {
          bumpAt.current = performance.now();
          if (!won) pond.thunk();
        },
      };
      // The winning slide carries on through the gap and out into the lagoon.
      return won ? [slide, { to: [HALF + 1.4, FLOAT_Y, EXIT_Z], durationMs: SAIL_MS * 0.4 }, { to: RAFT_HOME, durationMs: SAIL_MS * 0.6 }] : [slide];
    }
    return [{ to: won ? RAFT_HOME : target, durationMs: forward ? 10 : 260 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, won]);
  usePath(groupRef, segs, `${animKey}|${won}`, { face: false });

  useFrame(({ clock }) => {
    const g = inner.current;
    if (!g) return;
    const t = clock.elapsedTime + index * 0.9;
    const since = (performance.now() - bumpAt.current) / 1000;
    // Gentle bobbing, plus a wobble when the log bumps to a stop.
    const wob = since < 1.2 ? Math.sin(since * 16) * Math.exp(-since * 4) : 0;
    g.position.y = Math.sin(t * 1.4) * 0.018 + (selected ? 0.07 : 0) - Math.abs(wob) * 0.04;
    const roll = Math.sin(t * 0.9) * 0.025 + wob * 0.08;
    if (pc.axis === 'h') g.rotation.set(roll, 0, 0);
    else g.rotation.set(0, Math.PI / 2, roll);
    const rp = ripple.current;
    if (rp) {
      const k = Math.min(since / 1.1, 1);
      rp.visible = k < 1;
      rp.scale.set(pc.len * 0.6 + k * 0.9, 0.65 + k * 0.9, 1);
      (rp.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
    }
  });

  const glow = selected ? '#fff59a' : hinted ? '#ffd166' : null;
  return (
    <group ref={groupRef}>
      <group
        ref={inner}
        onPointerDown={onDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        scale={hover && !disabled ? 1.03 : 1}
      >
        {index === 0 ? <RaftModel glow={glow} /> : <LogModel piece={pc} seed={index} glow={glow} />}
        {/* A generous invisible hit box, so logs are easy to grab on phones. */}
        <mesh visible={false}>
          <boxGeometry args={[pc.len - 0.05, 0.9, 0.95]} />
        </mesh>
        {children}
      </group>
      <mesh ref={ripple} position-y={-FLOAT_Y + 0.025} rotation={[-Math.PI / 2, 0, pc.axis === 'h' ? 0 : Math.PI / 2]} visible={false}>
        <ringGeometry args={[0.5, 0.56, 32]} />
        <meshBasicMaterial color="#d8fbff" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FrogRider({ index, moveCount, lastMove, forward }: { index: number; moveCount: number; lastMove: Move | null; forward: boolean }) {
  const [at, setAt] = useState(-1e9);
  useEffect(() => {
    if (!forward || lastMove?.piece !== index) return;
    const t = setTimeout(() => {
      setAt(performance.now());
      pond.croak();
      pond.croak(0.25);
    }, SLIDE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount]);
  return <Frog excited={at} />;
}

/** A glowing lily ring on a cell the picked log can slide to. Tap it to slide there. */
function TargetMarker({ position, onClick }: { position: Vec3; onClick(): void }) {
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 5 + position[0] + position[2]) * 0.07 + (hover ? 0.12 : 0);
    ring.current.scale.set(s, s, s);
  });
  return (
    <group position={position}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.24, 0.34, 28]} />
        <meshBasicMaterial color={hover ? '#ffffff' : '#c8ff7a'} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
        <circleGeometry args={[0.14, 16]} />
        <meshBasicMaterial color="#e4ff8a" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh
        position-y={0.2}
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <boxGeometry args={[0.96, 0.4, 0.96]} />
      </mesh>
    </group>
  );
}

function Ducklings({ won, giggle }: { won: boolean; giggle: boolean }) {
  return (
    <>
      {DUCKLING_HOME.map((home, i) => (
        <DucklingActor key={i} seed={i} home={home} party={DUCKLING_PARTY[i]} won={won} giggle={giggle} />
      ))}
    </>
  );
}

function DucklingActor({ seed, home, party, won, giggle }: { seed: number; home: Vec3; party: Vec3; won: boolean; giggle: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const face = useRef<THREE.Group>(null);
  usePath(ref, [{ to: won ? party : home, durationMs: 900 + seed * 150, height: 0 }], `${won}`, { face: false });
  useFrame(({ clock }) => {
    // Paddle in little circles, and look at the pond.
    if (!face.current || !ref.current) return;
    const t = clock.elapsedTime + seed * 2;
    face.current.position.set(Math.cos(t * 0.6) * 0.06, 0, Math.sin(t * 0.6) * 0.06);
    const look = won ? Math.atan2(RAFT_HOME[0] - ref.current.position.x, RAFT_HOME[2] - ref.current.position.z) : -Math.PI / 2 + Math.sin(t * 0.5) * 0.4;
    face.current.rotation.y = look;
  });
  return (
    <group ref={ref}>
      <group ref={face}>
        <group scale={1.5}>
          <Duckling mood={won ? 'happy' : giggle ? 'giggle' : 'idle'} seed={seed} />
        </group>
      </group>
    </group>
  );
}

/** Dottie on foot (well, webbed foot) during the fail scene. */
function FailDuck({ phase, plan }: { phase: Phase; plan: { start: Vec3; hops: Vec3[]; perch: Vec3; splash: Vec3 } }) {
  const ref = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const segs = useMemo<PathSegment[]>(() => {
    if (phase === 'huff') return [{ to: plan.start, durationMs: 10 }];
    if (phase === 'hop') {
      const d = 1400 / Math.max(1, plan.hops.length);
      return plan.hops.length
        ? plan.hops.map((h) => ({ to: h, durationMs: d * 0.85, delayMs: d * 0.15, height: 0.55, onStart: sfx.boing }))
        : [{ to: plan.start, durationMs: 10 }];
    }
    if (phase === 'slip') return [{ to: [plan.perch[0] + 0.12, plan.perch[1] + 0.1, plan.perch[2]], durationMs: 600, height: 0.15 }];
    if (phase === 'splash') return [{ to: plan.splash, durationMs: 420, height: 0.7 }];
    return [{ to: [plan.splash[0], -0.13, plan.splash[2]], durationMs: 300 }];
  }, [phase, plan]);
  usePath(ref, segs, phase, { face: false });

  useFrame(({ clock }) => {
    const s = spin.current;
    if (!s) return;
    const t = clock.elapsedTime;
    if (phase === 'slip') {
      // Feet windmill on the rolling log.
      s.rotation.set(Math.sin(t * 22) * 0.5, Math.PI / 2, Math.sin(t * 11) * 0.3);
    } else if (phase === 'splash') {
      s.rotation.set(s.rotation.x + 0.25, Math.PI / 2, s.rotation.z + 0.12);
    } else if (phase === 'after') {
      s.rotation.set(0, Math.PI / 2 + Math.sin(t * 0.8) * 0.5, Math.sin(t * 1.6) * 0.12);
    } else s.rotation.set(0, Math.PI / 2, 0);
  });

  const mood: DuckMood = phase === 'huff' ? 'huff' : phase === 'hop' ? 'huff' : phase === 'after' ? 'soggy' : 'flail';
  return (
    <group ref={ref}>
      <group ref={spin}>
        <Dottie mood={mood} scale={1.35} />
        {phase === 'after' && (
          <>
            {/* A lily pad hat. */}
            <mesh position={[0, 0.95, 0.24]} rotation={[0.25, 0, 0.15]} material={toon('#4fae5c', { rough: 0.6 })}>
              <cylinderGeometry args={[0.24, 0.24, 0.025, 16, 1, false, 0.3, Math.PI * 2 - 0.6]} />
            </mesh>
            <mesh position={[0.05, 1.0, 0.28]} material={toon('#ffc4ee', { emissive: '#ff6fcf', emissiveIntensity: 1.4 })}>
              <sphereGeometry args={[0.05, 6, 4]} />
            </mesh>
          </>
        )}
      </group>
      {phase === 'after' && <DizzyStars position={[0, 1.25, 0]} />}
      {phase === 'after' && <SoggyRipples />}
    </group>
  );
}

function SoggyRipples() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    [a.current, b.current].forEach((m, i) => {
      if (!m) return;
      const k = (clock.elapsedTime * 0.6 + i * 0.5) % 1;
      m.scale.setScalar(0.4 + k * 1.2);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
    });
  });
  return (
    <>
      {[a, b].map((r, i) => (
        <mesh key={i} ref={r} position-y={0.14} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.4, 0.46, 32]} />
          <meshBasicMaterial color="#d8fbff" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
