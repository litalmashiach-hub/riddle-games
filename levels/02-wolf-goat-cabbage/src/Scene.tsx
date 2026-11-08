import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, sfx, usePath, useFaceYaw, type PathSegment, type Vec3 } from '@riddle/fx';
import { Boat, Bubble, Farmer, HintRing, RiverValley, Wolf, groundHeight, type Mood } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Barn, Butterflies, Cabbage, GardenBed, Goat, HayBale, LeafBurst } from './models';
import { ITEMS, trouble, type Item, type Move, type Side, type State, type Trouble } from './rules';

const CROSS_MS = 1900;
const HOP_MS = 520;
export const MOVE_MS = CROSS_MS + HOP_MS;
/** When a fail reaction starts after a crossing: just after the boat lands. */
const REACT_DELAY = CROSS_MS + 150;
const LUNGE_MS = 450;
/** How long the goat chews before the cabbage is gone. */
const MUNCH_MS = 900;

const sign = (s: Side) => (s === 'L' ? -1 : 1);
const boatX = (s: Side) => sign(s) * 1.55;
/** Passenger seat: the end of the boat nearest the bank it boarded from. */
const seat = (boatSide: Side, boardedFrom: Side): Vec3 => [boatX(boatSide) + sign(boardedFrom) * 0.72, 0.05, 0];

const SLOTS: Record<Item, { x: number; z: number }> = {
  wolf: { x: 4.3, z: -0.7 },
  goat: { x: 3.8, z: 1.4 },
  cabbage: { x: 4.85, z: 0.45 },
};
const slot = (a: Item, side: Side): Vec3 => {
  const x = sign(side) * SLOTS[a].x;
  const z = SLOTS[a].z;
  return [x, groundHeight(x, z) + (a === 'cabbage' && side === 'L' ? 0.04 : 0), z];
};
/** A point most of the way from `from` toward `to`, for a lunge that stops just short. */
const lungeAt = (from: Vec3, to: Vec3, k = 0.68): Vec3 => [from[0] + (to[0] - from[0]) * k, to[1], from[2] + (to[2] - from[2]) * k];

const LABEL: Record<Item, string> = { wolf: 'with wolf', goat: 'with goat', cabbage: 'with cabbage' };

