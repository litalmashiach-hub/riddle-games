import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, DizzyStars, FocusCam, sfx, usePath, usePhases, type PathSegment, type Vec3 } from '@riddle/fx';
import { HintRing, toon } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Backdrop } from './Backdrop';
import { Hedgehog, type Mood } from './Hedgehog';
import { Bridges, Islets } from './Islets';
import { ISLET_XZ, RAFT, SPANS, TOP, standAt } from './layout';
import { BRIDGES, ON_RAFT, badStart, bridgeBetween, reachable, type Move, type State } from './rules';

const STEP_MS = 330;
const START_HOP_MS = 820;
/** Two little hops across the bridge, then it sinks. */
export const MOVE_MS = STEP_MS * 2 + 300;
/** Beats of the stranded gag. */
const FAIL: ['puzzled' | 'curl' | 'dizzy', number][] = [
  ['puzzled', 1200],
  ['curl', 1100],
  ['dizzy', 60000],
];
export const END_DELAY_MS = 1200 + 1100 + 900;

export function Scene({ state, previous, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  // Was the latest change a new move (animate) or an undo / restart (move back quickly)?
  const holdUntil = useRef<number[]>(BRIDGES.map(() => 0));
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    const forward = resetCount === dir.current.reset && moveCount > dir.current.count;
    dir.current = { count: moveCount, reset: resetCount, forward };
    // A bridge that was just crossed waits for Bramble to get over it before it sinks.
    if (forward && previous && previous.at !== ON_RAFT) holdUntil.current[bridgeBetween(previous.at, state.at)] = performance.now() + STEP_MS * 2;
  }
  const forward = dir.current.forward;
  const crossed = forward && previous && previous.at !== ON_RAFT ? bridgeBetween(previous.at, state.at) : -1;

  const over = status.kind !== 'playing';
  const won = status.kind === 'won' && !busy;
  const lost = status.kind === 'lost' && !busy;
  const fail = usePhases(lost, FAIL);

  // ---- Bramble walks ----
  const hog = useRef<THREE.Group>(null);
  const here = standAt(state.at);
  let segs: PathSegment[];
  if (!forward) segs = [{ to: here, durationMs: 340, height: 0.5 }];
  else if (crossed < 0) segs = [{ to: here, durationMs: START_HOP_MS, height: 2.1, onStart: sfx.boing, onEnd: sfx.hop }];
  else {
    const mid: Vec3 = [SPANS[crossed].mid[0], TOP + 0.02, SPANS[crossed].mid[1]];
    segs = [
      { to: mid, durationMs: STEP_MS, height: 0.24, onStart: sfx.hop, onEnd: sfx.select },
      { to: here, durationMs: STEP_MS, height: 0.24, onStart: sfx.hop, onEnd: sfx.splash },
    ];
  }
  usePath(hog, segs, `${moveCount}|${resetCount}`, { face: true });
  // After arriving (and at the start), he turns to face the player.
  const arrived = !busy;
  useFrame((_, dt) => {
    const g = hog.current;
    if (!g || !arrived) return;
    const d = Math.atan2(Math.sin(-g.rotation.y), Math.cos(-g.rotation.y));
    g.rotation.y += d * Math.min(1, dt * 5);
  });

  // ---- Win party ----
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!won) return;
    setBurst((b) => b + 1);
    sfx.boing();
  }, [won]);

  // ---- Stranded: look around, curl up and spin, flop over ----
  useEffect(() => {
    if (fail === 'puzzled') sfx.squeak();
    if (fail === 'curl') sfx.boing();
    if (fail === 'dizzy') sfx.sadTrombone();
  }, [fail]);

  const [nope, setNope] = useState(0);
  const open = !busy && !over ? reachable(state) : [];
  const tap = (islet: number) => {
    if (busy || over) return;
    if (open.includes(islet)) play({ to: islet });
    else {
      sfx.denied();
      setNope((n) => n + 1);
    }
  };

  // A start from which no walk crosses every bridge says so at once, not nine moves later.
  const doomed = useMemo(() => badStart(state), [state]);

  const mood: Mood = won ? 'happy' : fail ?? 'idle';
  const hintIslet = hint && !busy && !over ? hint.to : -1;

  return (
    <group>
      <Backdrop />
      <Islets />
      <Bridges used={state.used} holdUntil={holdUntil} party={won} />
      <Raft />

      {ISLET_XZ.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Clickable onClick={() => tap(i)} disabled={busy || over} hoverScale={1}>
            <mesh position-y={0.6} visible={false}>
              <cylinderGeometry args={[1.2, 1.2, 1.5, 10]} />
            </mesh>
          </Clickable>
          {open.includes(i) && i !== hintIslet && <ReachRing />}
        </group>
      ))}
      {hintIslet >= 0 && <HintRing position={[ISLET_XZ[hintIslet][0], TOP + 0.05, ISLET_XZ[hintIslet][1]]} radius={1.02} />}

      <group ref={hog}>
        <Hedgehog mood={mood} nope={nope} />
      </group>

      {/* stranded gag: a big "!" while he looks around, stars once he has flopped over */}
      {fail === 'puzzled' && <Exclaim position={[here[0], here[1] + 1.15, here[2]]} />}
      {fail === 'dizzy' && <DizzyStars position={[here[0], here[1] + 0.75, here[2]]} radius={0.3} />}
      <FocusCam target={[here[0], 0.3, here[2]]} active={!!fail} closer={0.62} />

      <Burst trigger={burst} position={[0, 1.4, 0]} />
      {doomed && !busy && !over && <BadStartNote first={moveCount === 1} />}
    </group>
  );
}

