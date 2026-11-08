import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { SceneProps } from '@riddle/engine';
import { Burst, ComicWord, FocusCam, Shake, sfx, usePhases } from '@riddle/fx';
import { HintRing } from '@riddle/props';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { moonSfx } from './audio';
import { Beam } from './Beam';
import { Fireflies, LagoonShore, NightWater } from './Lagoon';
import { PAD_Y, SOURCE, beamPath, cellPos, cellZ, sharedLength, type V3 } from './layout';
import { Crystal, MoonFlower, MoonLantern, MossRock, Toad, type ToadMode } from './Pieces';
import { LAYOUT, type Move, type State } from './rules';

export const MOVE_MS = 1900;
/** The crystal turns first, then the beam regrows from it. */
const T_TURN = 380;
/** The beam must reach its end before this, so lose/win checks see the final picture. */
const GROW_BY = 1680;
/** On the first load the beam shoots out once the camera has flown in. */
const INTRO_MS = 1600;

type ToadPhase = 'tickle' | 'sneeze' | 'fly' | 'after';
const TOAD_PHASES: [ToadPhase, number][] = [
  ['tickle', 1100],
  ['sneeze', 260],
  ['fly', 900],
  ['after', 60000],
];
type MoonPhase = 'sink' | 'after';
const MOON_PHASES: [MoonPhase, number][] = [
  ['sink', 1500],
  ['after', 60000],
];

const TOAD_HOME = cellPos(LAYOUT.toad.c, LAYOUT.toad.r, 0);
const FLY_DIST = 1.7;

