import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, sfx, usePath, useFaceYaw, useSettings, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing } from '@riddle/props';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Barge } from './Barge';
import type { BioWaterHandle } from './BioWater';
import { Cavern } from './Cavern';
import { Explorer, Guardian, type ExplorerMood, type GuardianMood } from './characters';
import { boatX, seat, sign, slot } from './layout';
import { BOAT_SEATS, EVERYONE, EXPLORERS, GUARDIANS, dangerBank, isExplorer, type Move, type Side, type State, type Who } from './rules';

const CROSS_MS = 2000;
const HOP_MS = 520;
export const MOVE_MS = CROSS_MS + HOP_MS;
const LOAD_MS = 450;

function groupLabel(riders: Who[]) {
  const e = riders.filter(isExplorer).length;
  const g = riders.length - e;
  const parts = [e ? `${e} explorer${e > 1 ? 's' : ''}` : '', g ? `${g} guardian${g > 1 ? 's' : ''}` : ''].filter(Boolean);
  return parts.length ? parts.join(' + ') : 'empty';
}

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const low = useSettings((s) => s.quality) === 'low';
  /** Who the player has seated in the barge but not sent yet (UI only, not a move). */
  const [loaded, setLoaded] = useState<Who[]>([]);
  const [tip, setTip] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  // Direction of the last change, derived in render (not in an effect) so it stays stable
  // across the re-render that clears the selection: a ride must never restart as a hop home.
  const seen = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (seen.current.count !== moveCount || seen.current.reset !== resetCount) {
    seen.current = { count: moveCount, reset: resetCount, forward: moveCount > seen.current.count && resetCount === seen.current.reset };
  }
  const forward = seen.current.forward;
  useEffect(() => {
    setLoaded([]);
    setTip(null);
  }, [moveCount, resetCount]);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 1600);
    return () => clearTimeout(t);
  }, [tip]);

  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const danger = status.kind === 'lost' ? dangerBank(state) : null;
  const settled = !busy;

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  // ---- Barge ----
  const barge = useRef<THREE.Group>(null);
  const sailing = busy && forward;
  usePath(
    barge,
    forward
      ? [{ to: [boatX(state.boat), 0, 0], durationMs: CROSS_MS, height: 0, onStart: sfx.select, onEnd: sfx.splash }]
      : [{ to: [boatX(state.boat), 0, 0], durationMs: 400, height: 0 }],
    `${moveCount}|${resetCount}`,
    { face: false },
  );

  // On tall phone screens, pull the camera back further than the shell does so both banks fit.
  const size = useThree((st) => st.size);
  useFrame(({ camera }) => {
    const aspect = size.width / size.height;
    if (aspect >= 1) return;
    const zoom = Math.max(0.34, aspect * 0.68);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.zoom - zoom) > 1e-3) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
  });

  // Feed the barge position and the mood of the level to the water shader.
  const water = useRef<BioWaterHandle>(null);
  const lastX = useRef(0);
  useFrame((_, dt) => {
    const b = barge.current;
    const w = water.current;
    if (!b || !w) return;
    const speed = Math.abs(b.position.x - lastX.current) / Math.max(dt, 1e-3);
    lastX.current = b.position.x;
    w.boat.set(b.position.x, b.position.z);
    w.wake = Math.min(1, speed / 1.6);
    w.joy = won && settled ? 1 : 0;
    w.dangerSide = danger && settled ? sign(danger) : 0;
  });

  const toggle = (w: Who) => {
    if (busy || over) return;
    if (state[w] !== state.boat) {
      sfx.denied();
      setTip('The barge is on the other side');
      return;
    }
    if (loaded.includes(w)) {
      sfx.deselect();
      setLoaded(loaded.filter((x) => x !== w));
    } else if (loaded.length >= BOAT_SEATS) {
      sfx.denied();
      setTip('The barge only holds two');
    } else {
      sfx.hop();
      setLoaded([...loaded, w]);
    }
  };
  const sail = () => {
    if (busy || over) return;
    if (loaded.length === 0) {
      sfx.denied();
      setTip('Someone has to ride the barge');
      return;
    }
    play({ riders: loaded });
    setLoaded([]);
  };

  // Hint: ring whoever still needs to board (any explorer/guardian of the right kind will do),
  // or the barge once the right group is aboard.
  const hintRings = useMemo(() => {
    if (!hint || busy) return [] as { pos: Vec3; r: number }[];
    const needE = hint.riders.filter(isExplorer).length;
    const needG = hint.riders.length - needE;
    const haveE = loaded.filter(isExplorer).length;
    const haveG = loaded.length - haveE;
    if (haveE === needE && haveG === needG) return [{ pos: [boatX(state.boat), 0.06, 0] as Vec3, r: 1.5 }];
    const pick = (pool: Who[], n: number) => pool.filter((w) => state[w] === state.boat && !loaded.includes(w)).slice(0, Math.max(0, n));
    return [...pick(EXPLORERS, needE - haveE), ...pick(GUARDIANS, needG - haveG)].map((w) => {
      const p = slot(w, state.boat);
      return { pos: [p[0], p[1] + 0.04, p[2]] as Vec3, r: 0.55 };
    });
  }, [hint, busy, loaded, state]);

  // Explorers on the danger bank, so each angry guardian knows whom to stomp toward.
  const victims = danger ? EXPLORERS.filter((e) => state[e] === danger) : [];
  const firstAngry = danger ? GUARDIANS.find((g) => state[g] === danger) : undefined;

  return (
    <group>
      <Cavern ref={water} low={low} won={won && settled} danger={danger && settled ? (sign(danger) as -1 | 1) : 0} />

      <group ref={barge}>
        <Clickable onClick={sail} disabled={busy || over} hoverScale={1.03}>
          <Barge sailing={sailing} />
          <mesh position-y={0.3} visible={false}>
            <boxGeometry args={[2.4, 0.7, 1.2]} />
          </mesh>
        </Clickable>
        {!busy && !over && (
          <Html position={[0, 1.75, 0]} center zIndexRange={[5, 0]}>
            <button
              onClick={sail}
              style={{
                fontFamily: 'Fredoka, system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 17,
                padding: '8px 16px',
                borderRadius: 999,
                border: '2px solid rgba(255,255,255,.8)',
                background: loaded.length ? 'linear-gradient(#a7f3d0,#34d399)' : 'linear-gradient(#ffffff,#e5e7eb)',
                color: '#1f2937',
                boxShadow: '0 4px 0 rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.3)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                opacity: loaded.length ? 1 : 0.85,
              }}
            >
              {state.boat === 'L' ? 'Sail across ➜' : '⬅ Sail back'}
              <span style={{ opacity: 0.7, fontSize: 13, marginLeft: 6 }}>{groupLabel(loaded)}</span>
            </button>
          </Html>
        )}
        {tip && !busy && <Bubble position={[0, 2.45, 0]} tone="gold">{tip}</Bubble>}
      </group>

      {EVERYONE.map((w, i) => (
        <Actor
          key={w}
          who={w}
          seed={i}
          state={state}
          previous={previous}
          lastMove={lastMove}
          forward={forward}
          seatIndex={loaded.indexOf(w)}
          moveCount={moveCount}
          resetCount={resetCount}
          danger={danger}
          victim={victims.length ? victims[GUARDIANS.indexOf(w as never) % victims.length] : undefined}
          shout={w === firstAngry}
          herald={w === 'g1'}
          won={won}
          settled={settled}
          disabled={busy || over}
          onClick={() => toggle(w)}
        />
      ))}

      {hintRings.map((h, i) => (
        <HintRing key={i} position={h.pos} radius={h.r} />
      ))}
      <Burst trigger={burst} position={[5, 1.4, 0]} />
    </group>
  );
}

