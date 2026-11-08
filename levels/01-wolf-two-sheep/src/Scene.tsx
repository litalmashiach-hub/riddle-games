import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, ComicWord, DizzyStars, FightCloud, FocusCam, Shake, sfx, usePath, usePhases, useFaceYaw, type PathSegment, type Vec3 } from '@riddle/fx';
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

/**
 * The fail scene, after the boat lands: the wolf growls (windup), leaps into a cartoon scuffle
 * (fight), then the cloud clears: the sheep is shorn and blushing, the wolf has a wool beard (after).
 */
export type FailPhase = 'windup' | 'fight' | 'after';
const FAIL_PHASES: [FailPhase, number][] = [
  ['windup', 800],
  ['fight', 1600],
  ['after', 60_000],
];
/** How long to wait before the "Oh no!" screen, so the whole gag plays. */
export const FAIL_MS = 800 + 1600 + 1500;

const loneSheep = (state: State, bank: Side): Animal => (['sheepA', 'sheepB'] as Animal[]).find((a) => state[a] === bank)!;
/** Where the scuffle happens: between the wolf and the lone sheep. */
const fightSpot = (state: State, bank: Side): Vec3 => {
  const w = slot('wolf', bank), sh = slot(loneSheep(state, bank), bank);
  return [(w[0] + sh[0] * 2) / 3, (w[1] + sh[1] * 2) / 3, (w[2] + sh[2] * 2) / 3];
};

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The animal the player has put in the boat but not rowed yet (UI only, not a move). */
  const [loaded, setLoaded] = useState<Animal | null>(null);
  const [burst, setBurst] = useState(0);
  // Work out the move direction during render (not in an effect), so the render that shows a new
  // move sees forward = true and the passenger rides the boat. An effect would flip it back to false
  // one render later and restart the ride as a plain hop.
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    dir.current = { count: moveCount, reset: resetCount, forward: resetCount === dir.current.reset && moveCount > dir.current.count };
    // Undo or restart from the shell: drop any half-loaded animal.
    if (loaded) setLoaded(null);
  }
  const forward = dir.current.forward;

  const over = status.kind !== 'playing';
  const danger = status.kind === 'lost' ? dangerBank(state) : null;
  const won = status.kind === 'won';
  const fail = usePhases<FailPhase>(danger != null && !busy, FAIL_PHASES);
  const spot = danger ? fightSpot(state, danger) : null;
  const [woolBurst, setWoolBurst] = useState(0);
  const [shake, setShake] = useState(0);

  // Sound and effects for each beat of the fail scene.
  useEffect(() => {
    if (fail === 'windup') sfx.growl();
    if (fail === 'fight') {
      sfx.boing();
      setShake((n) => n + 1);
      const t1 = setTimeout(() => {
        sfx.poof();
        sfx.scuffle();
        setWoolBurst((n) => n + 1);
      }, 250);
      const t2 = setTimeout(() => {
        sfx.chomp();
        setShake((n) => n + 1);
      }, 1250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (fail === 'after') {
      sfx.poof();
      const t = setTimeout(sfx.burp, 450);
      const t2 = setTimeout(sfx.squeak, 900);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
  }, [fail]);

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
    // The last crossing has finished. Stop treating its riders as riding, or the new selection would
    // replay their ride and put them back in the boat (one tap looked like two animals boarding).
    dir.current.forward = false;
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
    // Clear the selection in the same update as the move, so the ride animation starts only once.
    setLoaded(null);
    play({ passenger: loaded });
  };

  const hintTarget: Vec3 | null = hint
    ? hint.passenger && hint.passenger !== loaded
      ? slot(hint.passenger, state.farmer)
      : [boatX(state.farmer), 0.25, 0]
    : null;

  return (
    <Shake trigger={shake} intensity={0.16} durationMs={450}>
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
          fail={fail}
          won={won}
          disabled={busy || over}
          busy={busy}
          boat={boat}
          onClick={() => toggle(a)}
        />
      ))}

      {hintTarget && !busy && <HintRing position={[hintTarget[0], hintTarget[1] + 0.03, hintTarget[2]]} radius={hint?.passenger && hint.passenger !== loaded ? 0.6 : 1.4} />}
      <Burst trigger={burst} position={[4.3, 1.2, 0.6]} />

      {/* Fail scene */}
      {spot && (
        <>
          <FocusCam target={[spot[0], spot[1] + 0.5, spot[2]]} active={fail != null} closer={0.5} />
          <FightCloud position={spot} active={fail === 'fight'} scale={1.15} limbColors={['#6f7480', '#3b2f2b', '#f6f1e6', '#3a3d45']} />
          <Burst trigger={woolBurst} position={[spot[0], spot[1] + 0.8, spot[2]]} count={90} colors={['#ffffff', '#f6f1e6', '#efe6d2']} power={0.55} size={1.6} />
          {fail === 'fight' && <ComicWord position={[spot[0], spot[1] + 2.0, spot[2]]} text="CHOMP!" />}
          {fail === 'after' && <ComicWord position={[spot[0], spot[1] + 2.7, spot[2]]} text="Oops!" color="#ff8fab" size={38} tilt={6} />}
        </>
      )}
    </Shake>
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
  fail: FailPhase | null;
  won: boolean;
  disabled: boolean;
  busy: boolean;
  boat: RefObject<THREE.Group | null>;
  onClick(): void;
}

