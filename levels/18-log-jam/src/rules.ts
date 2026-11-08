import type { RiddleRules } from '@riddle/engine';

/** The pond is a 6 x 6 grid. Rows run back (0) to front (5), columns left (0) to right (5). */
export const SIZE = 6;
/** The duck raft floats in this row. The gap in the bank is at its right end. */
export const EXIT_ROW = 2;

export interface Piece {
  /** 'h' slides left/right along its row, 'v' slides back/forward along its column. */
  axis: 'h' | 'v';
  len: 2 | 3;
  /** The row of an 'h' piece, or the column of a 'v' piece. Never changes. */
  line: number;
  /** A little character or decoration riding on this log (pure looks). */
  rider?: 'frog' | 'snail' | 'mushrooms' | 'flowers';
}

/**
 * Piece 0 is Dottie's raft. The rest are logs. An original layout, checked by the
 * tests to need exactly `BEST_MOVES` slides.
 */
export const PIECES: Piece[] = [
  { axis: 'h', len: 2, line: EXIT_ROW },
  { axis: 'v', len: 2, line: 1 },
  { axis: 'v', len: 2, line: 5 },
  { axis: 'v', len: 2, line: 5, rider: 'mushrooms' },
  { axis: 'v', len: 2, line: 0 },
  { axis: 'v', len: 3, line: 4, rider: 'mushrooms' },
  { axis: 'h', len: 2, line: 4 },
  { axis: 'v', len: 3, line: 2, rider: 'frog' },
  { axis: 'h', len: 2, line: 0 },
  { axis: 'h', len: 2, line: 0, rider: 'snail' },
  { axis: 'h', len: 2, line: 5, rider: 'flowers' },
];

/** Where each piece starts: the column of an 'h' piece's left end, or the row of a 'v' piece's back end. */
export const START: number[] = [0, 4, 1, 3, 3, 1, 2, 1, 3, 1, 2];

/** Dottie's patience: after this many slides she tries to waddle home over the logs. */
export const PATIENCE = 50;

export interface State {
  /** Left column (h) or back row (v) of every piece. */
  pos: number[];
  moves: number;
}

/** Slide one piece to a new position. Any distance along its line counts as one move. */
export interface Move {
  piece: number;
  to: number;
}

/** The cells a piece covers when its start is at `p`. */
export function cells(piece: Piece, p: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < piece.len; k++) out.push(piece.axis === 'h' ? [piece.line, p + k] : [p + k, piece.line]);
  return out;
}

/** Grid of piece indexes (-1 = open water). */
export function grid(pos: number[]): number[] {
  const g = new Array(SIZE * SIZE).fill(-1);
  PIECES.forEach((pc, i) => cells(pc, pos[i]).forEach(([r, c]) => (g[r * SIZE + c] = i)));
  return g;
}

/** Every position piece `i` can slide to from here (not counting where it is). */
export function reach(pos: number[], i: number): number[] {
  const g = grid(pos);
  const pc = PIECES[i];
  const out: number[] = [];
  for (const d of [-1, 1]) {
    let p = pos[i];
    for (;;) {
      const np = p + d;
      if (np < 0 || np + pc.len > SIZE) break;
      const lead = d < 0 ? np : np + pc.len - 1;
      const [r, c] = pc.axis === 'h' ? [pc.line, lead] : [lead, pc.line];
      if (g[r * SIZE + c] !== -1) break;
      p = np;
      out.push(p);
    }
  }
  return out;
}

/** The raft is home when it touches the gap at the right edge. */
export const isFree = (pos: number[]) => pos[0] === SIZE - PIECES[0].len;

export const NAMES = (i: number) => (i === 0 ? 'the duck raft' : PIECES[i].len === 3 ? 'the long log' : 'the log');

export const rules: RiddleRules<State, Move> = {
  initialState: { pos: START, moves: 0 },

  legalMoves(s) {
    const out: Move[] = [];
    PIECES.forEach((_, i) => reach(s.pos, i).forEach((to) => out.push({ piece: i, to })));
    return out;
  },

  apply(s, m) {
    const pos = s.pos.slice();
    pos[m.piece] = m.to;
    return { pos, moves: s.moves + 1 };
  },

  status(s) {
    if (isFree(s.pos)) return { kind: 'won' };
    if (s.moves >= PATIENCE) return { kind: 'lost', reason: `Dottie ran out of patience after ${PATIENCE} slides and tried to hop home over the logs. Splash!` };
    return { kind: 'playing' };
  },

  // The move counter is left out: the solver only cares where the logs are.
  key: (s) => s.pos.join(','),

  describeMove(m, s) {
    const pc = PIECES[m.piece];
    const d = m.to - s.pos[m.piece];
    const steps = Math.abs(d);
    const dir = pc.axis === 'h' ? (d > 0 ? 'right' : 'left') : d > 0 ? 'down' : 'up';
    const where = pc.axis === 'h' ? `in row ${pc.line + 1}` : `in column ${pc.line + 1}`;
    const what = m.piece === 0 ? 'the duck raft' : `${NAMES(m.piece)} ${where}`;
    return `Slide ${what} ${dir} ${steps} space${steps > 1 ? 's' : ''}`;
  },
};
