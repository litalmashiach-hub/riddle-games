import type { SceneProps } from '@riddle/engine';
import { Html, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Burst, Shake, sfx, usePath, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, toon } from '@riddle/props';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Citadel } from './Citadel';
import { cogGeometry } from './cog';
import { COGS, GOAL, canMove, levelOf, topCog, type Move, type State } from './rules';
import { BonkFx } from './BonkFx';
import { bonk as bonkSound, clank, uhOh } from './sounds';
import { Tock, type TockMood } from './Tock';

const LIFT_MS = 260;
const GLIDE_MS = 400;
const DROP_MS = 300;
export const MOVE_MS = LIFT_MS + GLIDE_MS + DROP_MS + 40;

/** Pillar x positions, left to right. */
const PX = [-3.75, -1.25, 1.25, 3.75];
/** Bottom of the lowest cog. */
const BASE = 0.46;
/** Height of one cog. */
const T = 0.24;
/** Where a lifted cog hovers (its bottom). */
const LIFT = BASE + COGS * T + 0.62;
const ROD_TOP = BASE + COGS * T + 0.34;

const radius = (c: number) => 0.45 + c * 0.13;
/** Smallest to biggest: a rainbow, so sizes are easy to tell apart. */
const COLORS = ['#ff4d6d', '#ff8c2b', '#ffd23f', '#3ddc84', '#3fb8f5', '#9b6dff'];
const slot = (s: State, c: number): Vec3 => [PX[s.peg[c]], BASE + levelOf(s, c) * T, 0];
const slotTop = (s: State, c: number): Vec3 => [PX[s.peg[c]], BASE + (levelOf(s, c) + 1) * T, 0];
const above = (p: number): Vec3 => [PX[p], LIFT, 0];

