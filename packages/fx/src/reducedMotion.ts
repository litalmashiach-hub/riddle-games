import { useSyncExternalStore } from 'react';
import type * as THREE from 'three';

/*
 * Reduce Motion. A player who turns on Settings > Accessibility > Motion > Reduce Motion on an iPhone
 * or iPad (or the same setting on any other system) is asking for less motion. The app's web view
 * reports it as the `prefers-reduced-motion: reduce` media query, and the whole game follows it:
 *
 * - The scene's clock stands still (`steadyClock`). Every ambient loop in every level is drawn from
 *   `clock.elapsedTime`: water, bobbing, swaying, blinking, flickering lamps, hint pulses. With the
 *   clock held, they all hold their pose. The frame time `dt` still runs, so everything that eases
 *   towards a target (the puzzle's own moves, figures turning to face) moves as before.
 * - A one-off effect that measures its own age must not use the held clock, or it never plays: it
 *   uses `sceneSeconds()`, which always runs.
 * - The camera does not fly in, shake or zoom; confetti and dust bursts are not thrown; spinning that
 *   is not the puzzle itself stops (`ambientDt`); flashes are held steady.
 * - On the page, endless CSS loops stop (index.css) and Motion's moves become fades (MotionConfig).
 *
 * With the setting off, none of this changes anything.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
let reduce = media?.matches ?? false;
const listeners = new Set<() => void>();
media?.addEventListener?.('change', (e) => {
  reduce = e.matches;
  listeners.forEach((l) => l());
});

/** True while the player's device asks for reduced motion. Cheap: read it every frame if need be. */
export function reducedMotion(): boolean {
  return reduce;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The same, as a React hook: the component draws again when the setting is switched. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reducedMotion, () => false);
}

/** `dt` for ambient motion that adds up frame by frame (a turning windmill): 0 while motion is reduced. */
export function ambientDt(dt: number): number {
  return reduce ? 0 : dt;
}

/** Seconds that always run, also while the scene's clock is held. For effects that time their own age. */
export function sceneSeconds(): number {
  return performance.now() / 1000;
}

const STEADY = Symbol('riddle-steady-clock');

/**
 * Holds the scene's clock while motion is reduced. `clock.elapsedTime` keeps the last value it had
 * (0 when the setting was on from the start); `getDelta()` still returns the real frame time, which is
 * what the renderer hands each `useFrame` as `dt`. When the setting is switched off the clock goes on
 * from where it stood, so nothing jumps. Calling it twice on one clock is harmless.
 */
export function steadyClock(clock: THREE.Clock): void {
  const c = clock as THREE.Clock & { [STEADY]?: true };
  if (c[STEADY]) return;
  let elapsed = clock.elapsedTime;
  Object.defineProperty(clock, 'elapsedTime', {
    configurable: true,
    enumerable: true,
    get: () => elapsed,
    set: (v: number) => {
      if (!reduce) elapsed = v;
    },
  });
  c[STEADY] = true;
}
