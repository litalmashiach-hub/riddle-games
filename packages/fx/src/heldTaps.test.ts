import { describe, expect, it } from 'vitest';
import { HELD_TAPS_MAX, TapQueue, letsHeldTapsGo, takeHeldTap } from './heldTaps';

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

describe('a tap acted on, and what it calls', () => {
  it('is firing while a held tap runs, and only then', () => {
    const q = new TapQueue();
    const seen: boolean[] = [];
    q.hold(() => seen.push(q.firing));
    expect(q.firing).toBe(false);
    takeHeldTap(q, playing(), false);
    expect(seen).toEqual([true]);
    expect(q.firing).toBe(false);
  });

  it('a nested fire stays inside the outer one, and a throw still ends it', () => {
    const q = new TapQueue();
    const seen: boolean[] = [];
    q.fire(() => {
      q.fire(() => seen.push(q.firing));
      seen.push(q.firing);
    });
    expect(seen).toEqual([true, true]);
    expect(q.firing).toBe(false);
    expect(() =>
      q.fire(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(q.firing).toBe(false);
  });
});

describe('what lets held taps go, seen in the store', () => {
  const at = (moves: unknown[], future: unknown[] = [], resetCount = 0) => ({ moves, future: future.map((move) => ({ move })), resetCount });
  const a = { id: 'a' };
  const b = { id: 'b' };

  it('Undo, Restart and Redo let them go', () => {
    expect(letsHeldTapsGo(at([a]), at([a, b]))).toBe(true);
    expect(letsHeldTapsGo(at([], [], 1), at([a]))).toBe(true);
    expect(letsHeldTapsGo(at([a, b]), at([a], [b]))).toBe(true);
  });

  it('a move played does not, even right after an Undo', () => {
    expect(letsHeldTapsGo(at([a]), at([]))).toBe(false);
    expect(letsHeldTapsGo(at([a, { id: 'c' }]), at([a], [b]))).toBe(false);
    // The end of a move's animation (busy goes false) changes no move.
    expect(letsHeldTapsGo(at([a]), at([a]))).toBe(false);
  });
});
