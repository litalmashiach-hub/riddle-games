import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, sfx, useFaceYaw, usePath, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, type Mood } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Balloon, BASKET_FLOOR } from './Balloon';
import { Bird as BirdModel, COUPLE_COLORS, Steam } from './Bird';
import { FeatherPuff, MusicNotes, StormCloud, SweatDrop } from './Drama';
import { BIRDS, coupleOf, gent, nameOf, roleOf, trouble, type Bird, type Move, type Side, type State } from './rules';
import { DOCK_X, ISLAND_X, SkyIslands } from './SkyIslands';

const FLY_MS = 2600;
const HOP_MS = 520;
const FLY_HEIGHT = 1.7;
const BOARD_MS = 420;
const BALLOON_SCALE = 1.15;
const BIRD_SCALE = 1.22;
export const MOVE_MS = FLY_MS + HOP_MS + 200;

const sign = (s: Side) => (s === 'L' ? -1 : 1);
const balloonPos = (s: Side): Vec3 => [sign(s) * DOCK_X, 0, 0];
/** Two spots in the basket, side by side so both riders face the camera. */
const seat = (s: Side, i: number): Vec3 => [sign(s) * DOCK_X + (i === 0 ? -0.21 : 0.21), BASKET_FLOOR * BALLOON_SCALE, 0.03];

/** Each couple stands together in a row; the gent nearer the dock. */
const slot = (b: Bird, s: Side): Vec3 => {
  const c = coupleOf(b);
  const row = c - 1;
  const inward = (roleOf(b) === 'gent' ? 3.15 : 3.95) + (c === 1 ? 0.35 : 0);
  return [sign(s) * inward, 0, row * 1.2 + (roleOf(b) === 'gent' ? -0.08 : 0.08)];
};

