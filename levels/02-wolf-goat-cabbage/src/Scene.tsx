import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, ComicWord, DizzyStars, FightCloud, FocusCam, Shake, sfx, usePath, usePhases, useFaceYaw, type PathSegment, type Vec3 } from '@riddle/fx';
import { Boat, Bubble, Farmer, HintRing, RiverValley, Wolf, groundHeight, toon, type Mood } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { Barn, Butterflies, Cabbage, GardenBed, Goat, HayBale } from './models';
import { ITEMS, trouble, type Item, type Move, type Side, type State, type Trouble } from './rules';

const CROSS_MS = 1900;
/** Pause after docking before the passenger steps out. */
const DOCK_MS = 250;
const HOP_MS = 520;
export const MOVE_MS = CROSS_MS + DOCK_MS + HOP_MS;
const LUNGE_MS = 450;

/**
 * The fail gag, in three beats once the move has finished:
 * windup (the eater eyes its prey, the camera zooms in), action (a fight cloud, or three big bites),
 * after (the dust settles: a beardless dizzy goat and a wolf wearing its beard, or a stuffed goat
 * and a tiny dizzy cabbage). Silly and harmless, then the "Oh no!" screen.
 */
type FailPhase = 'windup' | 'action' | 'after';
const WINDUP_MS = 700;
const ACTION_MS = 1500;
const FAIL_PHASES: [FailPhase, number][] = [
  ['windup', WINDUP_MS],
  ['action', ACTION_MS],
  ['after', 60000],
];
/** Wait for the gag (plus time to enjoy the aftermath) before the "Oh no!" screen. */
export const FAIL_MS = WINDUP_MS + ACTION_MS + 1700;
/** When each bite lands, into the goat's action beat. */
const BITES_MS = [380, 780, 1180];

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

/** How far the eater lunges toward its prey (1 = all the way). */
const LUNGE_K = { wolf: 0.8, goat: 0.62 };

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

  const phase = usePhases<FailPhase>(danger != null && !busy, FAIL_PHASES);
  const [bites, setBites] = useState(0);
  const [bits, setBits] = useState(0);
  const [shake, setShake] = useState(0);
  const eater = danger?.eater;

  // Sounds and effects for each beat of the fail gag.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    if (phase == null) setBites(0);
    if (phase === 'windup') (eater === 'wolf' ? sfx.growl : sfx.squeak)();
    if (phase === 'action' && eater === 'wolf') {
      sfx.boing();
      setShake((n) => n + 1);
      at(250, () => {
        sfx.poof();
        sfx.scuffle();
        setBits((n) => n + 1);
      });
      at(1250, () => {
        sfx.chomp();
        setShake((n) => n + 1);
      });
    }
    if (phase === 'action' && eater === 'goat') {
      sfx.boing();
      BITES_MS.forEach((ms, i) =>
        at(ms, () => {
          sfx.chomp();
          setBites(i + 1);
          setBits((n) => n + 1);
          if (i === 2) setShake((n) => n + 1);
        }),
      );
    }
    if (phase === 'after') {
      sfx.poof();
      at(450, sfx.burp);
      at(950, sfx.squeak);
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, eater]);

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
    <Shake trigger={shake} intensity={0.14} durationMs={420}>
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
          boat={boat}
          phase={phase}
          bites={bites}
          onClick={() => toggle(a)}
        />
      ))}
      {danger && <FailGag danger={danger} phase={phase} bits={bits} />}

      {hintTarget && !busy && <HintRing position={[hintTarget[0], hintTarget[1] + 0.03, hintTarget[2]]} radius={hintOnItem ? 0.6 : 1.4} />}
      <Burst trigger={burst} position={[4.4, 1.2, 0.5]} />
    </Shake>
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
  boat: RefObject<THREE.Group | null>;
  phase: FailPhase | null;
  bites: number;
  onClick(): void;
}

