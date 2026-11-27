import { describe, expect, it } from 'vitest';
import { CLEAR_GAP, liftClear, type Box } from './hintPlace';

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
