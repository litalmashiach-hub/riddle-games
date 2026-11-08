import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, sfx, useFaceYaw, usePath, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, type Mood } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CANAL_HALF, Canal, QUAY_Y } from './Canal';
import { Character, HEIGHT } from './People';
import { DECK_Y, Raft } from './Raft';
import { PEOPLE, raftProblem, roleOf, trouble, type Move, type Person, type Side, type State } from './rules';

const CROSS_MS = 2300;
const HOP_MS = 520;
const BOARD_MS = 300;
export const MOVE_MS = CROSS_MS + HOP_MS;

const sign = (s: Side) => (s === 'L' ? -1 : 1);
const RAFT_X = CANAL_HALF - 1.22;
const raftX = (s: Side) => sign(s) * RAFT_X;
/** Two places to stand on the raft: 0 is nearest the bank it is docked at. */
const seat = (raftSide: Side, index: number, boardedFrom: Side): Vec3 => [raftX(raftSide) + sign(boardedFrom) * (index === 0 ? 0.5 : -0.38), DECK_Y, 0.12];

/** Where each person waits on a bank (distance from the canal centre, z). */
const SLOTS: Record<Person, { x: number; z: number }> = {
  guard: { x: 3.25, z: -1.55 },
  thief: { x: 4.5, z: -1.7 },
  father: { x: 3.3, z: -0.4 },
  mother: { x: 4.45, z: -0.45 },
  sonA: { x: 3.2, z: 0.75 },
  sonB: { x: 4.15, z: 0.85 },
  daughterA: { x: 3.3, z: 1.9 },
  daughterB: { x: 4.3, z: 1.95 },
};
const slot = (p: Person, side: Side): Vec3 => [sign(side) * SLOTS[p].x, QUAY_Y, SLOTS[p].z];

const LABEL: Record<Person, string> = {
  father: 'Dad',
  mother: 'Mom',
  sonA: 'Son',
  sonB: 'Son',
  daughterA: 'Daughter',
  daughterB: 'Daughter',
  guard: 'Guard',
  thief: 'Thief',
};

const towardRiver = (side: Side) => (side === 'L' ? Math.PI / 2 : -Math.PI / 2);
const yawTo = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** Pick actual people for a hinted move, preferring twins the player already seated. */
function hintPeople(hint: Move | null, loaded: Person[]): Person[] {
  if (!hint) return [];
  const out: Person[] = [];
  for (const p of hint.riders) {
    const role = roleOf(p);
    const twin = PEOPLE.find((q) => roleOf(q) === role && q !== p);
    const pick = twin && loaded.includes(twin) && !loaded.includes(p) && !out.includes(twin) ? twin : p;
    out.push(pick);
  }
  return out;
}

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** People the player has put on the raft but not sent yet (UI only). */
  const [loaded, setLoaded] = useState<Person[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  // `forward` stays true from a new move until the next undo or restart, so the
  // crossing animation is not cut short when the seated people are cleared.
  const seen = useRef({ moveCount, resetCount, forward: false });
  if (seen.current.moveCount !== moveCount || seen.current.resetCount !== resetCount) {
    const forward = seen.current.resetCount === resetCount && moveCount > seen.current.moveCount;
    seen.current = { moveCount, resetCount, forward };
  }
  const forward = seen.current.forward;
  useEffect(() => {
    setLoaded([]);
    setWarning(null);
  }, [moveCount, resetCount]);

  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 2400);
    return () => clearTimeout(t);
  }, [warning]);

  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const problem = status.kind === 'lost' ? trouble(state) : null;

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  const crossing = busy && forward;

  // ---- Raft ----
  const raft = useRef<THREE.Group>(null);
  const raftSegs: PathSegment[] = forward
    ? [{ to: [raftX(state.raft), 0, 0], durationMs: CROSS_MS - BOARD_MS, delayMs: BOARD_MS, height: 0, onStart: sfx.row }]
    : [{ to: [raftX(state.raft), 0, 0], durationMs: 400, height: 0 }];
  usePath(raft, raftSegs, `${moveCount}|${resetCount}`, { face: false });

  const toggle = (p: Person) => {
    if (busy || over) return;
    if (state[p] !== state.raft) {
      sfx.denied();
      setWarning('The raft is on the other side.');
      return;
    }
    if (loaded.includes(p)) {
      sfx.deselect();
      setLoaded(loaded.filter((q) => q !== p));
      return;
    }
    if (loaded.length >= 2) {
      sfx.denied();
      setWarning('The raft only holds two.');
      return;
    }
    sfx.hop();
    setLoaded([...loaded, p]);
    setWarning(null);
  };

  const castOff = () => {
    if (busy || over) return;
    const why = raftProblem(loaded);
    if (why) {
      sfx.denied();
      setWarning(why);
      return;
    }
    play({ riders: loaded });
  };

  const pending = raftProblem(loaded);
  const hinted = hintPeople(hint, loaded);
  const hintAtRaft = hint && hinted.length === loaded.length && hinted.every((p) => loaded.includes(p));

  return (
    <group>
      <Canal />

      <group ref={raft}>
        <Clickable onClick={castOff} disabled={busy || over} hoverScale={1.03}>
          <Raft moving={crossing} dir={state.raft === 'R' ? 1 : -1} />
          {/* bigger invisible hit box */}
          <mesh position={[0, 0.3, 0]} visible={false}>
            <boxGeometry args={[2.3, 0.6, 1.5]} />
          </mesh>
        </Clickable>
        {!busy && !over && (
          <Html position={[0, 2.45, 0]} center zIndexRange={[6, 0]}>
            <button
              onClick={castOff}
              style={{
                fontFamily: 'Fredoka, system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 17,
                padding: '8px 16px',
                borderRadius: 999,
                border: '2px solid rgba(255,255,255,.8)',
                background: loaded.length === 0 ? 'linear-gradient(#ffffff,#e7dccb)' : pending ? 'linear-gradient(#ffd1d1,#f59e9e)' : 'linear-gradient(#ffe08a,#f4b03e)',
                color: '#1f2937',
                boxShadow: '0 4px 0 rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.3)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                textAlign: 'center',
                lineHeight: 1.15,
              }}
            >
              {state.raft === 'L' ? 'Cast off ➜' : '⬅ Cast off'}
              <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 600 }}>
                {loaded.length === 0 ? 'tap people to board' : loaded.map((p) => LABEL[p]).join(' + ')}
              </div>
            </button>
          </Html>
        )}
        {warning && !busy && <Bubble position={[0, 3.2, 0]} tone="red">{warning}</Bubble>}
      </group>

      {PEOPLE.map((p, i) => (
        <Actor
          key={p}
          who={p}
          seed={i}
          state={state}
          previous={previous}
          lastMove={lastMove}
          forward={forward}
          seatIndex={loaded.indexOf(p)}
          resetCount={resetCount}
          moveCount={moveCount}
          problem={problem}
          won={won}
          busy={busy}
          disabled={busy || over}
          showLabel={!over}
          onClick={() => toggle(p)}
        />
      ))}

      {!busy && !over &&
        hinted
          .filter((p) => !loaded.includes(p))
          .map((p) => {
            const at = slot(p, state[p]);
            return <HintRing key={p} position={[at[0], at[1] + 0.04, at[2]]} radius={0.5} />;
          })}
      {!busy && !over && hintAtRaft && <HintRing position={[raftX(state.raft), DECK_Y + 0.04, 0]} radius={1.3} />}
      <Burst trigger={burst} position={[3.9, 1.6, 0.2]} />
    </group>
  );
}