/** Where the eater ends its lunge, and the middle of the action. */
function gagSpots(danger: Trouble) {
  const prey = slot(danger.eater === 'wolf' ? 'goat' : 'cabbage', danger.bank);
  const eaterAt = lungeAt(slot(danger.eater, danger.bank), prey, LUNGE_K[danger.eater]);
  const mid: Vec3 = [(prey[0] + eaterAt[0]) / 2, (prey[1] + eaterAt[1]) / 2, (prey[2] + eaterAt[2]) / 2];
  // Where the wolf tumbles out of the cloud: beside the goat, so both are easy to see.
  const ox = prey[0] + sign(danger.bank) * 1.05;
  const wolfAfter: Vec3 = [ox, groundHeight(ox, prey[2] + 0.2), prey[2] + 0.2];
  return { prey, eaterAt, mid, wolfAfter };
}

/** The scene-wide part of a fail gag: camera zoom, fight cloud, comic words and flying bits. */
function FailGag({ danger, phase, bits }: { danger: Trouble; phase: FailPhase | null; bits: number }) {
  const { prey, mid } = gagSpots(danger);
  const focus: Vec3 = [mid[0], mid[1] + 0.5, mid[2]];
  if (danger.eater === 'wolf') {
    return (
      <group>
        <FocusCam target={focus} active={phase != null} closer={0.5} />
        <FightCloud position={mid} active={phase === 'action'} scale={1.15} limbColors={['#6f7480', '#efe6d6', '#3a3d45', '#b07a4f']} />
        {/* tufts of goat fluff */}
        <Burst trigger={bits} position={[mid[0], mid[1] + 0.8, mid[2]]} count={90} colors={['#ffffff', '#efe6d6', '#b07a4f']} power={0.55} size={1.6} />
        {phase === 'action' && <ComicWord position={[mid[0], mid[1] + 1.8, mid[2]]} text="BONK!" size={42} />}
        {phase === 'after' && <ComicWord position={[mid[0], mid[1] + 1.75, mid[2]]} text="Oops!" color="#ff8fab" size={38} tilt={6} />}
      </group>
    );
  }
  return (
    <group>
      <FocusCam target={focus} active={phase != null} closer={0.5} />
      {/* cabbage leaves flying with every bite */}
      <Burst trigger={bits} position={[prey[0], prey[1] + 0.35, prey[2]]} count={45} colors={['#5fb84a', '#a6dd6c', '#d8f2a8']} power={0.45} size={1.5} />
      {phase === 'action' && <ComicWord position={[mid[0], mid[1] + 1.6, mid[2]]} text="MUNCH!" color="#a6e86c" />}
      {phase === 'after' && <ComicWord position={[mid[0], mid[1] + 1.8, mid[2]]} text="BURP!" color="#ffd23f" size={40} tilt={7} />}
    </group>
  );
}