/** The "too big" gag: the held cog tries to land on a smaller one, squashes it and boings back. */
const BONK_GLIDE = 300;
const BONK_DROP = 170;
/** When the big cog hits the small one, after the tap. */
const BONK_IMPACT = BONK_GLIDE + BONK_DROP;
const BONK_BOUNCE = 420;
const BONK_BACK = 340;
const BONK_MS = BONK_IMPACT + BONK_BOUNCE + BONK_BACK;
interface Bonk {
  /** The held cog that tried to land. */
  cog: number;
  from: number;
  target: number;
  /** The smaller cog it landed on. */
  under: number;
  at: number;
}
const TOO_BIG = ['Too big!', 'Ouch, squish!', 'Big on small? Nope!', 'Boing! Try again!'];
/** Squash-and-stretch wobble: 1 at rest, `amount` lower at t = 0, springing back. */
const wobble = (t: number, amount: number) => (t < 0 || t > 1.2 ? 1 : 1 - amount * Math.exp(-5 * t) * Math.cos(17 * t));

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The pillar whose top cog the player has lifted (UI only, not a move yet). */
  const [held, setHeld] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tockMood, setTockMood] = useState<{
    mood: TockMood;
    say: string | null;
    at: number;
  }>({ mood: 'idle', say: null, at: 0 });
  const [bonk, setBonk] = useState<Bonk | null>(null);
  /** Bumped on each impact to shake the tower. */
  const [thud, setThud] = useState(0);
  /** Taps are ignored until the gag has played out. */
  const lockedUntil = useRef(0);
  const [burst, setBurst] = useState(0);
  /** The cog that was already lifted when the move was played, so it skips the lift. */
  const lifted = useRef<number | null>(null);
  const lastCount = useRef(moveCount);
  const forward = moveCount > lastCount.current;

  useEffect(() => {
    lastCount.current = moveCount;
    setHeld(null);
  }, [moveCount, resetCount]);

  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const celebrate = won && !busy;
  useCursor(hover !== null && !busy && !over);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  // Tock calms down a moment after a "no".
  useEffect(() => {
    if (tockMood.mood !== 'no') return;
    const t = setTimeout(() => setTockMood({ mood: 'idle', say: null, at: performance.now() }), 1300);
    return () => clearTimeout(t);
  }, [tockMood]);

  const heldCog = held !== null ? topCog(state, held) : -1;

  const refuse = (say: string) => {
    sfx.denied();
    setTockMood({ mood: 'no', say, at: performance.now() });
  };

  // The tried-to-land gag: sounds and Tock's reaction are timed to the impact.
  useEffect(() => {
    if (!bonk) return;
    const t = setTimeout(() => {
      bonkSound();
      setThud((n) => n + 1);
      clank(0.75);
      uhOh();
      setTockMood({
        mood: 'no',
        say: TOO_BIG[Math.floor(bonk.at / 13) % TOO_BIG.length],
        at: performance.now(),
      });
    }, BONK_IMPACT);
    const t2 = setTimeout(sfx.boing, BONK_IMPACT + 60);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [bonk]);
  useEffect(() => setBonk(null), [moveCount, resetCount]);

  const onPillar = (p: number) => {
    if (busy || over || performance.now() < lockedUntil.current) return;
    if (held === null) {
      if (topCog(state, p) < 0) return refuse('It is empty!');
      sfx.select();
      setHeld(p);
      return;
    }
    if (held === p) {
      sfx.deselect();
      setHeld(null);
      return;
    }
    if (!canMove(state, held, p)) {
      const at = performance.now();
      lockedUntil.current = at + BONK_MS + 60;
      sfx.deselect();
      setBonk({
        cog: heldCog,
        from: held,
        target: p,
        under: topCog(state, p),
        at,
      });
      return;
    }
    lifted.current = heldCog;
    play({ from: held, to: p });
  };

  // Hint: ring the pillar to lift from, or (if that cog is already lifted) the pillar to drop on.
  const hintPillar = hint && !busy ? (held === hint.from ? hint.to : hint.from) : null;

  const movedCog = forward && lastMove && previous ? topCog(previous, lastMove.from) : -1;

  return (
    <group>
      <Citadel celebrate={celebrate} />

      <Shake trigger={thud} intensity={0.08} durationMs={420}>
        {PX.map((x, p) => (
          <Pillar
            key={p}
            index={p}
            x={x}
            hovered={hover === p && !busy && !over}
            celebrate={celebrate}
            onClick={() => onPillar(p)}
            onHover={(on) => setHover((h) => (on ? p : h === p ? null : h))}
          />
        ))}

        {Array.from({ length: COGS }, (_, c) => (
          <Cog
            key={c}
            index={c}
            state={state}
            lastMove={c === movedCog ? lastMove : null}
            liftedAtPlay={c === movedCog && lifted.current === c}
            forward={forward}
            moveCount={moveCount}
            resetCount={resetCount}
            held={c === heldCog && !busy}
            celebrate={celebrate}
            bonk={bonk && bonk.cog === c ? bonk : null}
            squashAt={bonk && bonk.under === c ? bonk.at + BONK_IMPACT : 0}
            onClick={() => onPillar(state.peg[c])}
          />
        ))}
      </Shake>

      {/* Where the held cog may go. */}
      {held !== null &&
        !busy &&
        PX.map((x, p) => (p !== held && canMove(state, held, p) ? <HintRing key={p} position={[x, 0.47, 0]} radius={1.25} color="#7ee0b0" /> : null))}
      {hintPillar !== null && <HintRing position={[PX[hintPillar], 0.5, 0]} radius={1.4} />}

      <group position={[-4.7, 0.33, 2.5]} rotation-y={0.55}>
        <Tock
          scale={1.3}
          surprisedAt={bonk ? bonk.at + BONK_IMPACT : 0}
          mood={celebrate ? 'happy' : tockMood.mood}
          lookX={held !== null ? PX[held] : hover !== null ? PX[hover] : null}
        />
        {tockMood.say && !celebrate && (
          <Bubble key={tockMood.at} position={[0.9, 1.95, 0]} tone="red">
            {tockMood.say}
          </Bubble>
        )}
        {celebrate && (
          <Bubble position={[0.9, 1.95, 0]} tone="gold">
            Tick-tock, top job!
          </Bubble>
        )}
      </group>

      {/* Always mounted (hidden until a bonk) so its shaders are ready and the gag never hitches. */}
      <BonkFx
        at={bonk ? bonk.at + BONK_IMPACT : 0}
        position={bonk ? slotTop(state, bonk.under) : [0, -5, 0]}
        radius={bonk ? radius(bonk.under) : 0.5}
      />

      <Burst trigger={burst} position={[PX[GOAL], 2.6, 0]} />
    </group>
  );
}

