import type { SessionState } from '@riddle/engine';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { StoreApi } from 'zustand';
import { hasTestFlag } from '../appShell';

/**
 * TRIAL (test branch only): levels whose scene is drawn only when something changes.
 * Elsewhere the Canvas keeps drawing every display frame, as before.
 */
export const DRAW_ON_CHANGE = new Set(['twelve-coins', 'moonbeam-maze', 'timber-tangle']);

/** After a touch, a key, a resize, a return to the app or any change of the play, every frame is drawn for this long. */
export const ACTIVE_MS = 2500;
/** While nothing happens, the scene's own slow life (water, bobbing, idle wobble) is drawn at this rate. */
export const IDLE_FPS = 30;

const idleFps = () => {
  if (!hasTestFlag('debug')) return IDLE_FPS;
  const v = new URLSearchParams(location.search).get('idlefps');
  return v == null || v === '' || Number.isNaN(Number(v)) ? IDLE_FPS : Number(v);
};

/**
 * Goes inside a Canvas with frameloop="demand" and asks for frames:
 * - every display frame while the player acts, a move or an undo plays (busy), a win or loss plays out,
 *   a hint mark pulses, the camera flies in, or for ACTIVE_MS after any touch, key, resize, return or change;
 * - otherwise at IDLE_FPS, so what moves by itself keeps moving, only less often (0 stops it).
 * The scene's own code is not changed: its useFrame callbacks run on each drawn frame as before, and their
 * clock and delta are real time, so slow motion keeps its speed.
 */
export function DrawOnChange({ session }: { session: StoreApi<SessionState> }) {
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    const fps = idleFps();
    const gap = fps > 0 ? 1000 / fps : Infinity;
    // The camera's fly-in and the first frames that lift the loading curtain.
    let activeUntil = performance.now() + 3000;
    let last = 0;
    let raf = 0;
    const poke = () => {
      activeUntil = Math.max(activeUntil, performance.now() + ACTIVE_MS);
      invalidate();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') poke();
    };
    const events = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'keydown', 'touchstart', 'touchmove', 'touchend'] as const;
    for (const e of events) window.addEventListener(e, poke, { capture: true, passive: true });
    window.addEventListener('resize', poke);
    window.addEventListener('orientationchange', poke);
    window.addEventListener('pageshow', poke);
    window.addEventListener('focus', poke);
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = session.subscribe(poke);
    const tick = (now: number) => {
      const s = session.getState();
      const live = now < activeUntil || s.busy || s.hint != null || (s.status.kind !== 'playing' && !s.ended);
      // A frame drawn a little early is fine: a display tick is ~16.7 ms, so allow 4 ms of slack.
      if (live || now - last >= gap - 4) {
        last = now;
        invalidate();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const e of events) window.removeEventListener(e, poke, { capture: true });
      window.removeEventListener('resize', poke);
      window.removeEventListener('orientationchange', poke);
      window.removeEventListener('pageshow', poke);
      window.removeEventListener('focus', poke);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [session, invalidate]);
  return null;
}
