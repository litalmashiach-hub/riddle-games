import type { RiddleRules, RiddleStatus } from '@riddle/engine';

/**
 * Moonbeam Mirrors: a moonbeam enters a grid of lily pads. Crystal mirrors sit on some pads and
 * can be turned between "/" and "\". Light up every moon-flower at once without the beam ever
 * touching the sleeping toad, and before the moon sets.
 */

/** Columns run left to right (x), rows run back to front (z, row 0 is the far row). */
export const COLS = 5;
export const ROWS = 5;

export type Dir = 'N' | 'E' | 'S' | 'W';
export const STEP: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

/** "/" mirrors and "\" mirrors. Turning a crystal swaps them. */
export type Tilt = '/' | '\\';
const BOUNCE: Record<Tilt, Record<Dir, Dir>> = {
  '/': { E: 'N', N: 'E', W: 'S', S: 'W' },
  '\\': { E: 'S', S: 'E', W: 'N', N: 'W' },
};

export interface Cell {
  c: number;
  r: number;
}

export interface Layout {
  /** The beam starts just outside the grid at this cell's edge and enters heading `dir`. */
  source: Cell & { dir: Dir };
  mirrors: (Cell & { start: Tilt })[];
  flowers: Cell[];
  toad: Cell;
  /** Mossy rocks swallow the beam. */
  rocks: Cell[];
  /** Turns before the moon sets. */
  maxTurns: number;
}

export const LAYOUT: Layout = {
  source: { c: -1, r: 2, dir: 'E' },
  mirrors: [
    { c: 4, r: 0, start: '/' },
    { c: 0, r: 1, start: '/' },
    { c: 2, r: 1, start: '\\' },
    { c: 1, r: 2, start: '/' },
    { c: 2, r: 3, start: '/' },
    { c: 4, r: 3, start: '\\' },
    { c: 0, r: 4, start: '/' },
    { c: 1, r: 4, start: '\\' },
  ],
  flowers: [
    { c: 2, r: 0 },
    { c: 3, r: 0 },
    { c: 0, r: 2 },
    { c: 2, r: 2 },
  ],
  toad: { c: 4, r: 4 },
  rocks: [{ c: 3, r: 1 }],
  maxTurns: 10,
};

export interface State {
  /** One tilt per mirror, in LAYOUT.mirrors order. */
  tilts: Tilt[];
  turns: number;
}

export interface Move {
  mirror: number;
}

/** One straight piece of the beam, from cell centre to cell centre (ends may sit on the grid edge). */
export interface BeamSeg {
  from: [number, number];
  to: [number, number];
}

export interface Trace {
  segs: BeamSeg[];
  /** Indexes into LAYOUT.flowers that the beam touches. */
  lit: number[];
  /** How the beam ends. */
  end: 'toad' | 'rock' | 'edge' | 'loop';
  /** Mirrors the beam bounced off, in order. */
  bounced: number[];
}

const same = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;

export function trace(state: State, layout: Layout = LAYOUT): Trace {
  let c = layout.source.c;
  let r = layout.source.r;
  let dir = layout.source.dir;
  const segs: BeamSeg[] = [];
  const lit = new Set<number>();
  const bounced: number[] = [];
  const seen = new Set<string>();
  let start: [number, number] = [c + STEP[dir][0] * 0.5, r + STEP[dir][1] * 0.5];
  for (let guard = 0; guard < 200; guard++) {
    c += STEP[dir][0];
    r += STEP[dir][1];
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) {
      segs.push({ from: start, to: [c - STEP[dir][0] * 0.5, r - STEP[dir][1] * 0.5] });
      return { segs, lit: [...lit], end: 'edge', bounced };
    }
    const here = { c, r };
    if (same(here, layout.toad)) {
      segs.push({ from: start, to: [c, r] });
      return { segs, lit: [...lit], end: 'toad', bounced };
    }
    if (layout.rocks.some((k) => same(k, here))) {
      segs.push({ from: start, to: [c - STEP[dir][0] * 0.35, r - STEP[dir][1] * 0.35] });
      return { segs, lit: [...lit], end: 'rock', bounced };
    }
    const f = layout.flowers.findIndex((k) => same(k, here));
    if (f >= 0) lit.add(f);
    const m = layout.mirrors.findIndex((k) => same(k, here));
    if (m >= 0) {
      const k = `${c},${r},${dir}`;
      if (seen.has(k)) {
        segs.push({ from: start, to: [c, r] });
        return { segs, lit: [...lit], end: 'loop', bounced };
      }
      seen.add(k);
      segs.push({ from: start, to: [c, r] });
      start = [c, r];
      bounced.push(m);
      dir = BOUNCE[state.tilts[m]][dir];
    }
  }
  return { segs, lit: [...lit], end: 'loop', bounced };
}

export function makeRules(layout: Layout): RiddleRules<State, Move> {
  return {
    initialState: { tilts: layout.mirrors.map((m) => m.start), turns: 0 },
    legalMoves: () => layout.mirrors.map((_, mirror) => ({ mirror })),
    apply: (s, { mirror }) => ({
      tilts: s.tilts.map((t, i) => (i === mirror ? (t === '/' ? '\\' : '/') : t)),
      turns: s.turns + 1,
    }),
    status(s): RiddleStatus {
      const t = trace(s, layout);
      if (t.end === 'toad') return { kind: 'lost', reason: 'The moonbeam tickled the sleeping toad. AH-CHOO!' };
      if (t.lit.length === layout.flowers.length) return { kind: 'won' };
      if (s.turns >= layout.maxTurns) return { kind: 'lost', reason: 'The moon has set before every flower could bloom.' };
      return { kind: 'playing' };
    },
    key: (s) => s.tilts.join('') + '|' + s.turns,
    describeMove: ({ mirror }) => `Turn the crystal on row ${layout.mirrors[mirror].r + 1}, column ${layout.mirrors[mirror].c + 1}`,
  };
}

export const rules = makeRules(LAYOUT);