interface ActorProps {
  who: Who;
  seed: number;
  state: State;
  previous: State | null;
  lastMove: Move | null;
  forward: boolean;
  seatIndex: number;
  moveCount: number;
  resetCount: number;
  danger: Side | null;
  /** For an angry guardian: the explorer it stomps toward. */
  victim?: Who;
  /** This guardian speaks for the others when the rule is broken. */
  shout: boolean;
  /** This guardian congratulates the player on a win. */
  herald: boolean;
  won: boolean;
  settled: boolean;
  disabled: boolean;
  onClick(): void;
}

function Actor(p: ActorProps) {
  const { who, state, previous, lastMove, forward, seatIndex, danger, won, settled } = p;
  const ref = useRef<THREE.Group>(null);
  const explorer = isExplorer(who);
  const side = state[who];
  // Riding only while the crossing plays; afterwards the rider is simply home (no replay).
  const rideIndex = forward && !settled && previous && lastMove ? lastMove.riders.indexOf(who) : -1;
  const rode = rideIndex >= 0;
  const onDangerBank = danger != null && side === danger;
  const angry = !explorer && onDangerBank;
  const mode = rode ? 'ride' : seatIndex >= 0 ? `seat${seatIndex}` : 'home';
  const key = `${p.moveCount}|${p.resetCount}|${mode}|${danger}`;

  const segs = useMemo<PathSegment[]>(() => {
    const home = slot(who, side);
    let out: PathSegment[];
    let waited = 0;
    if (rode && previous) {
      out = [
        { to: seat(state.boat, previous[who], rideIndex), durationMs: CROSS_MS, height: 0 },
        { to: home, durationMs: HOP_MS, height: 0.8, onStart: sfx.hop },
      ];
      waited = MOVE_MS;
    } else if (seatIndex >= 0) {
      out = [{ to: seat(state.boat, state.boat, seatIndex), durationMs: LOAD_MS, height: 0.8 }];
    } else {
      // Only hop if actually going somewhere (no hopping on the spot when others move).
      const cur = ref.current?.position;
      const far = cur ? cur.distanceTo(new THREE.Vector3(...home)) > 0.05 : false;
      out = [{ to: home, durationMs: far ? 480 : 1, height: far ? 0.7 : 0 }];
      waited = far ? 480 : 1;
    }
    if (angry && p.victim) {
      const v = slot(p.victim, side);
      const near: Vec3 = [home[0] + (v[0] - home[0]) * 0.55, home[1], home[2] + (v[2] - home[2]) * 0.55];
      out.push({ to: near, durationMs: 420, height: 0.6, delayMs: forward && !settled ? Math.max(0, MOVE_MS - waited) + 150 : 150, onStart: sfx.growl });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  usePath(ref, segs, key, { face: false });

  // Face direction: across the lake while aboard; toward the lake (and a bit toward the camera) on a bank;
  // toward the victim when angry; toward the camera when celebrating.
  const facing = useRef<THREE.Group>(null);
  let yaw = sign(side) * -1.0;
  if (seatIndex >= 0) yaw = sign(state.boat) * -Math.PI / 2;
  if (rode) yaw = sign(state.boat) * Math.PI / 2;
  if (won && settled) yaw = sign(side) * -0.35;
  if (angry && p.victim && settled) {
    const h = slot(who, side);
    const v = slot(p.victim, side);
    yaw = Math.atan2(v[0] - h[0], v[2] - h[2]);
  }
  useFaceYaw(facing, yaw, 5);

  // Explorers caught outnumbered first panic, then turn to stone with a puff of dust.
  const [stone, setStone] = useState(false);
  const caught = explorer && onDangerBank && settled;
  useEffect(() => {
    if (!caught) {
      setStone(false);
      return;
    }
    const t = setTimeout(() => setStone(true), 750);
    return () => clearTimeout(t);
  }, [caught]);

  const eMood: ExplorerMood = won && settled ? 'happy' : stone ? 'stone' : caught ? 'scared' : 'idle';
  const gMood: GuardianMood = won && settled ? 'happy' : angry && settled ? 'angry' : 'idle';
  const aboard = seatIndex >= 0 || rode;

  return (
    <group ref={ref}>
      <group ref={facing}>
        <Clickable onClick={p.onClick} disabled={p.disabled}>
          {explorer ? (
            <Explorer look={Number(who[1])} mood={eMood} seed={p.seed} riding={aboard} />
          ) : (
            <Guardian mood={gMood} seed={p.seed} />
          )}
          {/* bigger invisible hit area, easier to tap on phones */}
          <mesh position-y={0.5} visible={false}>
            <sphereGeometry args={[0.6, 8, 8]} />
          </mesh>
        </Clickable>
      </group>
      {seatIndex >= 0 && <HintRing position={[0, 0.06, 0]} radius={0.42} color="#7ee0b0" />}
      {caught && !stone && <Bubble position={[0, 1.25, 0]} tone="red">!</Bubble>}
      {stone && <DustPuff />}
      {settled && angry && p.shout && <Bubble position={[0, 1.6, 0]} tone="white">HALT, INTRUDERS!</Bubble>}
      {won && settled && p.herald && <Bubble position={[0, 1.6, 0]} tone="gold">You may pass!</Bubble>}
    </group>
  );
}

/** A quick ring of stone dust, played once when an explorer is petrified. */
function DustPuff() {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const dirs = useMemo(() => Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2), []);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (start.current == null) {
      start.current = clock.elapsedTime;
      sfx.splash();
    }
    const t = Math.min((clock.elapsedTime - start.current) / 0.8, 1);
    g.children.forEach((c, i) => {
      const a = dirs[i];
      const r = 0.25 + t * 0.6;
      c.position.set(Math.cos(a) * r, 0.15 + t * 0.35 + (i % 3) * 0.12, Math.sin(a) * r);
      c.scale.setScalar((1 - t) * 0.9 + 0.05);
    });
    g.visible = t < 1;
  });
  return (
    <group ref={ref}>
      {dirs.map((_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[0.09, 0]} />
          <meshStandardMaterial color="#d9d2c4" roughness={1} flatShading transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}
