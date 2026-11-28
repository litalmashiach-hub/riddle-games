import { describe, expect, it } from 'vitest';
import { HELD_TAPS_MAX, TapQueue, takeHeldTap } from './heldTaps';

const playing = (busy = false) => ({ busy, status: { kind: 'playing' } });

describe('held taps', () => {
  it('acts on held taps in the order they were made, one at a time', () => {
    const q = new TapQueue();
    const done: string[] = [];
    q.hold(() => done.push('lift'));
    q.hold(() => done.push('drop'));
    expect(takeHeldTap(q, playing(), false)).toBe(true);
    expect(done).toEqual(['lift']);
    expect(takeHeldTap(q, playing(), false)).toBe(true);
    expect(done).toEqual(['lift', 'drop']);
    expect(takeHeldTap(q, playing(), false)).toBe(false);
    expect(done).toEqual(['lift', 'drop']);
  });

  it('waits while the next move it started still animates', () => {
    const q = new TapQueue();
    const done: string[] = [];
    q.hold(() => done.push('a'));
    q.hold(() => done.push('b'));
    takeHeldTap(q, playing(), false);
    // 'a' started a move: the store is busy before the scene draws it.
    expect(takeHeldTap(q, playing(true), false)).toBe(false);
    expect(done).toEqual(['a']);
    expect(q.size).toBe(1);
    takeHeldTap(q, playing(), false);
    expect(done).toEqual(['a', 'b']);
  });

  it('never acts after the move ended the level, won or lost', () => {
    for (const kind of ['won', 'lost']) {
      const q = new TapQueue();
      let fired = 0;
      q.hold(() => fired++);
      expect(takeHeldTap(q, { busy: false, status: { kind } }, false)).toBe(false);
      expect(fired).toBe(0);
      expect(q.size).toBe(0);
    }
  });

  it('lets held taps go while the rules card or loading curtain covers the scene', () => {
    const q = new TapQueue();
    let fired = 0;
    q.hold(() => fired++);
    takeHeldTap(q, playing(), true);
    takeHeldTap(q, playing(), false);
    expect(fired).toBe(0);
  });

  it('keeps no more than its limit: each tap makes at most one thing happen', () => {
    const q = new TapQueue();
    let fired = 0;
    for (let i = 0; i < HELD_TAPS_MAX; i++) expect(q.hold(() => fired++)).toBe(true);
    expect(q.hold(() => fired++)).toBe(false);
    while (takeHeldTap(q, playing(), false));
    expect(fired).toBe(HELD_TAPS_MAX);
  });

  it('taken() makes the next tap wait for the scene to draw', () => {
    const q = new TapQueue();
    let draws = 0;
    q.redraw = () => draws++;
    q.taken();
    expect(q.settling).toBe(true);
    expect(draws).toBe(1);
  });

  it('clear() drops everything (Undo, Restart, leaving the level)', () => {
    const q = new TapQueue();
    let fired = 0;
    q.hold(() => fired++);
    q.clear();
    expect(q.next()).toBe(false);
    expect(fired).toBe(0);
  });
});