function Pillar({
  index,
  x,
  hovered,
  celebrate,
  onClick,
  onHover,
}: {
  index: number;
  x: number;
  hovered: boolean;
  celebrate: boolean;
  onClick(): void;
  onHover(on: boolean): void;
}) {
  const goal = index === GOAL;
  // drei <Html> placed on the very first render can stay empty, so mount the label a moment later.
  const [labelReady, setLabelReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLabelReady(true), 50);
    return () => clearTimeout(t);
  }, []);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = lamp.current;
    if (!m) return;
    const t = clock.elapsedTime;
    m.emissiveIntensity = celebrate ? 3 + Math.sin(t * 12 + index) * 1.5 : hovered ? 4 : goal ? 2.6 + Math.sin(t * 2.5) * 0.6 : 1.8;
  });
  const rod = goal ? toon('#f2c14e', { metal: 0.9, rough: 0.25 }) : toon('#b98a3e', { metal: 0.85, rough: 0.35 });
  const iron = toon('#3b3440', { metal: 0.6, rough: 0.55 });
  const brass = toon('#c9973f', { metal: 0.85, rough: 0.35 });
  return (
    <group
      position={[x, 0, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      {/* socket */}
      <mesh position-y={0.36} material={iron} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, 0.1, 16]} />
      </mesh>
      <mesh position-y={0.43} material={goal ? rod : brass} receiveShadow>
        <cylinderGeometry args={[0.5, 0.58, 0.05, 16]} />
      </mesh>
      {/* rod */}
      <mesh position-y={(0.45 + ROD_TOP) / 2} material={rod} castShadow>
        <cylinderGeometry args={[0.085, 0.085, ROD_TOP - 0.45, 10]} />
      </mesh>
      <mesh position-y={ROD_TOP} material={iron}>
        <cylinderGeometry args={[0.13, 0.11, 0.08, 10]} />
      </mesh>
      {/* lamp on top */}
      <mesh position-y={ROD_TOP + 0.13}>
        <icosahedronGeometry args={[0.12, 1]} />
        <meshStandardMaterial ref={lamp} color={goal ? '#c9ffd9' : '#ffd38a'} emissive={goal ? '#5dff9a' : '#ffa53a'} emissiveIntensity={2} />
      </mesh>
      {goal && (
        <>
          <mesh position-y={0.39} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.74, 0.86, 40]} />
            <meshBasicMaterial color="#ffd166" toneMapped={false} />
          </mesh>
          {labelReady && (
            <Html position={[0, ROD_TOP + 0.75, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  fontFamily: 'Fredoka, system-ui, sans-serif',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 1.5,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: 'linear-gradient(#ffe08a,#f4b03e)',
                  color: '#4a2a05',
                  boxShadow: '0 3px 0 rgba(0,0,0,.25), 0 8px 16px rgba(0,0,0,.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                GOAL
              </div>
            </Html>
          )}
        </>
      )}
      {hovered && <HintRing position={[0, 0.47, 0]} radius={0.95} color="#ffffff" />}
      {/* big invisible tap target */}
      <mesh position-y={1.5} visible={false}>
        <cylinderGeometry args={[1.15, 1.15, 3.4, 10]} />
      </mesh>
    </group>
  );
}

interface CogProps {
  index: number;
  state: State;
  /** Set only for the cog that just moved. */
  lastMove: Move | null;
  liftedAtPlay: boolean;
  forward: boolean;
  moveCount: number;
  resetCount: number;
  held: boolean;
  celebrate: boolean;
  /** Set when this cog is the one that tried to land on a smaller cog. */
  bonk: Bonk | null;
  /** When this cog gets squashed by a bigger one (performance.now ms), or 0. */
  squashAt: number;
  onClick(): void;
}

