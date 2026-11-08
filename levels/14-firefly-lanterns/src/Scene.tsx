import type { SceneProps } from '@riddle/engine';
import { Burst, ComicWord, DizzyStars, FocusCam, Shake, sfx, usePath, usePhases, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LanternFireflies } from './Fireflies';
import { Frog, type FrogGag } from './Frog';
import { Lagoon } from './Lagoon';
import { Lantern } from './Lantern';
import { FROG_HOME, makeGlows, padPos, type Ripple } from './layout';
import { CELLS, MAX_TAPS, flipMask, isLit, type Move, type State } from './rules';

const HOP_MS = 560;
/** Neighbours flip a moment after the pad the frog lands on, like a ripple. */
const SPREAD_MS = 150;
export const MOVE_MS = HOP_MS + SPREAD_MS + 380;
/** Beats of the fail scene. */
const FAIL: ['yawn' | 'slip' | 'under' | 'surfaced', number][] = [
  ['yawn', 1300],
  ['slip', 550],
  ['under', 450],
  ['surfaced', 60000],
];
export const END_DELAY_MS = 1300 + 550 + 450 + 1300;

/** The frog sits at the front edge of a pad, beside the lantern. */
const frogSpot = (cell: number): Vec3 => (cell < 0 ? FROG_HOME : [padPos(cell)[0] + 0.12, 0.07, padPos(cell)[2] + 0.4]);

