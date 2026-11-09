import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
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
/** Fail gag timing, counted from when the barge has landed. */
const BOOP_MS = 650;
const FLY_MS = 850;
/** How deep a dunked explorer floats (their waist at the waterline). */
const SPLASH_Y = -0.42;

/** Where a booped explorer lands: in the lake just off their own bank, spread out a bit. */
function splashSpot(w: Who, side: Side): Vec3 {
  const i = Number(w[1]);
  return [sign(side) * (1.9 - i * 0.5), SPLASH_Y, 1.0 + i * 0.3];
}

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
          blubber={victims[0]}
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
  /** The dunked explorer who says "Blub blub!". */
  blubber?: Who;
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
    if (explorer && onDangerBank) {
      // Booped! The explorer flies in a big cartoon arc and lands with a splash in the lake.
      out.push({ to: splashSpot(who, side), durationMs: FLY_MS, height: 2.4, delayMs: forward && !settled ? Math.max(0, MOVE_MS - waited) + BOOP_MS : BOOP_MS, onStart: sfx.hop });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  usePath(ref, segs, key, { face: false });

  // Explorers caught outnumbered: "Uh-oh!", a boop, a flight, a splash, then they bob about dizzy.
  const [phase, setPhase] = useState<'none' | 'flying' | 'splashed'>('none');
  const caught = explorer && onDangerBank && settled;
  useEffect(() => {
    if (!caught) {
      setPhase('none');
      return;
    }
    const a = setTimeout(() => setPhase('flying'), BOOP_MS);
    const b = setTimeout(() => {
      setPhase('splashed');
      sfx.splash();
    }, BOOP_MS + FLY_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [caught]);
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
  if (phase === 'splashed') yaw = sign(side) * -0.6;
  useFaceYaw(facing, yaw, 5);


  const eMood: ExplorerMood = won && settled ? 'happy' : phase === 'splashed' ? 'dizzy' : caught ? 'scared' : 'idle';
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
      {caught && phase === 'none' && <Bubble position={[0, 1.3, 0]} tone="red">Uh-oh!</Bubble>}
      {caught && phase === 'flying' && <Bubble position={[0, 1.3, 0]} tone="white">WHOA!</Bubble>}
      {phase === 'splashed' && <Splash />}
      {phase === 'splashed' && who === p.blubber && <Bubble position={[0, 1.5, 0]} tone="white">Blub blub!</Bubble>}
      {settled && angry && p.shout && <Bubble position={[0, 1.6, 0]} tone="white">Shoo, shoo! BOOP!</Bubble>}
      {won && settled && p.herald && <Bubble position={[0, 1.6, 0]} tone="gold">You may pass!</Bubble>}
    </group>
  );
}

/**
 * A big cartoon splash at the water surface: a crown of droplets, a foam puff and two
 * expanding rings. The actor sits half under water, so lift it to the surface.
 */
function Splash() {
  const drops = useRef<THREE.InstancedMesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const foam = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const N = 26;
  const parts = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 + Math.random() * 0.3;
        const s = 0.8 + Math.random() * 1.4;
        return { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 2.6 + Math.random() * 2.6, r: 0.04 + Math.random() * 0.05 };
      }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (start.current == null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const m = drops.current;
    if (m) {
      parts.forEach((p, i) => {
        const y = p.vy * t - 4.9 * t * t;
        dummy.position.set(p.vx * t, Math.max(y, -0.2), p.vz * t);
        dummy.scale.setScalar(y > -0.1 ? p.r * 1.6 : 0.0001);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    const rings: [THREE.Mesh | null, number][] = [[ring1.current, 0], [ring2.current, 0.25]];
    for (const [r, delay] of rings) {
      if (!r) continue;
      const k = Math.max(0, t - delay);
      r.scale.setScalar(0.3 + k * 2.2);
      (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - k * 0.7);
    }
    if (foam.current) {
      // A quick puff, then it settles into a small foam ring around the waist.
      const k = Math.min(t / 0.25, 1);
      const w = 0.5 + k * 0.45 - Math.min(Math.max(t - 0.3, 0) * 0.5, 0.45);
      foam.current.scale.set(w, Math.max(0.04, (1 - t * 0.8) * 0.6), w);
    }
  });
  return (
    <group position-y={-SPLASH_Y}>
      <instancedMesh ref={drops} args={[undefined, undefined, N]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={new THREE.Color('#bffcf2').multiplyScalar(1.6)} toneMapped={false} />
      </instancedMesh>
      <mesh ref={foam} position-y={0.05}>
        <icosahedronGeometry args={[0.45, 1]} />
        <meshStandardMaterial color="#effffb" emissive="#9ff5e6" emissiveIntensity={0.8} roughness={0.6} flatShading />
      </mesh>
      {[ring1, ring2].map((r, i) => (
        <mesh key={i} ref={r} position-y={0.04} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.45, 0.55, 32]} />
          <meshBasicMaterial color={new THREE.Color('#7ff7e4').multiplyScalar(2)} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
