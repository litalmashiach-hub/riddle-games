import { describe, expect, it } from 'vitest';
import { EDGE, noteBox, overlap, pick, spots, type Box } from './refusalPlace';

const covers = (things: Box[], w: number, h: number) => (s: { x: number; y: number }) => things.reduce((sum, t) => sum + overlap(noteBox(s, w, h), t), 0);

describe('where a refusal note goes', () => {
  it('stays above the piece when nothing is there', () => {
    const list = spots({ x: 300, y: 200 }, 260, 120, 24, 667, 375, []);
    const { spot, index } = pick(list, covers([], 120, 24));
    expect(index).toBe(0);
    expect(spot).toEqual({ x: 300, y: 200 });
  });

  it('steps clear of a button it would cover, and stays near its piece', () => {
    // A column of buttons on the right of a small phone held sideways, like level 12's "Clues on".
    const button: Box = { l: 480, t: 150, r: 660, b: 190 };
    const w = 150;
    const h = 24;
    const top = { x: 470, y: 180 };
    const list = spots(top, 230, w, h, 667, 375, [button]);
    const { spot, covered } = pick(list, covers([button], w, h));
    expect(covered).toBe(0);
    expect(overlap(noteBox(spot, w, h), button)).toBe(0);
    // Left of the button, beside its piece: no further down than its own height.
    expect(spot.x + w / 2).toBeLessThanOrEqual(button.l);
    expect(Math.abs(spot.y - top.y)).toBeLessThanOrEqual(h);
  });

  it('keeps every place on the screen, also for a note wider than half of it', () => {
    const w = 400;
    const h = 60;
    const list = spots({ x: 20, y: 30 }, 80, w, h, 667, 375, [{ l: 0, t: 0, r: 300, b: 100 }]);
    for (const s of list) {
      const b = noteBox(s, w, h);
      expect(b.l).toBeGreaterThanOrEqual(EDGE - 1e-9);
      expect(b.t).toBeGreaterThanOrEqual(EDGE - 1e-9);
      expect(b.r).toBeLessThanOrEqual(667 - EDGE + 1e-9);
      expect(b.b).toBeLessThanOrEqual(375 - EDGE + 1e-9);
    }
  });

  it('takes the place that covers least when none is clear', () => {
    const wall: Box = { l: 0, t: 0, r: 667, b: 375 };
    const hole: Box = { l: 0, t: 0, r: 667, b: 100 };
    const w = 100;
    const h = 20;
    const list = spots({ x: 300, y: 200 }, 220, w, h, 667, 375, [wall]);
    const { covered } = pick(list, (s) => covers([wall], w, h)(s) - covers([hole], w, h)(s));
    expect(covered).toBe(0);
  });
});
