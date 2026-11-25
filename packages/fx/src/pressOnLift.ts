/**
 * Taps on the 3D scene that count when the finger lifts, not on the browser's click.
 *
 * iOS sends no click for a press held a little long (and a busy device stretches every tap), and the 3D
 * layer passes a click only to what was under the finger when it went down. A press that goes down and
 * comes up on the same thing, without moving far, is a tap, whatever the browser does next. The click that
 * may still follow for the same touch is then held off, so that nothing in the scene acts on it a second
 * time. Level 15's arrows have done the same since #74.
 */

/**
 * How far (CSS pixels) a finger may wander between press and lift and still count as a tap. Further than
 * this, it was turning the camera. iOS's own tap allows about as much; level 15's arrows use the same.
 */
export const PRESS_SLOP = 12;

/**
 * How long after a tap was counted on the lift the browser's own click for that touch may still come,
 * timed by the events' own time stamps, so a device that is slow to hand the click over still matches it.
 * The click comes straight after the lift when it comes at all; a new press ends the wait at once. The bound
 * is only there so that a click with no press of its own (a key on a button) is never held off.
 */
export const CLICK_ECHO_MS = 1000;

/** The fields of a pointer event that a press needs. */
export interface PointerAt {
  pointerId: number;
  clientX: number;
  clientY: number;
}

/** What a lift on the target was: a tap, a drag (it moved too far), or no press of this pointer began here. */
export type Lift = 'tap' | 'drag' | 'none';

/** One target's press: put down on it, and counted when the same pointer lifts on it. */
export class LiftPress {
  private down: { id: number; x: number; y: number; far: boolean } | null = null;

  /** A pointer went down on the target. */
  press(e: PointerAt) {
    this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, far: false };
  }

  /** The pointer moved, anywhere: once it has gone further than a tap may, the press is a drag even if it comes back. */
  move(e: PointerAt) {
    const d = this.down;
    if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) > PRESS_SLOP) d.far = true;
  }

  /** The pointer lifted on the target. */
  lift(e: PointerAt): Lift {
    const d = this.down;
    if (!d || d.id !== e.pointerId) return 'none';
    this.down = null;
    return d.far || Math.hypot(e.clientX - d.x, e.clientY - d.y) > PRESS_SLOP ? 'drag' : 'tap';
  }

  /**
   * The pointer lifted somewhere (seen after the target had its turn): a press not lifted on the target is
   * over, so a later lift on it, with no new press, counts for nothing. Says whether no press is left.
   */
  end(pointerId: number): boolean {
    if (this.down?.id === pointerId) this.down = null;
    return !this.down;
  }
}

type Listen = Pick<EventTarget, 'addEventListener'>;

/**
 * Watches the whole page for what no single target sees: the finger's way between press and lift; a lift
 * anywhere, which ends every press of that pointer; and the click that follows a tap already counted, which
 * it stops before the scene gets it.
 */
export class ClickGuard {
  private until = -Infinity;
  private readonly open = new Set<LiftPress>();

  constructor(win: Listen) {
    // On the way down, before the scene or anything else on the page.
    win.addEventListener(
      'click',
      (e) => {
        if (e.timeStamp >= this.until) return;
        this.until = -Infinity;
        e.stopImmediatePropagation();
        e.preventDefault();
      },
      true,
    );
    // A new press: the click of the last touch is not coming any more.
    win.addEventListener('pointerdown', () => (this.until = -Infinity), true);
    // On the way up, after the scene has had the lift.
    const ended = (e: Event) => {
      const id = (e as PointerEvent).pointerId;
      for (const p of this.open) if (p.end(id)) this.open.delete(p);
    };
    win.addEventListener('pointerup', ended);
    win.addEventListener('pointercancel', ended);
    win.addEventListener(
      'pointermove',
      (e) => {
        for (const p of this.open) p.move(e as PointerEvent);
      },
      { passive: true },
    );
  }

  /** A press began on a target: follow its pointer, and end the press when it lifts anywhere. */
  watch(press: LiftPress) {
    this.open.add(press);
  }

  /**
   * A lift was taken as a tap (or as the end of a drag): the click that the browser may send for the same
   * touch is not a second one. `lift` is that lift's event.
   */
  holdOffClick(lift: Pick<Event, 'timeStamp'>) {
    this.until = lift.timeStamp + CLICK_ECHO_MS;
  }
}

let guard: ClickGuard | null = null;

/** The page's one guard, made on first use. */
export function clickGuard(): ClickGuard {
  return (guard ??= new ClickGuard(window));
}