export function Scene({ state, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const glows = useMemo(makeGlows, []);
  const ripples = useMemo<Ripple[]>(() => [0, 1, 2].map(() => ({ x: 0, z: 0, t: -1, strength: 0 })), []);
  const rippleSlot = useRef(0);
  const addRipple = (x: number, z: number, strength: number) => {
    ripples[rippleSlot.current] = { x, z, t: performance.now(), strength };
    rippleSlot.current = (rippleSlot.current + 1) % ripples.length;
  };

  // Was the latest change a new move (animate) or an undo / restart (snap back quickly)?
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    dir.current = { count: moveCount, reset: resetCount, forward: resetCount === dir.current.reset && moveCount > dir.current.count };
  }
  const forward = dir.current.forward;
  const tapped = forward && lastMove ? lastMove.cell : -1;
  const flipped = tapped >= 0 ? flipMask(tapped) : 0;

  const over = status.kind !== 'playing';
  const won = status.kind === 'won' && !busy;
  const lost = status.kind === 'lost' && !busy;
  const fail = usePhases(lost, FAIL);
  const gag: FrogGag = fail;

  // ---- Frog hops to the pad that was tapped ----
  const frog = useRef<THREE.Group>(null);
  const frogBody = useRef<THREE.Group>(null);
  const segs: PathSegment[] = forward
    ? [{ to: frogSpot(state.frog), durationMs: HOP_MS, height: 1.0, onStart: sfx.hop }]
    : [{ to: frogSpot(state.frog), durationMs: 350, height: 0.5 }];
  usePath(frog, segs, `${moveCount}|${resetCount}`, { face: true });
  useEffect(() => {
    // Start on the bank looking at the pond.
    if (frog.current) frog.current.rotation.y = Math.PI * 0.8;
  }, []);

  // Landing: ripple on the water and a chime (up for a lantern turning on, down for off).
  useEffect(() => {
    if (tapped < 0) return;
    const [x, , z] = padPos(tapped);
    const nowLit = isLit(state, tapped);
    const t1 = setTimeout(() => {
      addRipple(x, z, 1);
      if (nowLit) sfx.select();
      else sfx.deselect();
    }, HOP_MS);
    const t2 = setTimeout(() => sfx.click(), HOP_MS + SPREAD_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, resetCount]);

  // ---- Win party ----
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!won) return;
    setBurst((b) => b + 1);
    sfx.boing();
  }, [won]);

  // ---- Fail: the frog yawns, slips off the pad and gets dunked ----
  const [shake, setShake] = useState(0);
  const [splash, setSplash] = useState(0);
  const [splashAt, setSplashAt] = useState<Vec3>([0, 0, 0]);
  useEffect(() => {
    if (fail === 'slip') sfx.squeak();
    if (fail === 'under') {
      const p = new THREE.Vector3(0.65, 0, 0);
      if (frogBody.current) frogBody.current.localToWorld(p);
      else p.set(...frogSpot(state.frog));
      setSplashAt([p.x, 0.05, p.z]);
      addRipple(p.x, p.z, 1.8);
      setSplash((s) => s + 1);
      setShake((s) => s + 1);
      sfx.splash();
    }
    if (fail === 'surfaced') {
      sfx.boing();
      setTimeout(() => sfx.sadTrombone(), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail]);

  const tap = (cell: number) => {
    if (busy || over) return;
    play({ cell });
  };

  const hintCell = hint && !busy && !over ? hint.cell : -1;
  const frogPos = frogSpot(state.frog);
  const sleepy = !!fail;

  return (
    <Shake trigger={shake} intensity={0.14}>
      <Lagoon glows={glows} ripples={ripples} />

      {Array.from({ length: CELLS }, (_, cell) => (
        <Lantern
          key={cell}
          cell={cell}
          lit={isLit(state, cell)}
          delayMs={(flipped >> cell) & 1 ? HOP_MS + (cell === tapped ? 0 : SPREAD_MS) : 0}
          stomp={cell === tapped ? moveCount : 0}
          stompDelayMs={HOP_MS}
          glows={glows}
          sleepy={sleepy}
          party={won}
          disabled={busy || over}
          onClick={() => tap(cell)}
        />
      ))}
      <LanternFireflies glows={glows} party={won} sleepy={sleepy} />

      <group ref={frog}>
        <Frog ref={frogBody} happy={won} gag={gag} />
      </group>

      {hintCell >= 0 && <HintRing position={[padPos(hintCell)[0], 0.09, padPos(hintCell)[2]]} radius={0.82} />}

      <SleepMeter taps={state.taps} />

      {/* fail-scene gags */}
      {fail === 'yawn' && <Bubble position={[frogPos[0], frogPos[1] + 0.9, frogPos[2]]}>*yaaawn*</Bubble>}
      {fail === 'yawn' && <Bubble position={[0, 1.6, -1.2]} tone="gold">Zzz…</Bubble>}
      {(fail === 'under' || fail === 'surfaced') && <ComicWord position={[splashAt[0], 1.3, splashAt[2]]} text="SPLOOSH!" color="#7ee7ff" ink="#0b2a4a" />}
      {fail === 'surfaced' && <Bubble position={[splashAt[0], 0.75, splashAt[2]]}>Blub!</Bubble>}
      {fail === 'surfaced' && <DizzyStars position={[splashAt[0], 0.42, splashAt[2]]} radius={0.26} />}
      <Burst trigger={splash} position={[splashAt[0], 0.1, splashAt[2]]} colors={['#bff4ff', '#7ee7ff', '#ffffff', '#5cc46f']} power={0.55} size={0.8} count={120} />
      <FocusCam target={[frogPos[0], 0.2, frogPos[2]]} active={!!fail} closer={0.6} />

      {/* win party */}
      <Burst trigger={burst} position={[0, 1.2, 0]} />
    </Shake>
  );
}

/** A row of little fireflies on the far bank: each tap uses one up. When they are all asleep, the level is lost. */
function SleepMeter({ taps }: { taps: number }) {
  // drei's <Html> can stay empty if it mounts on the very first frame, so show it a moment later.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  const left = Math.max(0, MAX_TAPS - taps);
  return (
    <Html position={[0, 0.5, -4.3]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(20,16,50,.55)',
          border: '1px solid rgba(255,255,255,.25)',
          backdropFilter: 'blur(6px)',
          fontFamily: 'Fredoka, system-ui, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: '#f4f1ff',
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,.35)',
        }}
      >
        <span>{left > 0 ? `Awake for ${left} more ${left === 1 ? 'tap' : 'taps'}` : 'Zzz…'}</span>
        <span style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: MAX_TAPS }, (_, i) => {
            const awake = i < left;
            return (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: awake ? '#e9ff7a' : 'rgba(255,255,255,.18)',
                  boxShadow: awake ? '0 0 8px 2px rgba(220,255,110,.75)' : 'none',
                  transition: 'all .4s',
                }}
              />
            );
          })}
        </span>
      </div>
    </Html>
  );
}
