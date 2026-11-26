import { onLiftTap, useSettings } from '@riddle/fx';
import type { StoreApi } from 'zustand';
import { APP_SHELL } from './appShell';

/**
 * Touch response for the native app: a light tick when a tap does something.
 *
 * - Only in the app (`APP_SHELL`), and only where Capacitor runs natively, through its own Haptics plugin.
 *   The website build drops all of this at build time: it loads no plugin and never vibrates.
 * - It follows the game's sound switch. The tick stands beside the click sound as the game's answer to a
 *   tap, so one switch quiets both, and nothing new has to be stored on the device. A player who wants
 *   the sound without the tick has iOS's own switch for that (Settings, Sounds & Haptics, System Haptics),
 *   which the system's feedback generator obeys by itself.
 */

/** What a player taps outside the 3D scene. A disabled one does nothing, so it gives no tick. */
const CONTROL = 'button, a[href], [role="button"], [role="switch"], [role="tab"]';

/** Two answers within one tap (a tap in the scene that also plays a move, a label over a model) are one tick. */
const SAME_TAP_MS = 80;

let impact: (() => void) | null = null;
let last = -Infinity;
let given = 0;

/** A light tick, if this is the app, the device has one and the sound switch is on. */
export function tapFeedback() {
  if (!impact || !useSettings.getState().sound) return;
  const now = performance.now();
  if (now - last < SAME_TAP_MS) return;
  last = now;
  given++;
  impact();
}

/** Call once at start. Does nothing on the website. */
export function startHaptics() {
  if (!APP_SHELL) return;
  void Promise.all([import('@capacitor/core'), import('@capacitor/haptics')]).then(([{ Capacitor }, { Haptics, ImpactStyle }]) => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Haptics')) return;
    impact = () => void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  });
  // Every button, tab, switch and link of every screen, the levels' own included, with no change to any of them.
  // Caught on the way down, so that no screen can swallow the tap first. The tick itself waits until the
  // button has done its work: the sound switch then ticks when it turns the sound on, and not when it turns
  // it off, and a button that plays a move, which ticks by itself, is not answered twice however slow the device.
  document.addEventListener(
    'click',
    (e) => {
      const control = e.target instanceof Element ? e.target.closest(CONTROL) : null;
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      const before = given;
      setTimeout(() => {
        if (given === before) tapFeedback();
      }, 0);
    },
    true,
  );
  // A tap on the scene that a Clickable takes when the finger lifts: its click is held off, so it ticks here.
  // Asked before the tap acts, as the scene's click below is, so that the move it starts doesn't count as busy.
  onLiftTap(() => {
    if (sceneTakesTaps()) tapFeedback();
  });
}

/** The play session, as far as the touch response needs it. */
type Session = StoreApi<{ moves: readonly unknown[]; busy: boolean }>;
let playing: Session | null = null;

/**
 * Ticks for each move of the level being played, however it was made: a tap, or a drag let go.
 * Returns the cleanup. Does nothing on the website.
 */
export function watchMoves(session: Session) {
  if (!APP_SHELL) return () => {};
  playing = session;
  const stop = session.subscribe((now, before) => {
    if (now.moves.length > before.moves.length) tapFeedback();
  });
  return () => {
    stop();
    if (playing === session) playing = null;
  };
}

/** True while a level is open and not busy with an animation, so a tap in its scene can play a move. */
export function sceneTakesTaps() {
  return !!playing && !playing.getState().busy;
}
