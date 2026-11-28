import { describe, expect, it } from 'vitest';
import { LABEL_GAP, spreadLabels, type LabelBox } from './labelSpread';

const BOUNDS = { left: 6, top: 6, right: 661, bottom: 369 };

function overlap(a: LabelBox, b: LabelBox) {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ix > 0 && iy > 0;
}
const moved = (boxes: LabelBox[], bounds = BOUNDS) => {
  const out = spreadLabels(boxes, bounds);
  return boxes.map((b, i) => ({ ...b, x: b.x + out[i].dx, y: b.y + out[i].dy }));
};
const noneOverlap = (boxes: LabelBox[]) => boxes.every((a, i) => boxes.every((b, j) => i >= j || !overlap(a, b)));

describe('spreadLabels', () => {
  it('leaves labels alone when they already have room', () => {
    const boxes = [
      { x: 50, y: 100, w: 80, h: 18 },
      { x: 200, y: 100, w: 80, h: 18 },
    ];
    expect(spreadLabels(boxes, BOUNDS)).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ]);
  });

  it('keeps the nearer label in place and lifts the other one clear of it', () => {
    const boxes = [
      { x: 100, y: 100, w: 80, h: 18 },
      { x: 110, y: 108, w: 80, h: 18 },
    ];
    const out = spreadLabels(boxes, BOUNDS);
    expect(out[1]).toEqual({ dx: 0, dy: 0 });
    expect(out[0]).toEqual({ dx: 0, dy: 108 - LABEL_GAP - 18 - 100 });
  });

  it('untangles a tight group, like five travellers on one small island', () => {
    const boxes = [0, 1, 2, 3, 4].map((i) => ({ x: 100 + i * 9, y: 120 + ((i * 7) % 11), w: 70, h: 21 }));
    expect(noneOverlap(boxes)).toBe(false);
    expect(noneOverlap(moved(boxes))).toBe(true);
  });

  it('keeps every label on the screen', () => {
    const boxes = [
      { x: -20, y: 2, w: 110, h: 18 },
      { x: -10, y: 4, w: 110, h: 18 },
      { x: 600, y: 360, w: 110, h: 18 },
    ];
    const after = moved(boxes);
    expect(noneOverlap(after)).toBe(true);
    for (const b of after) {
      expect(b.x).toBeGreaterThanOrEqual(BOUNDS.left);
      expect(b.y).toBeGreaterThanOrEqual(BOUNDS.top);
      expect(b.x + b.w).toBeLessThanOrEqual(BOUNDS.right);
      expect(b.y + b.h).toBeLessThanOrEqual(BOUNDS.bottom);
    }
  });

  it('keeps a label where it was when that place is still free', () => {
    const boxes = [
      { x: 100, y: 100, w: 80, h: 18 },
      { x: 110, y: 108, w: 80, h: 18 },
    ];
    const first = spreadLabels(boxes, BOUNDS);
    // The characters shift a little; the answer should not flip to a different arrangement.
    const nudged = [boxes[0], { ...boxes[1], x: 112 }];
    expect(spreadLabels(nudged, BOUNDS, first)[0]).toEqual(first[0]);
  });

  it("keeps a label off another character's figure, but not off its own", () => {
    const boxes = [
      { x: 100, y: 100, w: 80, h: 18 },
      { x: 300, y: 100, w: 80, h: 18 },
    ];
    // A figure under label 0's spot, owned by label 1; and label 0's own figure, just below its spot.
    const obstacles = [
      { box: { x: 120, y: 95, w: 30, h: 60 }, owner: 1 },
      { box: { x: 125, y: 110, w: 30, h: 60 }, owner: 0 },
    ];
    const out = spreadLabels(boxes, BOUNDS, [], { obstacles });
    const at = { ...boxes[0], x: boxes[0].x + out[0].dx, y: boxes[0].y + out[0].dy };
    expect(overlap(at, obstacles[0].box)).toBe(false);
    expect(Math.hypot(out[0].dx, out[0].dy)).toBeLessThan(40);
    expect(out[1]).toEqual({ dx: 0, dy: 0 });
  });

  it('still keeps labels apart when no place clears the figures', () => {
    const bounds = { left: 0, top: 0, right: 200, bottom: 60 };
    const boxes = [
      { x: 20, y: 20, w: 80, h: 18 },
      { x: 30, y: 24, w: 80, h: 18 },
    ];
    const out = spreadLabels(boxes, bounds, [], { obstacles: [{ box: { x: 0, y: 0, w: 200, h: 60 } }] });
    const after = boxes.map((b, i) => ({ ...b, x: b.x + out[i].dx, y: b.y + out[i].dy }));
    expect(noneOverlap(after)).toBe(true);
  });
});