function Cog({ index: c, state, lastMove, liftedAtPlay, forward, moveCount, resetCount, held, celebrate, bonk, squashAt, onClick }: CogProps) {
  const ref = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const r = radius(c);
  const geo = useMemo(
    () =>
      cogGeometry({
        radius: r,
        height: T - 0.012,
        hole: 0.13,
        tooth: 0.085,
        windows: c >= 2 ? (c >= 4 ? 6 : 5) : 0,
      }),
    [r, c],
  );
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS[c],
        metalness: 0.45,
        roughness: 0.32,
        flatShading: true,
        emissive: new THREE.Color(COLORS[c]),
        emissiveIntensity: 0,
      }),
    [c],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const hub = toon('#e2b45a', { metal: 0.9, rough: 0.28 });

  const key = `${moveCount}|${resetCount}|${held}|${bonk?.at ?? 0}`;
  const segs = useMemo<PathSegment[]>(() => {
    const home = slot(state, c);
    if (bonk) {
      const land = slotTop(state, bonk.under);
      land[1] -= T * 0.4;
      return [
        {
          to: above(bonk.target),
          durationMs: BONK_GLIDE,
          height: 0.2 + Math.abs(bonk.target - bonk.from) * 0.1,
        },
        { to: land, durationMs: BONK_DROP },
        { to: above(bonk.target), durationMs: BONK_BOUNCE, height: 0.7 },
        { to: above(bonk.from), durationMs: BONK_BACK, height: 0.3 },
      ];
    }
    if (held)
      return [
        {
          to: above(state.peg[c]),
          durationMs: LIFT_MS,
          height: 0,
          onStart: sfx.hop,
        },
      ];
    if (forward && lastMove) {
      const out: PathSegment[] = [];
      if (!liftedAtPlay)
        out.push({
          to: above(lastMove.from),
          durationMs: LIFT_MS,
          onStart: sfx.hop,
        });
      out.push({
        to: above(lastMove.to),
        durationMs: GLIDE_MS + (liftedAtPlay ? LIFT_MS : 0),
        height: 0.25 + Math.abs(lastMove.to - lastMove.from) * 0.12,
      });
      out.push({
        to: home,
        durationMs: DROP_MS,
        onEnd: () => clank(1.6 - c * 0.12),
      });
      return out;
    }
    return [
      {
        to: home,
        durationMs: forward ? DROP_MS : 360,
        height: forward ? 0 : 0.3,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  usePath(ref, segs, key, { face: false });

  const speed = useRef(0);
  useFrame(({ clock }, dt) => {
    const s = spin.current;
    if (!s) return;
    const dir = c % 2 === 0 ? 1 : -1;
    const target = (celebrate ? 5 : held ? 2.2 : 0.22) / r;
    speed.current += (target - speed.current) * Math.min(1, dt * 3);
    s.rotation.y += dir * speed.current * dt;
    // Squash and stretch: squashed flat by a bigger cog, or squishing on impact itself.
    const now = performance.now();
    const sy = squashAt ? wobble((now - squashAt) / 1000, 0.5) : bonk ? wobble((now - bonk.at - BONK_IMPACT) / 1000, 0.28) : 1;
    s.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    const glow = held ? 0.35 + Math.sin(clock.elapsedTime * 6) * 0.12 : celebrate ? 0.3 : 0;
    mat.emissiveIntensity += (glow - mat.emissiveIntensity) * Math.min(1, dt * 8);
  });

  return (
    <group ref={ref}>
      <group ref={spin}>
        <group
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <mesh geometry={geo} material={mat} castShadow receiveShadow />
          {/* brass hub collar */}
          <mesh position-y={T / 2} material={hub} castShadow>
            <cylinderGeometry args={[0.2, 0.2, T + 0.02, 12, 1, true]} />
          </mesh>
          {/* bolts on the hub */}
          <mesh position-y={T + 0.012} rotation-x={-Math.PI / 2} material={hub}>
            <ringGeometry args={[0.13, 0.2, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
