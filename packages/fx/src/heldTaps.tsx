import { createContext, createElement, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from './sfx';

/*
 * Quick taps. A move animates for a while (1.2 s in level 4, longer where a group walks a bridge), and the
 * scene takes no tap until it is over. A player who taps briskly makes the next tap before that: it used to
 * be dropped without a sign, and the tap after it was then read as the wrong thing (a lift refused, say).
 *
 * Now a tap made while a move is still animating is held, and acted on the moment the move is over, as if
 * it were made then: the scene's own handler runs with the state of that moment, so its own rules and its
 * refusal notes apply as usual. Taps are kept in the order they were made, and acted on one at a time; once
 * one of them starts a move, the rest wait for that move to end. Each tap makes at most what one tap makes.
 *
 * One tap at a time also means: after a tap is taken, the next waits until the scene has been drawn with
 * what that tap did (a lifted disc, a picked animal). On a slow phone that is a frame or two; a tap that came
 * sooner would be read against the scene as it was before, and a lift-then-drop would be read as two lifts.
 *
 * Held taps are let go, never acted on: when the move ends the level (a win or a loss), at Undo or Restart,
 * when the rules card or the loading curtain is in the way, and when the player leaves the level. At most
 * HELD_TAPS_MAX are kept; one more is dropped, with the short "no" sound, so that it is not dropped unheard.
 *
 * Reduce Motion changes nothing here: it holds the ambient loops, not a move's own timing.
 */

/**
 * How many taps can wait: three moves of lift-and-drop. A player who taps every 0.4 s keeps ahead of the
 * 1.2 s moves of level 4 for about six moves before the queue is full.
 */
export const HELD_TAPS_MAX = 6;

/** What the holder needs to know of the play session, read live (it is a zustand store). */
export interface HeldTapsSession {
  getState(): { busy: boolean; status: { kind: string } };
  /** The store's own subscribe: Undo, Restart and Redo are seen the moment they change it. */
  subscribe?(listener: (now: SessionMoves, before: SessionMoves) => void): () => void;
}

/** The parts of the session that tell a move played apart from Undo, Restart and Redo. */
export interface SessionMoves {
  moves: readonly unknown[];
  future: readonly { move: unknown }[];
  resetCount: number;
}

/**
 * Whether this change of the session takes the scene somewhere a held tap was not meant for: Undo (a move
 * fewer), Restart (a new reset count) or Redo (the move that comes back is the one Undo took). A move
 * played, held tap or not, is none of these.
 */
export function letsHeldTapsGo(now: SessionMoves, before: SessionMoves): boolean {
  if (now.resetCount !== before.resetCount) return true;
  if (now.moves.length < before.moves.length) return true;
  const redone = now.moves.length > before.moves.length && before.future.length > 0 && now.moves[now.moves.length - 1] === before.future[0].move;
  return redone;
}

/** The queue of taps that wait. Exported for its tests; scenes use useHeldTap. */
export class TapQueue {
  private items: (() => void)[] = [];
  /** True from the moment a tap is taken until the scene has been drawn after it (see `taken`). */
  settling = false;
  /**
   * True while a tap is being acted on, held or not. A held tap that a handler calls from inside (level 15's
   * tap on the ice calls the slide; a Clickable calls the scene's own held handler) is part of that same tap:
   * it runs at once, with what the scene is now, and is not put at the back of the queue behind later taps.
   */
  firing = false;
  /** True while taps must wait: a move animates, or the scene is not yet drawn after the last tap. */
  holding: () => boolean = () => false;
  /** Asks <HeldTaps> to draw again, so that it can clear `settling` and take the next tap. */
  redraw: () => void = () => {};
  get size() {
    return this.items.length;
  }
  /** Keeps a tap for later. False if the queue is full and the tap is dropped. */
  hold(fire: () => void): boolean {
    if (this.items.length >= HELD_TAPS_MAX) return false;
    this.items.push(fire);
    return true;
  }
  /** A tap has just been taken: the next one waits until the scene is drawn. */
  taken() {
    this.settling = true;
    this.redraw();
  }
  /** Acts on the oldest held tap. False if none was held. */
  next(): boolean {
    const fire = this.items.shift();
    if (!fire) return false;
    this.fire(fire);
    return true;
  }
  /** Acts on one tap, so that what it calls is acted on with it (see `firing`). */
  fire(act: () => void) {
    if (this.firing) return act();
    this.firing = true;
    try {
      act();
    } finally {
      this.firing = false;
    }
  }
  clear() {
    this.items = [];
  }
}

/**
 * Once the scene has been drawn and no move animates: acts on the oldest held tap, or lets all of them go if
 * the level has ended or is covered. True if one was acted on (the next waits for the scene to draw again).
 */
export function takeHeldTap(queue: TapQueue, now: ReturnType<HeldTapsSession['getState']>, blocked: boolean): boolean {
  if (blocked || now.status.kind !== 'playing') {
    queue.clear();
    return false;
  }
  // The store can be a step ahead of what the scene was drawn with: a tap has just started a move.
  if (now.busy) return false;
  return queue.next();
}

const HeldTapsContext = createContext<TapQueue | null>(null);

/**
 * Around a level's scene, inside its <Canvas>. `animating` is the session's own busy flag, passed so that this
 * draws again when a move ends; `blocked` is true while the rules card or the loading curtain is up.
 */
export function HeldTaps({
  session,
  animating,
  blocked,
  moveCount,
  resetCount,
  children,
}: {
  session: HeldTapsSession;
  animating: boolean;
  blocked: boolean;
  moveCount: number;
  resetCount: number;
  children?: ReactNode;
}) {
  const [queue] = useState(() => new TapQueue());
  const [tick, setTick] = useState(0);
  const live = useRef({ session, blocked, animating });
  live.current = { session, blocked, animating };
  queue.redraw = () => setTick((t) => t + 1);
  queue.holding = () => {
    const { session: s, blocked: b, animating: drawn } = live.current;
    const st = s.getState();
    if (b || st.status.kind !== 'playing') return false;
    // A move animates as the session has it, or as the scene was last drawn (the two differ for a frame).
    // Taps that already wait go first.
    return st.busy || drawn || queue.settling || queue.size > 0;
  };

  // Undo, Restart and Redo: what was tapped was meant for a scene that is no longer there. Seen in the
  // store itself, the moment the button changes it: an effect that was already waiting to take the next held
  // tap (a move has just ended, and the scene not yet drawn) would otherwise read the store after Undo and
  // act on that tap before any render shows the Undo.
  useEffect(() => {
    if (!session.subscribe) return;
    return session.subscribe((now, before) => {
      if (letsHeldTapsGo(now, before)) queue.clear();
    });
  }, [queue, session]);
  // The same from what is drawn, for a session without subscribe (a test, a preview).
  // Before the held taps are taken below, in the same commit.
  const last = useRef({ moveCount, resetCount });
  useLayoutEffect(() => {
    const was = last.current;
    last.current = { moveCount, resetCount };
    if (moveCount < was.moveCount || resetCount !== was.resetCount) queue.clear();
  }, [queue, moveCount, resetCount]);

  // Drawn: the last tap's effect is on the screen. If no move animates, act on the oldest held tap.
  // A passive effect, after the scene's own: a scene resets its picks in an effect when a move is made, and
  // a tap is only taken once the scene has drawn again after that. Taps that come meanwhile wait in line.
  const seenMoves = useRef(moveCount);
  useEffect(() => {
    queue.settling = false;
    if (seenMoves.current !== moveCount) {
      seenMoves.current = moveCount;
      if (queue.size > 0) queue.taken();
      return;
    }
    if (animating) return;
    if (takeHeldTap(queue, session.getState(), blocked)) queue.taken();
    // moveCount too: when a tap starts a move from inside this effect, the scene may next be drawn only once
    // that move is over, so `animating` is seen false before and after, and only the move count tells.
  }, [queue, session, animating, blocked, tick, moveCount]);

  // Leaving the level.
  useEffect(() => () => queue.clear(), [queue]);

  return createElement(HeldTapsContext.Provider, { value: queue }, children);
}

/**
 * Wraps a scene's tap handler. `locked` is when the handler would take no tap now (the scene is busy with a
 * move, the level is over, the thing can't be tapped yet). While a move animates, or the scene is not yet
 * drawn after the last tap, a tap is held, and the handler runs when that is over, with what the scene is
 * then, if it is not locked then. Otherwise the handler runs at once if it is not locked. Outside <HeldTaps>
 * (a test, a preview) it is the plain handler.
 *
 * The returned function stays the same from one render to the next.
 */
export function useHeldTap<A extends unknown[]>(handler: (...args: A) => void, locked: boolean): (...args: A) => void {
  const queue = useContext(HeldTapsContext);
  const latest = useRef({ handler, locked });
  latest.current = { handler, locked };
  return useCallback(
    (...args: A) => {
      const now = latest.current;
      if (!queue) {
        if (!now.locked) now.handler(...args);
        return;
      }
      // Called from inside a tap that is being acted on: part of that tap, so at once (see TapQueue.firing).
      if (queue.firing) {
        if (!now.locked) now.handler(...args);
        return;
      }
      if (!queue.holding()) {
        if (now.locked) return;
        queue.fire(() => now.handler(...args));
        queue.taken();
        return;
      }
      const kept = queue.hold(() => {
        const then = latest.current;
        if (!then.locked) then.handler(...args);
      });
      if (!kept) sfx.denied();
    },
    [queue],
  );
}