/**
 * The plain note after a start that can't win. Pinned to the screen's bottom middle, between the buttons
 * at the sides and below the islets, so it covers no islet at any size and stays clear of the Hint line at the top.
 */
function BadStartNote({ first }: { first: boolean }) {
  return (
    <Html fullscreen zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'max(10px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div
          data-testid="bad-start-note"
          role="status"
          style={{
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontWeight: 600,
            fontSize: 15,
            lineHeight: 1.25,
            padding: '6px 14px',
            borderRadius: 14,
            maxWidth: 'min(360px, calc(100vw - 230px))',
            textAlign: 'center',
            color: '#3b1d0a',
            background: 'linear-gradient(#fde68a,#fbbf24)',
            border: '1.5px solid #fff7d6',
            boxShadow: '0 4px 14px rgba(0,0,0,.35)',
          }}
        >
          {first ? 'From this islet Bramble can never cross every bridge. Undo and start on another one!' : 'Bramble started on an islet where he can never cross every bridge. Restart and pick another!'}
        </div>
      </div>
    </Html>
  );
}

/** A soft ring on every islet Bramble can go to next. */
function ReachRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(clock.elapsedTime * 3) * 0.12;
  });
  return (
    <mesh ref={ref} position-y={TOP + 0.045} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.84, 0.95, 36]} />
      <meshBasicMaterial color="#d7fbff" transparent opacity={0.3} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** A bouncing 3D exclamation mark. */
function Exclaim({ position }: { position: Vec3 }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + Math.abs(Math.sin(clock.elapsedTime * 7)) * 0.15;
  });
  const red = toon('#ff5a6e', { emissive: '#ff2f4f', emissiveIntensity: 1.6 });
  return (
    <group ref={ref} position={position}>
      <mesh position-y={0.22} material={red}>
        <capsuleGeometry args={[0.07, 0.26, 3, 8]} />
      </mesh>
      <mesh position-y={-0.08} material={red}>
        <sphereGeometry args={[0.075, 8, 6]} />
      </mesh>
    </group>
  );
}

/** The leaf raft Bramble waits on before he picks an islet. */
function Raft() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.02;
    g.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.03;
  });
  return (
    <group position={[RAFT[0], 0, RAFT[2]]}>
      <group ref={ref}>
        <mesh position-y={0.05} scale={[1.25, 1, 0.9]} material={toon('#49b267')} castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.56, 0.07, 14, 1, false, 0.3, Math.PI * 2 - 0.6]} />
        </mesh>
        <mesh position={[0.5, 0.11, -0.2]} material={toon('#ff9ecb', { emissive: '#ff7fbf', emissiveIntensity: 1.6 })}>
          <icosahedronGeometry args={[0.06, 0]} />
        </mesh>
      </group>
    </group>
  );
}
