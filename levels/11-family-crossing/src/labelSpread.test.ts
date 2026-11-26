import { hintLabelReach } from '@riddle/props';
import { describe, expect, it } from 'vitest';
import { LABEL_GAP, spreadLabels, withReach, type LabelBox } from './labelSpread';

const bounds = { left: 6, top: 6, right: 846, bottom: 387 };
const apart = (a: LabelBox, b: LabelBox) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const moved = (b: LabelBox, o: { dx: number; dy: number }) => ({ ...b, x: b.x + o.dx, y: b.y + o.dy });
const hinted = (b: LabelBox) => withReach(b, hintLabelReach(b.w, b.h));

/**
 * Level 11's Thief and Guard: two short labels that want to stand side by side above two figures who stand
 * close together, as on a phone held sideways. With Hint up both wear the gold band.
 */
const thief: LabelBox = { x: 300, y: 60, w: 38, h: 15 };
const guard: LabelBox = { x: 341, y: 60, w: 42, h: 15 };

describe("level 11's labels and Hint's band", () => {
  it('without the band counted, two banded labels side by side have touching bands (the fault)', () => {
    const out = spreadLabels([thief, guard], bounds);
    const [a, b] = [moved(hinted(thief), out[0]), moved(hinted(guard), out[1])];
    expect(apart(a, b)).toBe(false);
  });

  it('with the band counted, the bands stand apart, with the usual gap between them', () => {
    const boxes = [hinted(thief), hinted(guard)];
    const out = spreadLabels(boxes, bounds);
    const [a, b] = [moved(boxes[0], out[0]), moved(boxes[1], out[1])];
    expect(apart(a, b)).toBe(true);
    const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
    expect(gap).toBeGreaterThanOrEqual(LABEL_GAP - 0.01);
  });

  it('a banded label keeps clear of a plain neighbour, and the labels themselves never overlap', () => {
    const mom: LabelBox = { x: 318, y: 78, w: 40, h: 15 };
    const boxes = [hinted(thief), hinted(guard), mom];
    const out = spreadLabels(boxes, bounds);
    const placed = boxes.map((b, i) => moved(b, out[i]));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(apart(placed[i], placed[j]), `${i} and ${j}`).toBe(true);
    // The band's middle is the label's middle: growing the box moves nothing by itself.
    expect(hinted(thief).x + hinted(thief).w / 2).toBeCloseTo(thief.x + thief.w / 2);
  });
});