function Actor({ kind, seed, state, previous, lastMove, forward, loaded, animKey, danger, won, disabled, busy, boat, phase, bites, onClick }: ActorProps) {
  const ref = useRef<THREE.Group>(null);
  const side = state[kind];
  const rode = forward && lastMove?.passenger === kind && previous != null;

  // Who is in the gag on a loss: the eater (wolf or goat) and its target (goat or cabbage).
  const eater = danger?.eater === kind;
  const victim = danger != null && ((danger.eater === 'wolf' && kind === 'goat') || (danger.eater === 'goat' && kind === 'cabbage'));
  const dangerKey = danger ? `${danger.bank}${danger.eater}` : '-';
  // The eater lunges at the start of the action beat; the wolf tumbles out beside the goat after.
  const stage = !eater || (phase !== 'action' && phase !== 'after') ? 0 : phase === 'after' && kind === 'wolf' ? 2 : 1;
  const lunged = stage > 0;

  const segs = useMemo<PathSegment[]>(() => {
    if (rode && previous) {
      const from = previous[kind];
      return [
        // Sit in the boat for the whole crossing, then step out once it has docked.
        { to: seat(state.farmer, from), follow: boat, offset: [sign(from) * 0.72, 0.05, 0], durationMs: CROSS_MS + DOCK_MS },
        { to: slot(kind, side), durationMs: HOP_MS, height: kind === 'cabbage' ? 0.6 : 0.9, onStart: sfx.hop },
      ];
    }
    if (loaded) return [{ to: seat(state.farmer, state.farmer), durationMs: 480, height: 0.9 }];
    const home: Vec3 = slot(kind, side);
    if (stage === 2 && danger) return [{ to: gagSpots(danger).wolfAfter, durationMs: 260, height: 0.4 }];
    if (stage === 1 && danger) return [{ to: gagSpots(danger).eaterAt, durationMs: LUNGE_MS, height: kind === 'wolf' ? 1.3 : 0.6 }];
    // Already home when a loss shows up: stay put (no hop) until the gag starts.
    if (eater) return [{ to: home, durationMs: 10 }];
    return [{ to: home, durationMs: 480, height: 0.7 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, dangerKey, stage]);

  usePath(ref, segs, `${animKey}|${dangerKey}|${stage}`, { face: true });

  // Face the river when standing on a bank; the eater turns toward its prey.
  const facing = useRef<THREE.Group>(null);
  let yaw = loaded ? (state.farmer === 'L' ? Math.PI / 2 : -Math.PI / 2) : side === 'L' ? Math.PI / 2 : -Math.PI / 2;
  if (eater && danger && phase != null) {
    const me = stage === 2 ? gagSpots(danger).wolfAfter : lunged ? gagSpots(danger).eaterAt : slot(kind, side);
    const prey = slot(danger.eater === 'wolf' ? 'goat' : 'cabbage', danger.bank);
    yaw = Math.atan2(prey[0] - me[0], prey[2] - me[2]);
  }
  useFaceYaw(facing, yaw, 5);

  // The wolf and goat vanish into the fight cloud; the cabbage shrinks with every bite.
  const sizeRef = useRef<THREE.Group>(null);
  let size = 1;
  if (danger?.eater === 'wolf' && (eater || victim) && phase === 'action') size = 0;
  if (kind === 'cabbage' && victim) size = 1 - bites * 0.2;
  useFrame((_, dt) => {
    const g = sizeRef.current;
    if (!g) return;
    const s = THREE.MathUtils.damp(g.scale.x, size, size === 0 ? 18 : 12, dt);
    g.scale.setScalar(s < 0.02 && size === 0 ? 0 : s);
  });

  const after = phase === 'after';
  const mood: Mood = won && !busy ? 'happy' : eater && after ? 'happy' : eater && phase ? 'angry' : victim && phase && !after ? 'scared' : 'idle';
  // In the aftermath the goat's beard has ended up on the wolf.
  const beardSwap = danger?.eater === 'wolf' && after;

  return (
    <group ref={ref}>
      <group ref={facing}>
        <group ref={sizeRef}>
          <Clickable onClick={onClick} disabled={disabled}>
            {kind === 'wolf' && (
              <Wolf mood={mood} seed={seed} scale={1.15}>
                {beardSwap && (
                  <mesh position={[0, 0.58, 0.55]} rotation-x={Math.PI + 0.3} material={toon('#b07a4f')} castShadow>
                    <coneGeometry args={[0.05, 0.18, 5]} />
                  </mesh>
                )}
              </Wolf>
            )}
            {kind === 'goat' && (
              <Goat
                mood={mood}
                seed={seed}
                scale={1.1}
                chewing={eater && phase === 'action'}
                full={eater && after}
                leaf={eater && after}
                beard={!(victim && beardSwap)}
              />
            )}
            {kind === 'cabbage' && <Cabbage mood={mood} seed={seed} scale={1.15} />}
            {/* bigger invisible hit area, easier to tap on phones */}
            <mesh position-y={0.5} visible={false}>
              <sphereGeometry args={[0.6, 8, 8]} />
            </mesh>
          </Clickable>
        </group>
      </group>
      {phase === 'windup' && victim && kind === 'goat' && <Bubble position={[0, 1.5, 0]} tone="red">Meeeh!</Bubble>}
      {phase === 'windup' && victim && kind === 'cabbage' && <Bubble position={[0, 1.1, 0]} tone="red">Eek!</Bubble>}
      {phase === 'windup' && eater && kind === 'wolf' && <Bubble position={[0, 1.6, 0]} tone="white">GRRR!</Bubble>}
      {phase === 'windup' && eater && kind === 'goat' && <Bubble position={[0, 1.6, 0]} tone="gold">Lunch!</Bubble>}
      {after && victim && <DizzyStars position={[0, kind === 'goat' ? 1.15 : 0.55, 0]} radius={kind === 'goat' ? 0.3 : 0.2} />}
      {loaded && <HintRing position={[0, 0.06, 0]} radius={0.45} color="#7ee0b0" />}
    </group>
  );
}
