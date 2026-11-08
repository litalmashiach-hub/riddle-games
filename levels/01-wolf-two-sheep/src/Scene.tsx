import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, sfx, usePath, useFaceYaw, type PathSegment, type Vec3 } from '@riddle/fx';
import { Boat, Bubble, Farmer, HintRing, RiverValley, Sheep, Wolf, groundHeight, type Mood } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { ANIMALS, dangerBank, type Animal, type Move, type Side, type State } from './rules';

const CROSS_MS = 1900;
/** Pause after docking before the passenger steps out. */
const DOCK_MS = 250;
const HOP_MS = 520;
export const MOVE_MS = CROSS_MS + DOCK_MS + HOP_MS;

const sign = (s: Side) => (s === 'L' ? -1 : 1);
const boatX = (s: Side) => sign(s) * 1.55;
/** Passenger seat: the end of the boat nearest the bank it boarded from. */
const seat = (boatSide: Side, boardedFrom: Side): Vec3 => [boatX(boatSide) + sign(boardedFrom) * 0.72, 0.05, 0];

const SLOTS: Record<Animal, { x: number; z: number }> = {
  wolf: { x: 4.1, z: -0.3 },
  sheepA: { x: 3.9, z: 1.4 },
  sheepB: { x: 5.0, z: 0.8 },
};
const slot = (a: Animal, side: Side): Vec3 => {
  const x = sign(side) * SLOTS[a].x;
  const z = SLOTS[a].z;
  return [x, groundHeight(x, z), z];
};

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The animal the player has put in the boat but not rowed yet (UI only, not a move). */
  const [loaded, setLoaded] = useState<Animal | null>(null);
  const [burst, setBurst] = useState(0);
  const lastCount = useRef(moveCount);
  const forward = moveCount > lastCount.current;
  useEffect(() => {
    lastCount.current = moveCount;
    setLoaded(null);
  }, [moveCount, resetCount]);

  const over = status.kind !== 'playing';
  const danger = status.kind === 'lost' ? dangerBank(state) : null;
  const won = status.kind === 'won';

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  const rowing = busy && forward && !over ? true : busy && forward;
  const animKey = `${moveCount}|${resetCount}|${loaded}`;

  // ---- Boat ----
  const boat = useRef<THREE.Group>(null);
  const boatSegs: PathSegment[] = forward
    ? [{ to: [boatX(state.farmer), 0, 0], durationMs: CROSS_MS, height: 0, onStart: sfx.row }]
    : [{ to: [boatX(state.farmer), 0, 0], durationMs: 400, height: 0 }];
  usePath(boat, boatSegs, `${moveCount}|${resetCount}`, { face: false });

  const toggle = (a: Animal) => {
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
    play({ passenger: loaded });
  };

  const hintTarget: Vec3 | null = hint
    ? hint.passenger && hint.passenger !== loaded
      ? slot(hint.passenger, state.farmer)
      : [boatX(state.farmer), 0.25, 0]
    : null;

  return (
    <group>
      <RiverValley />

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
              <span style={{ opacity: 0.7, fontSize: 13, marginLeft: 6 }}>{loaded ? (loaded === 'wolf' ? 'with wolf' : 'with sheep') : 'alone'}</span>
            </button>
          </Html>
        )}
      </group>

      {ANIMALS.map((a, i) => (
        <AnimalActor
          key={a}
          kind={a}
          seed={i}
          state={state}
          previous={previous}
          lastMove={lastMove}
          forward={forward}
          loaded={loaded === a}
          animKey={animKey}
          danger={danger}
          won={won}
          disabled={busy || over}
          busy={busy}
          boat={boat}
          onClick={() => toggle(a)}
        />
      ))}

      {hintTarget && !busy && <HintRing position={[hintTarget[0], hintTarget[1] + 0.03, hintTarget[2]]} radius={hint?.passenger && hint.passenger !== loaded ? 0.6 : 1.4} />}
      <Burst trigger={burst} position={[4.3, 1.2, 0.6]} />
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
  kind: Animal;
  seed: number;
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  loaded: boolean;
  animKey: string;
  danger: Side | null;
  won: boolean;
  disabled: boolean;
  busy: boolean;
  boat: RefObject<THREE.Group | null>;
  onClick(): void;
}

function AnimalActor({ kind, seed, state, previous, lastMove, forward, loaded, animKey, danger, won, disabled, busy, boat, onClick }: ActorProps) {
  const ref = useRef<THREE.Group>(null);
  const side = state[kind];
  const rode = forward && lastMove?.passenger === kind && previous != null;
  const isWolf = kind === 'wolf';

  // Who gets into trouble on a loss: the wolf and the lone sheep on the danger bank.
  const lonelySheep = danger && !isWolf && side === danger;
  const pouncing = danger && isWolf;
  // Reactions wait until the boat has landed.
  const react = !busy;

  const segs = useMemo<PathSegment[]>(() => {
    if (rode && previous) {
      const from = previous[kind];
      const ride = seat(state.farmer, from);
      return [
        // Sit in the boat for the whole crossing, then step out once it has docked.
        { to: ride, follow: boat, offset: [sign(from) * 0.72, 0.05, 0], durationMs: CROSS_MS + DOCK_MS },
        { to: slot(kind, side), durationMs: HOP_MS, height: 0.9, onStart: sfx.hop },
      ];
    }
    if (loaded) return [{ to: seat(state.farmer, state.farmer), durationMs: 480, height: 0.9 }];
    const home: PathSegment = { to: slot(kind, side), durationMs: 480, height: 0.7 };
    if (pouncing && danger) {
      const sheep = (['sheepA', 'sheepB'] as Animal[]).find((s) => state[s] === danger)!;
      const target = slot(sheep, danger);
      const near: Vec3 = [(target[0] * 2 + home.to[0]) / 3, target[1], (target[2] * 2 + home.to[2]) / 3];
      return [
        { to: home.to, durationMs: 10, delayMs: forward ? CROSS_MS + DOCK_MS : 0 },
        { to: near, durationMs: 450, height: 1.3, onStart: sfx.growl },
      ];
    }
    return [home];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, danger]);

  usePath(ref, segs, `${animKey}|${danger}`, { face: true });

  // Face the river when standing on a bank.
  const facing = useRef<THREE.Group>(null);
  const yaw = loaded ? (state.farmer === 'L' ? Math.PI / 2 : -Math.PI / 2) : side === 'L' ? Math.PI / 2 : -Math.PI / 2;
  useFaceYaw(facing, yaw, 5);

  const mood: Mood = !react ? 'idle' : won ? 'happy' : lonelySheep ? 'scared' : pouncing ? 'angry' : 'idle';
  const Body = isWolf ? Wolf : Sheep;

  return (
    <group ref={ref}>
      <group ref={facing}>
        <Clickable onClick={onClick} disabled={disabled}>
          <Body mood={mood} seed={seed} scale={isWolf ? 1.15 : 1.05} />
          {/* bigger invisible hit area, easier to tap on phones */}
          <mesh position-y={0.5} visible={false}>
            <sphereGeometry args={[0.6, 8, 8]} />
          </mesh>
        </Clickable>
      </group>
      {react && lonelySheep && <Bubble position={[0, 1.3, 0]} tone="red">!</Bubble>}
      {react && pouncing && <Bubble position={[0, 1.5, 0]} tone="white">GRRR!</Bubble>}
      {loaded && <HintRing position={[0, 0.06, 0]} radius={0.45} color="#7ee0b0" />}
    </group>
  );
}
