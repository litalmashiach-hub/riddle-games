import { describe, expect, it } from 'vitest';
import { EDGE, noteBox, overlap, pick, room, spots, type Box } from './refusalPlace';

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

  it('looks over the whole screen when nothing near the piece is free, and keeps off the piece', () => {
    // Level 5 on a phone held sideways at the largest text: a note half the screen wide, the explorer on the
    // left, the top bar's buttons along the top and the Cross button low in the middle.
    const W = 852;
    const H = 393;
    const w = 426;
    const h = 96;
    const things: Box[] = [
      { l: 8, t: 8, r: 210, b: 60 }, // home and score
      { l: 672, t: 8, r: 844, b: 70 }, // SD, sound, about
      { l: 340, t: 258, r: 512, b: 312 }, // Cross
      { l: 8, t: 230, r: 76, b: 385 }, // undo column
      { l: 716, t: 305, r: 844, b: 389 }, // Hint
      { l: 100, t: 95, r: 280, b: 180 }, // the explorers' name buttons
      { l: 330, t: 90, r: 520, b: 160 }, // a gold mark on the bridge
    ];
    const top = { x: 170, y: 175 };
    const piece: Box = { l: 154, t: 171, r: 186, b: 225 };
    const near = pick(spots(top, 225, w, h, W, H, things), covers(things, w, h));
    expect(near.covered).toBeGreaterThan(0);
    const free = room(top, piece, w, h, W, H, things);
    expect(free.length).toBeGreaterThan(0);
    const box = noteBox(free[0], w, h);
    for (const t of [...things, piece]) expect(overlap(box, t)).toBe(0);
    expect(box.l).toBeGreaterThanOrEqual(EDGE);
    expect(box.r).toBeLessThanOrEqual(W - EDGE);
    expect(box.t).toBeGreaterThanOrEqual(EDGE);
    expect(box.b).toBeLessThanOrEqual(H - EDGE);
    // The nearest free place comes first.
    const d = (s: { x: number; y: number }) => (s.x - top.x) ** 2 + (s.y - top.y) ** 2;
    for (const s of free.slice(1)) expect(d(s)).toBeGreaterThanOrEqual(d(free[0]));
  });

  it('finds no room when the screen has none', () => {
    expect(room({ x: 100, y: 100 }, { l: 0, t: 0, r: 0, b: 0 }, 300, 100, 320, 200, [{ l: 0, t: 0, r: 320, b: 200 }])).toEqual([]);
  });
});