export function Scene({ state, previous, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const path = useMemo(() => beamPath(state), [state]);
  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const toadLost = status.kind === 'lost' && path.end === 'toad';
  const moonLost = status.kind === 'lost' && !toadLost;

  // ---- Beam growth ----
  const reveal = useRef(0);
  const power = useRef(1);
  const grow = useRef<{ from: number; start: number; speed: number } | null>({ from: 0, start: performance.now() + INTRO_MS, speed: 9 });
  const lastCount = useRef(moveCount);
  const lastReset = useRef(resetCount);
  const litFlowers = useRef<boolean[]>(LAYOUT.flowers.map(() => false));
  const litMirrors = useRef<boolean[]>(LAYOUT.mirrors.map(() => false));

  useEffect(() => {
    const forward = moveCount > lastCount.current && resetCount === lastReset.current;
    const restarted = resetCount !== lastReset.current;
    const changed = moveCount !== lastCount.current || restarted;
    lastCount.current = moveCount;
    lastReset.current = resetCount;
    if (!changed) return;
    if (forward && previous) {
      moonSfx.turn();
      const shared = sharedLength(beamPath(previous), path);
      reveal.current = Math.min(reveal.current, shared);
      const left = Math.max(0, path.total - shared);
      grow.current = { from: shared, start: performance.now() + T_TURN, speed: Math.max(9, left / ((GROW_BY - T_TURN) / 1000)) };
    } else {
      // Undo or restart: the beam snaps to its new shape (quick regrow from the lantern on restart).
      grow.current = restarted || moveCount === 0 ? { from: 0, start: performance.now(), speed: 26 } : null;
      if (!grow.current) reveal.current = path.total;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, resetCount]);

  // ---- Fail and win beats ----
  const toadPhase = usePhases<ToadPhase>(toadLost && !busy, TOAD_PHASES);
  const moonPhase = usePhases<MoonPhase>(moonLost && !busy, MOON_PHASES);
  const party = won && !busy;
  const [shake, setShake] = useState(0);
  const [sneezeBurst, setSneezeBurst] = useState(0);
  const [splash, setSplash] = useState(0);
  const [confetti, setConfetti] = useState(0);

  const lastSeg = path.pts.length >= 2 ? [path.pts[path.pts.length - 1][0] - path.pts[path.pts.length - 2][0], path.pts[path.pts.length - 1][1] - path.pts[path.pts.length - 2][1]] : [1, 0];
  const segLen = Math.hypot(lastSeg[0], lastSeg[1]) || 1;
  const fly: [number, number] = toadLost ? [lastSeg[0] / segLen, lastSeg[1] / segLen] : [0.7, 0.7];
  const facing = toadLost ? Math.atan2(-fly[0], -fly[1]) : -Math.PI / 4;
  const landing: V3 = [TOAD_HOME[0] + fly[0] * FLY_DIST, 0, TOAD_HOME[2] + fly[1] * FLY_DIST];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    if (toadPhase === 'tickle') {
      moonSfx.ah(0);
      at(520, () => moonSfx.ah(1));
    } else if (toadPhase === 'sneeze') {
      moonSfx.choo();
      setShake((n) => n + 1);
      setSneezeBurst((n) => n + 1);
    } else if (toadPhase === 'fly') {
      sfx.boing();
      at(820, () => {
        sfx.splash();
        setSplash((n) => n + 1);
        setShake((n) => n + 1);
      });
    } else if (toadPhase === 'after') {
      at(500, moonSfx.sniff);
    }
    return () => timers.forEach(clearTimeout);
  }, [toadPhase]);

  useEffect(() => {
    if (moonPhase === 'sink') {
      moonSfx.moonset();
      const t = setTimeout(moonSfx.yawn, 700);
      return () => clearTimeout(t);
    }
  }, [moonPhase]);

  useEffect(() => {
    if (!party) return;
    setConfetti((n) => n + 1);
    LAYOUT.flowers.forEach((_, i) => setTimeout(() => moonSfx.bloom(i), 150 * i));
  }, [party]);

  const blown = toadPhase === 'sneeze' || toadPhase === 'fly' || toadPhase === 'after';
  const dark = blown || moonPhase != null;

  // ---- Moon reflection: drifts away and dims as turns run out ----
  const moon = useRef<[number, number]>([-2.2, -6.6]);
  const moonGlow = useRef(1);
  const frac = state.turns / LAYOUT.maxTurns;

  useFrame((_, dt) => {
    const g = grow.current;
    const now = performance.now();
    if (g && now >= g.start) {
      reveal.current = Math.min(path.total, g.from + ((now - g.start) / 1000) * g.speed);
      if (reveal.current >= path.total) grow.current = null;
    }
    power.current = THREE.MathUtils.damp(power.current, dark ? 0 : 1, blown ? 14 : moonPhase ? 2 : 6, dt);
    const rv = reveal.current;
    path.flowerAt.forEach((d, i) => {
      const on = rv >= d - 0.01;
      if (on && !litFlowers.current[i] && !over) moonSfx.bloom(i);
      litFlowers.current[i] = on && !dark;
    });
    path.mirrorAt.forEach((d, i) => {
      const on = rv >= d - 0.01;
      if (on && !litMirrors.current[i] && (grow.current || rv < path.total)) moonSfx.ping();
      litMirrors.current[i] = on && !dark;
    });
    const set = moonPhase ? 1.25 : frac;
    const tx = -2.2 - set * 2.6;
    const tz = -6.6 - set * 4.5;
    moon.current[0] = THREE.MathUtils.damp(moon.current[0], tx, 1.5, dt);
    moon.current[1] = THREE.MathUtils.damp(moon.current[1], tz, 1.5, dt);
    moonGlow.current = THREE.MathUtils.damp(moonGlow.current, moonPhase ? 0 : 1 - set * 0.55, 1.5, dt);
  });

  const onCrystal = (i: number) => {
    if (busy || over) return;
    play({ mirror: i });
  };

  const hintCell = hint ? LAYOUT.mirrors[hint.mirror] : null;
  const turnsLeft = LAYOUT.maxTurns - state.turns;
  const toadMode: ToadMode = toadPhase ?? (moonPhase ? 'yawn' : party ? 'dream' : 'sleep');
  const toadFocus: V3 = toadPhase === 'after' ? [landing[0], 0.4, landing[2]] : [TOAD_HOME[0], 0.5, TOAD_HOME[2]];

  return (
    <Shake trigger={shake} intensity={0.18} durationMs={500}>
      <NightWater moon={moon} moonGlow={moonGlow} />
      <LagoonShore />
      <Fireflies swarm={party} />
      <MoonLantern position={SOURCE} />

      {LAYOUT.rocks.map((k, i) => (
        <MossRock key={i} c={k.c} r={k.r} />
      ))}
      {LAYOUT.flowers.map((f, i) => (
        <MoonFlower key={i} c={f.c} r={f.r} index={i} lit={litFlowers} closed={dark} party={party} />
      ))}
      {LAYOUT.mirrors.map((m, i) => (
        <Crystal key={i} c={m.c} r={m.r} index={i} tilt={state.tilts[i]} lit={litMirrors} onClick={() => onCrystal(i)} disabled={busy || over} blown={blown} party={party} />
      ))}
      <Toad c={LAYOUT.toad.c} r={LAYOUT.toad.r} mode={toadMode} facing={facing} fly={fly} />

      <Beam path={path} reveal={reveal} power={power} />

      {hintCell && !busy && !over && <HintRing position={cellPos(hintCell.c, hintCell.r, PAD_Y + 0.09)} radius={0.66} />}
      <TurnsBadge left={turnsLeft} />

      {/* fail beats */}
      <FocusCam target={toadFocus} active={toadPhase != null} closer={0.55} />
      {toadPhase === 'tickle' && <ComicWord position={[TOAD_HOME[0] - 0.3, 1.6, TOAD_HOME[2]]} text="Ah... ah..." color="#e0e7ff" size={30} tilt={-4} />}
      {(toadPhase === 'sneeze' || toadPhase === 'fly') && <ComicWord position={[TOAD_HOME[0] - 0.6, 1.8, TOAD_HOME[2] - 0.3]} text="AH-CHOO!" color="#bef264" size={60} tilt={-10} />}
      {toadPhase === 'after' && <ComicWord position={[landing[0] - 0.3, 1.3, landing[2]]} text="Sniff!" color="#a5f3fc" size={32} tilt={8} />}
      {moonPhase === 'after' && <ComicWord position={[TOAD_HOME[0] - 0.4, 1.6, TOAD_HOME[2]]} text="Yaaawn!" color="#c4b5fd" size={36} tilt={6} />}
      <Burst trigger={sneezeBurst} position={[TOAD_HOME[0] - fly[0] * 0.4, 0.55, TOAD_HOME[2] - fly[1] * 0.4]} count={140} colors={['#d9f99d', '#bfdbfe', '#ffffff', '#a7f3d0', '#c4b5fd']} power={0.7} size={0.7} />
      <Burst trigger={splash} position={[landing[0], 0.1, landing[2]]} count={90} colors={['#93c5fd', '#e0f2fe', '#67e8f9', '#ffffff']} power={0.55} size={0.6} />
      <SplashRings trigger={splash} position={landing} />

      {/* win */}
      <Burst trigger={confetti} position={[0, 1.4, 0]} colors={['#f5f3ff', '#c4b5fd', '#fde68a', '#a7f3d0', '#f9a8d4']} />
      {party && <ComicWord position={[0, 2.2, cellZ(1)]} text="Bloom!" color="#fde68a" size={50} tilt={-6} />}
    </Shake>
  );
}