interface ActorProps {
  who: Person;
  seed: number;
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  /** Index on the raft if seated (not yet sent), else -1. */
  seatIndex: number;
  resetCount: number;
  moveCount: number;
  problem: ReturnType<typeof trouble>;
  won: boolean;
  busy: boolean;
  disabled: boolean;
  showLabel: boolean;
  onClick(): void;
}

function Actor({ who, seed, state, previous, lastMove, forward, seatIndex, resetCount, moveCount, problem, won, busy, disabled, showLabel, onClick }: ActorProps) {
  const ref = useRef<THREE.Group>(null);
  const side = state[who];
  const rideIndex = forward && previous ? (lastMove?.riders.indexOf(who) ?? -1) : -1;
  const rode = rideIndex >= 0;
  const seated = seatIndex >= 0;
  const home = slot(who, side);

  // Loss reaction roles.
  const culprit = problem?.who[0] === who;
  const victim = !!problem && !culprit && problem.who.includes(who);
  const react = !busy;

  const animKey = `${moveCount}|${resetCount}|${rode ? 'ride' : seatIndex}|${problem ? problem.kind : ''}`;

  const segs = useMemo<PathSegment[]>(() => {
    const out: PathSegment[] = [];
    if (rode && previous) {
      const from = previous[who];
      out.push({ to: seat(from, rideIndex, from), durationMs: BOARD_MS, height: 0.45 });
      out.push({ to: seat(state.raft, rideIndex, from), durationMs: CROSS_MS - BOARD_MS, height: 0 });
      out.push({ to: home, durationMs: HOP_MS, height: 0.8, onStart: sfx.hop });
    } else if (seated) {
      out.push({ to: seat(state.raft, seatIndex, state.raft), durationMs: 460, height: 0.7 });
    } else {
      // Hop home, unless already standing there (then just settle).
      const away = ref.current ? ref.current.position.distanceTo(new THREE.Vector3(...home)) > 0.05 : false;
      out.push({ to: home, durationMs: away ? 480 : 10, height: away ? 0.6 : 0 });
    }
    if (problem && problem.who.includes(who)) {
      const wait = rode ? 120 : forward ? MOVE_MS : 0;
      const sideP = problem.side;
      if (problem.kind === 'thief' && culprit) {
        // The thief sneaks up on the first family member and grabs at their pockets.
        const target = slot(problem.who[1], sideP);
        const near: Vec3 = [(target[0] * 3 + home[0]) / 4, QUAY_Y, (target[2] * 3 + home[2]) / 4 - 0.25];
        out.push({ to: near, durationMs: 520, height: 0.9, delayMs: wait, onStart: sfx.growl });
        out.push({ to: [near[0] + 0.25, QUAY_Y, near[2] + 0.2], durationMs: 260, height: 0.35, onStart: sfx.click });
        out.push({ to: [near[0] - 0.15, QUAY_Y, near[2] + 0.4], durationMs: 260, height: 0.35, onStart: sfx.click });
      } else if (problem.kind === 'mom' && !culprit) {
        // The boys run wild around Mom.
        const c = slot('mother', sideP);
        const n = 7;
        const ofs = problem.who.indexOf(who) * Math.PI;
        for (let i = 1; i <= n; i++) {
          const a = ofs + (i / n) * Math.PI * 2 * 1.5;
          out.push({ to: [c[0] + Math.cos(a) * 0.8, QUAY_Y, c[2] + Math.sin(a) * 0.8], durationMs: 240, height: 0.35, delayMs: i === 1 ? wait : 0, onStart: i % 2 ? sfx.hop : undefined });
        }
      } else if (problem.kind === 'dad' && culprit) {
        // Dad shuffles closer to tell a joke.
        const t = slot(problem.who[1], sideP);
        out.push({ to: [(t[0] + home[0]) / 2, QUAY_Y, (t[2] + home[2]) / 2 - 0.2], durationMs: 420, height: 0.3, delayMs: wait });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  usePath(ref, segs, animKey, { face: false });

  // Facing: toward the river on a bank, toward the far bank on the raft, toward the trouble on a loss.
  const facing = useRef<THREE.Group>(null);
  let yaw = seated ? towardRiver(state.raft) : towardRiver(side);
  if (problem && react && problem.who.includes(who)) {
    const target = culprit ? slot(problem.who[1], problem.side) : slot(problem.who[0], problem.side);
    yaw = yawTo(home, target);
    if (problem.kind === 'mom' && victim) yaw = 0;
  }
  if (won && react) yaw = 0;
  useFaceYaw(facing, yaw, 5);

  let mood: Mood = 'idle';
  if (react && won) mood = 'happy';
  else if (react && problem) {
    if (problem.kind === 'thief') mood = culprit ? 'angry' : victim ? 'scared' : 'idle';
    if (problem.kind === 'dad') mood = culprit ? 'happy' : victim ? 'scared' : 'idle';
    if (problem.kind === 'mom') mood = culprit ? 'angry' : victim ? 'happy' : 'idle';
  }

  const role = roleOf(who);
  const h = HEIGHT[role];
  const bubble = react && problem ? reactionBubble(problem.kind, culprit, problem.who.indexOf(who)) : null;

  return (
    <group ref={ref}>
      <group ref={facing}>
        <Clickable onClick={onClick} disabled={disabled}>
          <Character who={who} mood={mood} seed={seed} />
          <mesh position-y={h * 0.5} visible={false}>
            <cylinderGeometry args={[0.38, 0.38, h + 0.2, 8]} />
          </mesh>
        </Clickable>
      </group>
      {showLabel && !busy && (
        <Html position={[0, h + 0.18, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontFamily: 'Fredoka, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 0.3,
              padding: '1px 7px',
              borderRadius: 999,
              background: seated ? 'rgba(126,224,176,.95)' : 'rgba(255,248,235,.82)',
              color: '#2a1f2b',
              boxShadow: '0 2px 6px rgba(0,0,0,.25)',
              whiteSpace: 'nowrap',
            }}
          >
            {LABEL[who]}
          </div>
        </Html>
      )}
      {bubble && (
        <Bubble position={[0, h + 0.45, 0]} tone={bubble.tone}>
          {bubble.text}
        </Bubble>
      )}
      {seated && <HintRing position={[0, 0.05, 0]} radius={0.36} color="#7ee0b0" />}
    </group>
  );
}

function reactionBubble(kind: 'thief' | 'dad' | 'mom', culprit: boolean, index: number): { text: string; tone: 'white' | 'red' | 'gold' } | null {
  if (kind === 'thief') return culprit ? { text: 'Hehehe!', tone: 'white' } : index === 1 ? { text: 'My watch!', tone: 'red' } : null;
  if (kind === 'dad') return culprit ? { text: 'Knock knock…', tone: 'white' } : index === 1 ? { text: 'Waaah!', tone: 'red' } : null;
  return culprit ? { text: 'BOYS!!', tone: 'red' } : index === 1 ? { text: 'Wheee!', tone: 'gold' } : null;
}