/** Faces toward the gap but turned three-quarters to the camera. */
const islandYaw = (s: Side) => (s === 'L' ? 0.9 : -0.9);

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** Birds the player has put in the basket but not flown yet (UI only). */
  const [loaded, setLoaded] = useState<Bird[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  /** Riders the player had in the basket when they pressed Fly (redo and hints skip boarding). */
  const boarded = useRef<Bird[]>([]);
  // Direction of the latest change, fixed until the next move so re-renders mid-flight don't restart animations.
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    const forward = dir.current.reset === resetCount && moveCount > dir.current.count;
    dir.current = { count: moveCount, reset: resetCount, forward };
    if (!forward) boarded.current = [];
  }
  const forward = dir.current.forward;
  useEffect(() => {
    setLoaded([]);
  }, [moveCount, resetCount]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 1600);
    return () => clearTimeout(t);
  }, [notice]);

  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const fault = status.kind === 'lost' ? trouble(state) : null;

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS - 300);
    return () => clearTimeout(t);
  }, [won]);

  const flying = busy && forward;
  const animKey = `${moveCount}|${resetCount}|${loaded.join(',')}`;
  // If the riders weren't already in the basket (redo), give them a moment to hop in before take-off.
  const riders = forward && lastMove ? lastMove.riders : [];
  const boardMs = riders.length && !riders.every((b) => boarded.current.includes(b)) ? BOARD_MS : 0;

  // ---- Balloon ----
  const balloon = useRef<THREE.Group>(null);
  const balloonSegs: PathSegment[] = forward
    ? [{ to: balloonPos(state.balloon), durationMs: FLY_MS - boardMs, delayMs: boardMs, height: FLY_HEIGHT, onStart: sfx.splash, onEnd: sfx.click }]
    : [{ to: balloonPos(state.balloon), durationMs: 450, height: 0.3 }];
  usePath(balloon, balloonSegs, `${moveCount}|${resetCount}`, { face: false });

  const toggle = (b: Bird) => {
    if (busy || over) return;
    // The last crossing has finished. Stop treating its riders as riding, or the new selection would
    // replay their ride and put them back in the boat (one tap looked like two animals boarding).
    dir.current.forward = false;
    if (state.at[b] !== state.balloon) {
      sfx.denied();
      setNotice('The balloon is on the other island');
      return;
    }
    if (loaded.includes(b)) {
      sfx.deselect();
      setLoaded(loaded.filter((x) => x !== b));
    } else if (loaded.length >= 2) {
      sfx.denied();
      setNotice('Only two fit in the basket!');
    } else {
      sfx.hop();
      setLoaded([...loaded, b]);
    }
  };
  const fly = () => {
    if (busy || over) return;
    if (loaded.length === 0) {
      sfx.denied();
      setNotice('Someone has to fly it!');
      return;
    }
    boarded.current = loaded;
    // Clear the selection in the same render as the move, so the riders' flight isn't restarted.
    setLoaded([]);
    play({ riders: loaded });
  };

  const hinted = hint ? hint.riders.filter((b) => !loaded.includes(b)) : [];
  const hintBalloon = hint && hinted.length === 0 && loaded.length === hint.riders.length;

  const label = loaded.length ? loaded.map(nameOf).join(' + ') : 'tap birds to board';

  return (
    <group>
      <SkyIslands />

      <group ref={balloon}>
        <Clickable onClick={fly} disabled={busy || over} hoverScale={1.03}>
          <group scale={BALLOON_SCALE}>
            <Balloon burning={flying || (won && !busy)} />
          </group>
          {/* big invisible tap target around the basket */}
          <mesh position-y={0.5} visible={false}>
            <sphereGeometry args={[0.8, 8, 8]} />
          </mesh>
        </Clickable>
        {notice && <Bubble position={[0, 5.2, 0]} tone="white">{notice}</Bubble>}
        {hintBalloon && !busy && <HintRing position={[0, 0.05, 0]} radius={0.95} />}
      </group>

      {!busy && !over && (
        <Html position={[0, -1.1, 1.6]} center zIndexRange={[5, 0]}>
          <button
            onClick={fly}
            style={{
              fontFamily: 'Fredoka, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 17,
              padding: '8px 16px',
              borderRadius: 999,
              border: '2px solid rgba(255,255,255,.85)',
              background: loaded.length ? 'linear-gradient(#ffe08a,#f4b03e)' : 'linear-gradient(#ffffff,#e0e7ff)',
              color: '#1f2937',
              boxShadow: '0 4px 0 rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.25)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {state.balloon === 'L' ? 'Fly over ➜' : '⬅ Fly back'}
            <span style={{ opacity: 0.7, fontSize: 13, marginLeft: 6 }}>{label}</span>
          </button>
        </Html>
      )}

      {BIRDS.map((b, i) => (
        <BirdActor
          key={b}
          bird={b}
          seed={i}
          state={state}
          previous={previous}
          lastMove={lastMove}
          forward={forward}
          boardMs={boardMs}
          seatIndex={loaded.indexOf(b)}
          animKey={animKey}
          fault={fault}
          won={won}
          busy={busy}
          disabled={busy || over}
          onClick={() => toggle(b)}
        />
      ))}

      {!busy &&
        hinted.map((b) => {
          const p = slot(b, state.at[b]);
          return <HintRing key={b} position={[p[0], 0.04, p[2]]} radius={0.5} />;
        })}
      <Burst trigger={burst} position={[ISLAND_X - 1.2, 1.4, 0.3]} />
    </group>
  );
}

interface ActorProps {
  bird: Bird;
  seed: number;
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  /** Time riders spend hopping into the basket before take-off (0 when already aboard). */
  boardMs: number;
  /** Index in the basket if the player loaded this bird, else -1. */
  seatIndex: number;
  animKey: string;
  fault: ReturnType<typeof trouble>;
  won: boolean;
  busy: boolean;
  disabled: boolean;
  onClick(): void;
}

function BirdActor({ bird, seed, state, previous, lastMove, forward, boardMs, seatIndex, animKey, fault, won, busy, disabled, onClick }: ActorProps) {
  const ref = useRef<THREE.Group>(null);
  const side = state.at[bird];
  const rideIndex = forward && previous && lastMove ? lastMove.riders.indexOf(bird) : -1;
  const rode = rideIndex >= 0;
  const loaded = seatIndex >= 0;

  // Who is in the drama on a loss: the lady, the other gent, and her jealous gent.
  const isLady = fault?.lady === bird;
  const isRival = fault?.rival === bird;
  const isJealous = fault ? gent(coupleOf(fault.lady)) === bird : false;
  const react = !busy;

  const segs = useMemo<PathSegment[]>(() => {
    const home = slot(bird, side);
    let out: PathSegment[];
    if (rode) {
      const from = previous!.balloon;
      out = [
        ...(boardMs ? [{ to: seat(from, rideIndex), durationMs: boardMs, height: 0.8 }] : []),
        { to: seat(state.balloon, rideIndex), durationMs: FLY_MS - boardMs, height: FLY_HEIGHT },
        { to: home, durationMs: HOP_MS, height: 0.9, delayMs: rideIndex * 180, onStart: sfx.hop },
      ];
    } else if (loaded) {
      out = [{ to: seat(state.balloon, seatIndex), durationMs: 480, height: 0.9 }];
    } else {
      out = [{ to: home, durationMs: forward ? 480 : 380, height: forward ? 0.7 : 0.4 }];
    }
    if (isJealous && fault) {
      // Storm toward the lady: across the island if she is here, else to the end of the dock.
      const ladyPos = slot(fault.lady, state.at[fault.lady]);
      const target: Vec3 =
        fault.where !== 'basket' && fault.where === side
          ? [(ladyPos[0] * 2 + home[0]) / 3, 0, (ladyPos[2] * 2 + home[2]) / 3 + 0.3]
          : [sign(side) * 2.75, 0, 0.7];
      const wait = forward && !rode ? FLY_MS + 250 : 120;
      out = [...out, { to: target, durationMs: 480, height: 0.9, delayMs: wait, onStart: sfx.growl }];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, fault?.lady]);

  usePath(ref, segs, `${animKey}|${fault?.lady ?? ''}`, { face: false });

  const facing = useRef<THREE.Group>(null);
  const inBasket = loaded || (rode && busy);
  useFaceYaw(facing, inBasket ? 0 : islandYaw(side), 5);

  const mood: Mood = !react ? 'idle' : won ? 'happy' : isJealous ? 'angry' : isLady ? 'scared' : 'idle';

  return (
    <group ref={ref}>
      <group ref={facing}>
        <Clickable onClick={onClick} disabled={disabled}>
          <group scale={BIRD_SCALE}>
            <BirdModel couple={coupleOf(bird)} role={roleOf(bird)} mood={mood} seed={seed} act={react && isRival ? 'whistle' : react && isLady ? 'fluster' : undefined} />
          </group>
          {/* bigger invisible hit area, easier to tap on phones */}
          <mesh position-y={0.5} visible={false}>
            <sphereGeometry args={[0.55, 8, 8]} />
          </mesh>
        </Clickable>
      </group>
      {react && isJealous && (
        <>
          <group position={[0, 1.75, 0]} scale={1.7}>
            <StormCloud position={[0, 0, 0]} />
          </group>
          <Steam position={[0, 1.0, 0]} />
          <FeatherPuff color={COUPLE_COLORS[coupleOf(bird)].body} />
          <Bubble position={[0, 2.55, 0]} tone="red">HEY!!</Bubble>
        </>
      )}
      {react && isLady && <Bubble position={[0, 1.4, 0]} tone="gold">Oh my!</Bubble>}
      {react && isRival && (
        <group rotation-y={0.9}>
          <group position={[0, 0.55, 0.35]} scale={1.5}>
            <MusicNotes position={[0, 0, 0]} />
          </group>
          <SweatDrop position={[-0.24, 0.78, 0.12]} />
        </group>
      )}
      {react && won && roleOf(bird) === 'lady' && <Bubble position={[0, 1.4, 0]} tone="red">♥</Bubble>}
      {loaded && <HintRing position={[0, 0.06, 0]} radius={0.38} color="#7ee0b0" />}
    </group>
  );
}