/** Three quick chomps. */
function crunch() {
  [0, 160, 320].forEach((d) => setTimeout(() => sfx.click(), d));
}

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The passenger the player has put in the boat but not rowed yet (UI only, not a move). */
  const [loaded, setLoaded] = useState<Item | null>(null);
  const [burst, setBurst] = useState(0);
  // Which way the last change of moveCount went, worked out during render so that later
  // re-renders (like clearing the selection) can't flip it. It only counts while the move
  // is still animating, so a finished ride never replays when the scene re-keys.
  const dir = useRef({ count: moveCount, up: false });
  if (dir.current.count !== moveCount) dir.current = { count: moveCount, up: moveCount > dir.current.count };
  const forward = busy && dir.current.up;
  // Undo and restart drop any half-made selection.
  useEffect(() => setLoaded(null), [moveCount, resetCount]);

  const over = status.kind !== 'playing';
  const danger = status.kind === 'lost' ? trouble(state) : null;
  const won = status.kind === 'won';

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  const rowing = busy && forward;
  const animKey = `${moveCount}|${resetCount}`;

  // ---- Boat ----
  const boat = useRef<THREE.Group>(null);
  const boatSegs: PathSegment[] = forward
    ? [{ to: [boatX(state.farmer), 0, 0], durationMs: CROSS_MS, height: 0, onStart: sfx.row }]
    : [{ to: [boatX(state.farmer), 0, 0], durationMs: 400, height: 0 }];
  usePath(boat, boatSegs, `${moveCount}|${resetCount}`, { face: false });

  const toggle = (a: Item) => {
    if (busy || over) return;
    if (state[a] !== state.farmer) {
      sfx.denied();
      return;
    }
    if (loaded === a) {
      sfx.deselect();
      setLoaded(null);
    } else {
      sfx.hop();
      setLoaded(a);
    }
  };
  const row = () => {
    if (busy || over) return;
    // Clear the selection in the same update as the move, so the passenger rides instead of hopping home.
    setLoaded(null);
    play({ passenger: loaded });
  };

  const hintOnItem = !!hint?.passenger && hint.passenger !== loaded;
  const hintTarget: Vec3 | null = hint ? (hintOnItem ? slot(hint.passenger!, state.farmer) : [boatX(state.farmer), 0.25, 0]) : null;

  return (
    <group>
      <RiverValley />
      <Farmyard />

      <group ref={boat}>
        <Clickable onClick={row} disabled={busy || over} hoverScale={1.03}>
          <Boat rowing={rowing}>
            <FarmerInBoat side={state.farmer} rowing={rowing} won={won && !busy} />
          </Boat>
        </Clickable>
        {!busy && !over && (
          <Html position={[0, 1.7, 0]} center zIndexRange={[5, 0]}>
            <button
              onClick={row}
              style={{
                fontFamily: 'Fredoka, system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 17,
                padding: '8px 16px',
                borderRadius: 999,
                border: '2px solid rgba(255,255,255,.8)',
                background: loaded ? 'linear-gradient(#ffe08a,#f4b03e)' : 'linear-gradient(#ffffff,#dbeafe)',
                color: '#1f2937',
                boxShadow: '0 4px 0 rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.25)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {state.farmer === 'L' ? 'Row across ➜' : '⬅ Row back'}
              <span style={{ opacity: 0.7, fontSize: 13, marginLeft: 6 }}>{loaded ? LABEL[loaded] : 'alone'}</span>
            </button>
          </Html>
        )}
      </group>

      {ITEMS.map((a, i) => (
        <Actor
          key={a}
          kind={a}
          seed={i}
          state={state}
          previous={previous}
          lastMove={lastMove}
          forward={forward}
          loaded={loaded === a}
          animKey={`${animKey}|${loaded === a}`}
          danger={danger}
          won={won}
          disabled={busy || over}
          busy={busy}
          onClick={() => toggle(a)}
        />
      ))}

      {hintTarget && !busy && <HintRing position={[hintTarget[0], hintTarget[1] + 0.03, hintTarget[2]]} radius={hintOnItem ? 0.6 : 1.4} />}
      <Burst trigger={burst} position={[4.4, 1.2, 0.5]} />
    </group>
  );
}

/** Level-only set dressing: the garden the cabbage came from and the barn it is heading to. */
function Farmyard() {
  const garden = slot('cabbage', 'L');
  const barnX = 7.4,
    barnZ = -4.6;
  return (
    <group>
      <GardenBed position={[garden[0], groundHeight(garden[0], garden[2]) - 0.02, garden[2]]} rotation={-0.4} />
      <Butterflies center={[garden[0] - 0.6, groundHeight(garden[0], garden[2]), garden[2] - 0.6]} />
      <Barn position={[barnX, groundHeight(barnX, barnZ) - 0.05, barnZ]} rotation-y={-0.55} />
      <HayBale position={[5.6, groundHeight(5.6, -3.4), -3.4]} rotation-y={0.4} />
      <HayBale position={[-6.4, groundHeight(-6.4, -4.2), -4.2]} rotation-y={-0.7} />
      <HayBale position={[-7.1, groundHeight(-7.1, -4.9), -4.9]} rotation-y={0.3} scale={0.85} />
    </group>
  );
}

function FarmerInBoat({ side, rowing, won }: { side: Side; rowing: boolean; won: boolean }) {
  const ref = useRef<THREE.Group>(null);
  // Face the far bank: +x is yaw +PI/2.
  useFaceYaw(ref, side === 'L' ? Math.PI / 2 : -Math.PI / 2, 3);
  return (
    <group ref={ref} position={[0, 0.0, 0]}>
      <Farmer rowing={rowing} mood={won ? 'happy' : 'idle'} />
    </group>
  );
}

interface ActorProps {
  kind: Item;
  seed: number;
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  loaded: boolean;
  animKey: string;
  danger: Trouble | null;
  won: boolean;
  disabled: boolean;
  busy: boolean;
  onClick(): void;
}

function Actor({ kind, seed, state, previous, lastMove, forward, loaded, animKey, danger, won, disabled, busy, onClick }: ActorProps) {
  const ref = useRef<THREE.Group>(null);
  const side = state[kind];
  const rode = forward && lastMove?.passenger === kind && previous != null;

  // Who is in trouble on a loss. Wolf + goat: the wolf pounces, the goat panics.
  // Goat + cabbage: the goat trots over and munches, the cabbage panics and vanishes.
  const eater = danger?.eater === kind;
  const victim = danger != null && ((danger.eater === 'wolf' && kind === 'goat') || (danger.eater === 'goat' && kind === 'cabbage'));
  // Reactions (moods and bubbles) wait until the boat has landed.
  const react = !busy;
  const dangerKey = danger ? `${danger.bank}${danger.eater}` : '-';

  const segs = useMemo<PathSegment[]>(() => {
    if (rode && previous) {
      const from = previous[kind];
      return [
        { to: seat(state.farmer, from), durationMs: CROSS_MS, height: 0 },
        { to: slot(kind, side), durationMs: HOP_MS, height: kind === 'cabbage' ? 0.6 : 0.9, onStart: sfx.hop },
      ];
    }
    if (loaded) return [{ to: seat(state.farmer, state.farmer), durationMs: 480, height: 0.9 }];
    const home: PathSegment = { to: slot(kind, side), durationMs: 480, height: 0.7 };
    if (eater && danger) {
      const prey: Item = danger.eater === 'wolf' ? 'goat' : 'cabbage';
      const near = lungeAt(home.to, slot(prey, danger.bank), kind === 'goat' ? 0.62 : 0.55);
      return [
        { to: home.to, durationMs: 10, delayMs: forward ? REACT_DELAY : 0 },
        {
          to: near,
          durationMs: LUNGE_MS,
          height: kind === 'wolf' ? 1.3 : 0.6,
          onStart: kind === 'wolf' ? sfx.growl : sfx.hop,
          onEnd: kind === 'goat' ? crunch : undefined,
        },
      ];
    }
    return [home];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, dangerKey]);

  usePath(ref, segs, `${animKey}|${dangerKey}`, { face: true });

  // Face the river when standing on a bank; the eater turns toward its prey.
  const facing = useRef<THREE.Group>(null);
  let yaw = loaded ? (state.farmer === 'L' ? Math.PI / 2 : -Math.PI / 2) : side === 'L' ? Math.PI / 2 : -Math.PI / 2;
  if (eater && danger && react) {
    const me = slot(kind, side);
    const prey = slot(danger.eater === 'wolf' ? 'goat' : 'cabbage', danger.bank);
    yaw = Math.atan2(prey[0] - me[0], prey[2] - me[2]);
  }
  useFaceYaw(facing, yaw, 5);

  // The munched cabbage shrinks away and sprays leaves.
  const eatenRef = useRef<THREE.Group>(null);
  const munchAt = useRef<number | null>(null);
  const [leaves, setLeaves] = useState(0);
  const [gone, setGone] = useState(false);
  const munched = kind === 'cabbage' && victim;
  useEffect(() => {
    munchAt.current = null;
    setGone(false);
    if (!munched) return;
    const start = (forward ? REACT_DELAY : 0) + LUNGE_MS + 120;
    const t = setTimeout(() => {
      munchAt.current = performance.now();
      setLeaves((n) => n + 1);
    }, start);
    const t2 = setTimeout(() => setGone(true), start + MUNCH_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [munched, animKey]);
  useFrame((_, dt) => {
    const g = eatenRef.current;
    if (!g) return;
    let target = 1;
    if (munchAt.current != null) {
      const k = Math.min(1, (performance.now() - munchAt.current) / MUNCH_MS);
      // Shrinks in three bites.
      target = 1 - Math.ceil(k * 3) / 3;
      if (k <= 0) target = 1;
    }
    const s = THREE.MathUtils.damp(g.scale.x, target, 14, dt);
    g.scale.setScalar(s < 0.02 && target === 0 ? 0 : s);
  });

  const mood: Mood = !react ? 'idle' : won ? 'happy' : victim ? 'scared' : eater ? 'angry' : 'idle';
  const leafAt = slot('cabbage', danger?.bank ?? side);

  return (
    <>
      <group ref={ref}>
        <group ref={facing}>
          <group ref={eatenRef}>
            <Clickable onClick={onClick} disabled={disabled}>
              {kind === 'wolf' && <Wolf mood={mood} seed={seed} scale={1.15} />}
              {kind === 'goat' && <Goat mood={mood} seed={seed} scale={1.1} chewing={eater && react} />}
              {kind === 'cabbage' && <Cabbage mood={mood} seed={seed} scale={1.15} />}
              {/* bigger invisible hit area, easier to tap on phones */}
              <mesh position-y={0.5} visible={false}>
                <sphereGeometry args={[0.6, 8, 8]} />
              </mesh>
            </Clickable>
          </group>
        </group>
        {react && victim && kind === 'goat' && <Bubble position={[0, 1.5, 0]} tone="red">Meeeh!</Bubble>}
        {react && victim && kind === 'cabbage' && !gone && <Bubble position={[0, 1.1, 0]} tone="red">!</Bubble>}
        {react && eater && kind === 'wolf' && <Bubble position={[0, 1.6, 0]} tone="white">GRRR!</Bubble>}
        {react && eater && kind === 'goat' && <Bubble position={[0, 1.6, 0]} tone="gold">MUNCH!</Bubble>}
        {loaded && <HintRing position={[0, 0.06, 0]} radius={0.45} color="#7ee0b0" />}
      </group>
      {kind === 'cabbage' && <LeafBurst trigger={leaves} position={[leafAt[0], leafAt[1] + 0.3, leafAt[2]]} />}
    </>
  );
}
