import { describe, expect, it } from 'vitest';
import { CLEAR_GAP, liftClear, placeClear, type Box } from './hintPlace';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

describe('liftClear', () => {
  // Level 1 on an iPad at 1024 by 768, at the largest text size: the toast's own place, and "Row across".
  const toast = box(303, 588, 721, 660);
  const row = box(423, 586, 601, 631);

  it('leaves the toast where it is when it covers nothing', () => {
    expect(liftClear(box(398, 640, 626, 684), [row], 80)).toBe(0);
    expect(liftClear(toast, [], 80)).toBe(0);
  });

  it('lifts it over a scene button it would cover, with a gap', () => {
    const lift = liftClear(toast, [row], 80);
    expect(lift).toBe(toast.bottom - row.top + CLEAR_GAP);
    expect(toast.bottom - lift).toBeLessThanOrEqual(row.top - CLEAR_GAP);
  });

  it('does not move for a button it only comes near', () => {
    expect(liftClear(box(0, 100, 100, 140), [box(104, 100, 200, 140)], 0)).toBe(0);
    expect(liftClear(box(0, 100, 100, 140), [box(0, 140, 100, 180)], 0)).toBe(0);
    expect(liftClear(box(0, 100, 100, 140), [box(0, 139, 100, 180)], 0)).toBe(1 + CLEAR_GAP);
  });

  it('steps over a second button that the first lift runs into', () => {
    const upper = box(400, 520, 600, 560);
    const lift = liftClear(toast, [row, upper], 80);
    expect(toast.bottom - lift).toBeLessThanOrEqual(upper.top - CLEAR_GAP);
  });

  it('never lifts it past the top of its room; then it takes the place that covers least', () => {
    // Over "Row across" it fits, but there it would cover a big button above, and it can't go higher: it stays.
    expect(liftClear(toast, [row, box(300, 80, 720, 560)], 80)).toBe(0);
    // A small button above: lifted over "Row across", it covers less of that one than it did of "Row across".
    expect(liftClear(toast, [row, box(400, 80, 420, 560)], 80)).toBe(toast.bottom - row.top + CLEAR_GAP);
    // No room at all: it does not move.
    expect(liftClear(toast, [row], 560)).toBe(0);
  });

  it('pays no mind to buttons off to the side', () => {
    expect(liftClear(toast, [box(0, 600, 200, 640), box(800, 600, 1000, 640)], 80)).toBe(0);
  });
});

describe('placeClear', () => {
  // Level 5 at 667 by 375, at the largest text size: the toast's own place, the four name labels on the left,
  // the Cross button below them on the right, and the top of the room under the top bar.
  const toast = box(128, 238, 539, 338);
  const labels = [box(113, 169, 182, 191), box(70, 144, 152, 166), box(55, 119, 138, 141), box(91, 94, 217, 116)];
  const cross = box(253, 247, 414, 292);
  const room = { left: CLEAR_GAP, right: 667 - CLEAR_GAP };
  const at = (p: { lift: number; shift: number }) => box(toast.left + p.shift, toast.top - p.lift, toast.right + p.shift, toast.bottom - p.lift);
  const over = (a: Box, b: Box) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

  it('only lifts, as liftClear does, where a lift clears every button', () => {
    expect(placeClear(toast, [cross], 66, room)).toEqual({ lift: liftClear(toast, [cross], 66), shift: 0 });
    expect(placeClear(toast, [], 66, room)).toEqual({ lift: 0, shift: 0 });
  });

  it('steps aside where no lift clears them all, and then covers none', () => {
    const p = placeClear(toast, [...labels, cross], 66, room);
    expect(p.shift).not.toBe(0);
    for (const b of [...labels, cross]) expect(over(at(p), b)).toBe(false);
    expect(at(p).left).toBeGreaterThanOrEqual(room.left);
    expect(at(p).right).toBeLessThanOrEqual(room.right);
    expect(at(p).top).toBeGreaterThanOrEqual(66);
  });

  it('stays in the middle when no place clears them all', () => {
    const wall = box(0, 66, 667, 375);
    expect(placeClear(toast, [wall], 66, room).shift).toBe(0);
  });
});