/** "N turns until moonset" pill above the far edge of the lily pads. */
function TurnsBadge({ left }: { left: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  const low = left <= 2;
  return (
    <Html position={[0, 0.25, cellZ(-1.05)]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: 'Fredoka, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 15,
          padding: '5px 14px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          color: low ? '#1e1b4b' : '#eef2ff',
          background: low ? 'linear-gradient(#fde68a,#f59e0b)' : 'rgba(30,27,75,.62)',
          border: '1.5px solid rgba(199,210,254,.7)',
          boxShadow: '0 4px 14px rgba(0,0,0,.35)',
          transition: 'background .3s',
        }}
      >
        {left > 0 ? `🌙 ${left} ${left === 1 ? 'turn' : 'turns'} until moonset` : '🌙 The moon has set'}
      </div>
    </Html>
  );
}

/** Rings spreading on the water where the toad lands. */
function SplashRings({ trigger, position }: { trigger: number; position: V3 }) {
  const rings = useRef<THREE.Group>(null);
  const start = useRef(-1);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  useEffect(() => {
    if (trigger) start.current = performance.now();
  }, [trigger]);
  useFrame(() => {
    const g = rings.current;
    if (!g) return;
    const e = start.current < 0 ? 99 : (performance.now() - start.current) / 1000;
    g.visible = e < 3;
    g.children.forEach((c, i) => {
      const k = Math.max(0, e - i * 0.25);
      c.scale.setScalar(0.3 + k * 1.4);
    });
    mat.opacity = Math.max(0, 0.8 - e * 0.3);
  });
  return (
    <group ref={rings} position={[position[0], 0.03, position[2]]} visible={false}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} material={mat}>
          <ringGeometry args={[0.42, 0.5, 32]} />
        </mesh>
      ))}
    </group>
  );
}
