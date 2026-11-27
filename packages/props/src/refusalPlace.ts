/*
 * Where a refusal note goes (RefusalMark.tsx): the plain sums, kept apart from three.js and the page so they
 * can be tested on their own.
 *
 * The note is first tried above the piece, then beside it and below it. Where each of those covers something
 * the player must still see (a Hint mark, or a button of the scene or the HUD), it is also tried pushed just
 * clear of each thing it covers, and a little further off. The first place that covers nothing wins; if every
 * place covers something, the one that covers least. Every place is kept wholly on the screen.
 */

/** A box on the screen, in pixels: left, top, right, bottom. */
export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** A place for the note: its bottom middle, in pixels. */
export interface Spot {
  x: number;
  y: number;
}

/** The least gap, in pixels, between the note and the screen's edge. */
export const EDGE = 8;
/** The gap, in pixels, kept between the note and a thing it steps aside from. */
export const CLEAR = 4;
/** The gap, in pixels, between the note and its piece when it goes beside or below it. */
const GAP = 10;

export const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/** The note's box when its bottom middle is at `s`. */
export const noteBox = (s: Spot, w: number, h: number): Box => ({ l: s.x - w / 2, r: s.x + w / 2, t: s.y - h, b: s.y });

/** A box grown by `by` pixels on every side. */
export const grow = (b: Box, by: number): Box => ({ l: b.l - by, t: b.t - by, r: b.r + by, b: b.b + by });

/**
 * Every place to try, best first. `top` is the piece's top middle (where the note's bottom sits by default),
 * `foot` how far down the screen its foot is; `w` and `h` the note's size; `width` and `height` the screen's;
 * `things` what the note must leave in view, each already grown by its clearance.
 */
export function spots(top: Spot, foot: number, w: number, h: number, width: number, height: number, things: Box[]): Spot[] {
  const fit = (x: number, y: number): Spot => ({
    x: Math.min(Math.max(x, EDGE + w / 2), Math.max(EDGE + w / 2, width - EDGE - w / 2)),
    y: Math.min(Math.max(y, EDGE + h), Math.max(EDGE + h, height - EDGE)),
  });
  const first = [
    fit(top.x, top.y),
    fit(top.x + GAP + w / 2, top.y + h / 2),
    fit(top.x - GAP - w / 2, top.y + h / 2),
    fit(top.x, foot + h + GAP),
  ];
  const more: Spot[] = [];
  for (const s of first) {
    const box = noteBox(s, w, h);
    for (const t of things) {
      if (!overlap(box, t)) continue;
      // Just clear of it, to each side, keeping the other axis.
      more.push(fit(t.l - w / 2, s.y), fit(t.r + w / 2, s.y), fit(s.x, t.t), fit(s.x, t.b + h));
    }
  }
  // A little further off: higher, and sideways along the top.
  for (const dx of [-w / 2, w / 2, -w, w]) more.push(fit(top.x + dx, top.y));
  more.push(fit(top.x, top.y - h - GAP), fit(top.x - w / 2, top.y - h - GAP), fit(top.x + w / 2, top.y - h - GAP));
  // Near ones first, so the note stays as close to its piece as it can.
  const d = (s: Spot) => (s.x - first[0].x) ** 2 + (s.y - first[0].y) ** 2;
  more.sort((a, b) => d(a) - d(b));
  const out: Spot[] = [];
  for (const s of [...first, ...more]) if (!out.some((o) => Math.abs(o.x - s.x) < 0.5 && Math.abs(o.y - s.y) < 0.5)) out.push(s);
  return out;
}

/** The first spot that covers nothing; else the one that covers least. `cost` is what a spot covers, in square pixels. */
export function pick(list: Spot[], cost: (s: Spot) => number): { spot: Spot; index: number; covered: number } {
  let best = { spot: list[0], index: 0, covered: Infinity };
  for (const [index, spot] of list.entries()) {
    const covered = cost(spot);
    if (covered < best.covered) best = { spot, index, covered };
    if (covered === 0) break;
  }
  return best;
}