function AnimalActor({ kind, seed, state, previous, lastMove, forward, loaded, animKey, danger, fail, won, disabled, busy, boat, onClick }: ActorProps) {
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
    // Fail scene: the wolf leaps at the sheep, and after the scuffle both end up beside the cloud.
    if (danger && (fail === 'fight' || fail === 'after') && (pouncing || lonelySheep)) {
      const spot = fightSpot(state, danger);
      const dx = home.to[0] - spot[0], dz = home.to[2] - spot[2];
      const len = Math.hypot(dx, dz) || 1;
      const out = pouncing ? 0.55 : 0.6;
      const beside: Vec3 = [spot[0] + (dx / len) * out, spot[1], spot[2] + (dz / len) * out];
      return fail === 'fight' ? [{ to: spot, durationMs: 300, height: pouncing ? 1.4 : 0.4 }] : [{ to: beside, durationMs: 380, height: 0.6 }];
    }
    return [home];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, danger, fail]);

  usePath(ref, segs, `${animKey}|${danger}|${fail}`, { face: true });

  // Face the river when standing on a bank.
  const facing = useRef<THREE.Group>(null);
  let yaw = loaded ? (state.farmer === 'L' ? Math.PI / 2 : -Math.PI / 2) : side === 'L' ? Math.PI / 2 : -Math.PI / 2;
  if (fail && danger && (pouncing || lonelySheep)) {
    // Face each other during the fail scene (the wolf stares at the sheep, the sheep at the wolf).
    const me = slot(kind, danger);
    const them = pouncing ? slot(loneSheep(state, danger), danger) : slot('wolf', danger);
    yaw = Math.atan2(them[0] - me[0], them[2] - me[2]);
    if (fail === 'after' && pouncing) yaw += Math.PI * 0.6; // smug, looking at the camera-ish
  }
  useFaceYaw(facing, yaw, 6);

  const inFight = fail === 'fight' && (pouncing || lonelySheep);
  const after = fail === 'after';
  const mood: Mood = !react
    ? 'idle'
    : won
      ? 'happy'
      : lonelySheep
        ? 'scared'
        : pouncing
          ? after
            ? 'happy'
            : 'angry'
          : 'idle';

  return (
    <group ref={ref}>
      <group ref={facing} visible={!inFight}>
        <Clickable onClick={onClick} disabled={disabled}>
          {isWolf ? (
            <Wolf mood={mood} seed={seed} scale={1.15} woolBeard={!!pouncing && after} />
          ) : (
            <Sheep mood={mood} seed={seed} scale={1.05} shorn={!!lonelySheep && after} />
          )}
          {/* bigger invisible hit area, easier to tap on phones */}
          <mesh position-y={0.5} visible={false}>
            <sphereGeometry args={[0.6, 8, 8]} />
          </mesh>
        </Clickable>
      </group>
      {fail === 'windup' && lonelySheep && <Bubble position={[0, 1.3, 0]} tone="red">!</Bubble>}
      {fail === 'windup' && pouncing && <Bubble position={[0, 1.5, 0]} tone="white">GRRR!</Bubble>}
      {after && pouncing && <Bubble position={[0, 1.55, 0]} tone="gold">*burp*</Bubble>}
      {after && lonelySheep && <DizzyStars position={[0, 1.0, 0]} radius={0.28} />}
      {loaded && <HintRing position={[0, 0.06, 0]} radius={0.45} color="#7ee0b0" />}
    </group>
  );
}
