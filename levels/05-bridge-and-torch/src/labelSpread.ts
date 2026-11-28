/**
 * Makes floating labels give each other room.
 *
 * Each label wants to sit at its own spot (above its character). When characters stand close
 * together, those spots overlap and the labels can't be read. `spreadLabels` moves labels just far
 * enough that none overlaps another: usually one steps up above its neighbour.
 *
 * Pure numbers, in screen pixels: no DOM, no three.js. `useLabelSpread` feeds it and applies the result.
 * The same two files live in each level that needs them (levels may not share code outside packages).
 */

/** A label's box at the spot it wants, in screen pixels. */
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Offset {
  dx: number;
  dy: number;
}

/** Clear space kept between two labels. */
export const LABEL_GAP = 3;

/**
 * Something drawn on the screen that labels should stand clear of, like a character's body: a label
 * drawn over it would take the touches meant for it. `owner` is the index of the label that may cover
 * it (a character's own label sits over their head).
 */
export interface Obstacle {
  box: LabelBox;
  owner?: number;
}

export interface SpreadOptions {
  gap?: number;
  obstacles?: Obstacle[];
}

const overlaps = (ax: number, ay: number, a: LabelBox, bx: number, by: number, b: LabelBox, gap: number) =>
  ax < bx + b.w + gap && bx < ax + a.w + gap && ay < by + b.h + gap && by < ay + a.h + gap;

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));

/** Moving a label down puts it on its own character's face, so that costs the most; up is cheapest. */
const cost = (dx: number, dy: number) => Math.abs(dx) * 1.3 + (dy < 0 ? -dy : dy * 2.5);

/**
 * Where to move each label so that none overlaps another and all stay inside `bounds`.
 *
 * Labels also keep off every obstacle they don't own. Where a label can find no such place on the
 * screen, it only keeps off the other labels, as if there were no obstacles.
 *
 * Labels lower on the screen (nearer the camera) are placed first and keep their spot; each later one
 * takes the nearest free place beside or above those already placed. `previous` is the last answer:
 * a label stays where it was when that is still nearly as good, so labels don't hop about as
 * characters walk.
 */
export function spreadLabels(boxes: LabelBox[], bounds: Bounds, previous: (Offset | undefined)[] = [], { gap = LABEL_GAP, obstacles = [] }: SpreadOptions = {}): Offset[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].y + boxes[b].h - (boxes[a].y + boxes[a].h) || a - b);
  const out: Offset[] = boxes.map(() => ({ dx: 0, dy: 0 }));
  const placed: { x: number; y: number; box: LabelBox }[] = [];

  for (const i of order) {
    const b = boxes[i];
    const maxX = bounds.right - b.w;
    const maxY = bounds.bottom - b.h;
    const xs = [clamp(b.x, bounds.left, maxX)];
    const ys = [clamp(b.y, bounds.top, maxY)];
    for (const p of placed) {
      xs.push(p.x - gap - b.w, p.x + p.box.w + gap);
      ys.push(p.y - gap - b.h, p.y + p.box.h + gap);
    }
    const blocks = obstacles.filter((o) => o.owner !== i).map((o) => o.box);
    for (const o of blocks) {
      xs.push(o.x - gap - b.w, o.x + o.w + gap);
      ys.push(o.y - gap - b.h, o.y + o.h + gap);
    }
    const prev = previous[i];
    if (prev) {
      xs.push(b.x + prev.dx);
      ys.push(b.y + prev.dy);
    }

    // Best place clear of labels and obstacles, and best place clear of labels alone.
    let best: { x: number; y: number; c: number } | null = null;
    let fallback: { x: number; y: number; c: number } | null = null;
    for (const x of xs) {
      if (x < bounds.left - 0.5 || x > maxX + 0.5) continue;
      for (const y of ys) {
        if (y < bounds.top - 0.5 || y > maxY + 0.5) continue;
        if (placed.some((p) => overlaps(x, y, b, p.x, p.y, p.box, gap - 0.01))) continue;
        let c = cost(x - b.x, y - b.y);
        // Staying put is worth a little, so two nearly equal places don't trade back and forth.
        if (prev && Math.abs(x - b.x - prev.dx) < 2 && Math.abs(y - b.y - prev.dy) < 2) c = c * 0.8 - 2;
        if (!fallback || c < fallback.c) fallback = { x, y, c };
        if (blocks.some((o) => overlaps(x, y, b, o.x, o.y, o, gap - 0.01))) continue;
        if (!best || c < best.c) best = { x, y, c };
      }
    }
    best ??= fallback;
    // No free place at all (far more labels than screen): leave it where it wants to be.
    const at = best ?? { x: xs[0], y: ys[0] };
    out[i] = { dx: at.x - b.x, dy: at.y - b.y };
    placed.push({ x: at.x, y: at.y, box: b });
  }
  return out;
}
