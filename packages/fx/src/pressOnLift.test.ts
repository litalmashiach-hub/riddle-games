import { describe, expect, it } from 'vitest';
import { CLICK_ECHO_MS, ClickGuard, LiftPress, PRESS_SLOP } from './pressOnLift';

const at = (x: number, y: number, pointerId = 1) => ({ pointerId, clientX: x, clientY: y });

/** An event with a set time stamp, sent to a page stand-in. */
function send(page: EventTarget, type: string, timeStamp: number, pointerId = 1) {
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, 'timeStamp', { value: timeStamp });
  Object.defineProperty(e, 'pointerId', { value: pointerId });
  let reached = false;
  // What lies under the page's own capture listeners: the scene, say.
  const seen = () => (reached = true);
  page.addEventListener(type, seen);
  page.dispatchEvent(e);
  page.removeEventListener(type, seen);
  return { reached, stopped: e.defaultPrevented };
}

describe('LiftPress', () => {
  it('takes a press lifted where it went down as a tap', () => {
    const p = new LiftPress();
    p.press(at(100, 100));
    expect(p.lift(at(100, 100))).toBe('tap');
  });

  it('allows the finger to wander a little, and no more', () => {
    const p = new LiftPress();
    p.press(at(100, 100));
    expect(p.lift(at(100 + PRESS_SLOP, 100))).toBe('tap');
    p.press(at(100, 100));
    expect(p.lift(at(100 + PRESS_SLOP, 101))).toBe('drag');
  });

  it('counts a press once: a second lift with no new press is nothing', () => {
    const p = new LiftPress();
    p.press(at(10, 10));
    expect(p.lift(at(10, 10))).toBe('tap');
    expect(p.lift(at(10, 10))).toBe('none');
  });

  it('takes a lift only from the pointer that pressed', () => {
    const p = new LiftPress();
    p.press(at(10, 10, 1));
    expect(p.lift(at(10, 10, 2))).toBe('none');
    expect(p.lift(at(10, 10, 1))).toBe('tap');
  });

  it('gives nothing for a lift with no press on it', () => {
    expect(new LiftPress().lift(at(0, 0))).toBe('none');
  });

  it('forgets a press that was lifted somewhere else', () => {
    const p = new LiftPress();
    p.press(at(10, 10, 1));
    expect(p.end(2)).toBe(false); // another finger's lift: still pressed
    expect(p.end(1)).toBe(true);
    // The mouse comes back over the target and is let go there: no new press, so no tap.
    expect(p.lift(at(10, 10, 1))).toBe('none');
  });
});

describe('ClickGuard', () => {
  it('stops the click that follows a tap counted on the lift, once', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    g.holdOffClick({ timeStamp: 1000 });
    expect(send(page, 'click', 1010)).toEqual({ reached: false, stopped: true });
    expect(send(page, 'click', 1020)).toEqual({ reached: true, stopped: false });
  });

  it('still stops it when the device hands it over late, by its own time stamp', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    g.holdOffClick({ timeStamp: 1000 });
    expect(send(page, 'click', 1000 + CLICK_ECHO_MS - 1).reached).toBe(false);
  });

  it('lets a click through that comes long after (a key on a button)', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    g.holdOffClick({ timeStamp: 1000 });
    expect(send(page, 'click', 1000 + CLICK_ECHO_MS).reached).toBe(true);
  });

  it('stops waiting at a new press: no click came for the last one (iOS after a long press)', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    g.holdOffClick({ timeStamp: 1000 });
    send(page, 'pointerdown', 1200);
    expect(send(page, 'click', 1300).reached).toBe(true);
  });

  it('holds off nothing until asked', () => {
    const page = new EventTarget();
    new ClickGuard(page);
    expect(send(page, 'click', 5).reached).toBe(true);
  });

  it('ends a watched press when its pointer lifts anywhere', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    const p = new LiftPress();
    p.press(at(10, 10, 7));
    g.watch(p);
    send(page, 'pointerup', 50, 3); // another finger
    send(page, 'pointerup', 60, 7);
    expect(p.lift(at(10, 10, 7))).toBe('none');
  });

  it('ends a watched press on a cancelled touch too', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    const p = new LiftPress();
    p.press(at(10, 10, 4));
    g.watch(p);
    send(page, 'pointercancel', 50, 4);
    expect(p.lift(at(10, 10, 4))).toBe('none');
  });
});

describe('a press that wandered off and came back', () => {
  it('is a drag, not a tap: the camera turned meanwhile', () => {
    const page = new EventTarget();
    const g = new ClickGuard(page);
    const p = new LiftPress();
    p.press(at(100, 100));
    g.watch(p);
    const move = (x: number) => {
      const e = new Event('pointermove');
      Object.assign(e, { pointerId: 1, clientX: x, clientY: 100 });
      page.dispatchEvent(e);
    };
    move(105);
    move(160);
    move(100);
    expect(p.lift(at(100, 100))).toBe('drag');
  });

  it('stays a tap while it keeps within reach', () => {
    const p = new LiftPress();
    p.press(at(100, 100));
    p.move(at(108, 104));
    p.move(at(103, 99));
    expect(p.lift(at(102, 100))).toBe('tap');
  });
});
