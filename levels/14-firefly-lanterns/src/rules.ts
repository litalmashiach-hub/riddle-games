import type { RiddleRules } from '@riddle/engine';

/**
 * Firefly Lanterns (a "Lights Out" puzzle).
 *
 * Nine lanterns stand on lily pads in a 3 x 3 grid. Tapping a pad flips that lantern and the
 * lanterns straight in front, behind, left and right of it (not diagonals). Light all nine.
 * The fireflies get sleepy: after MAX_TAPS taps without success they doze off and the level is lost.
 *
 * Cells are numbered row by row: 0 1 2 is the back row (far from the camera), 6 7 8 the front row.
 */
export const SIZE = 3;
export const CELLS = SIZE * SIZE;
export const ALL_LIT = (1 << CELLS) - 1;
export const MAX_TAPS = 12;

export interface State {
  /** Bit i set = lantern i is lit. */
  lit: number;
  taps: number;
  /** Pad the frog stands on (-1 = still on the bank). Only for the scene. */
  frog: number;
}

export interface Move {
  cell: number;
}

/** The cells a tap on `cell` flips: itself plus its up/down/left/right neighbours. */
export function flipMask(cell: number): number {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  let m = 1 << cell;
  if (r > 0) m |= 1 << (cell - SIZE);
  if (r < SIZE - 1) m |= 1 << (cell + SIZE);
  if (c > 0) m |= 1 << (cell - 1);
  if (c < SIZE - 1) m |= 1 << (cell + 1);
  return m;
}

export const isLit = (s: State, cell: number) => ((s.lit >> cell) & 1) === 1;

/**
 * Starting lanterns: the ones lit by tapping the cells below starting from "all lit".
 * Because each tap undoes itself, the unique shortest solution is to tap exactly these 6 cells.
 */
export const SOLUTION_CELLS = [0, 1, 4, 5, 6, 8];
const START = SOLUTION_CELLS.reduce((lit, c) => lit ^ flipMask(c), ALL_LIT);

const ROW = ['back', 'middle', 'front'];
const COL = ['left', 'middle', 'right'];
export function cellName(cell: number) {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  if (r === 1 && c === 1) return 'centre';
  return `${ROW[r]} ${COL[c]}`;
}

export const rules: RiddleRules<State, Move> = {
  initialState: { lit: START, taps: 0, frog: -1 },
  legalMoves: () => Array.from({ length: CELLS }, (_, cell) => ({ cell })),
  apply: (s, m) => ({ lit: s.lit ^ flipMask(m.cell), taps: s.taps + 1, frog: m.cell }),
  status: (s) => {
    if (s.lit === ALL_LIT) return { kind: 'won' };
    if (s.taps >= MAX_TAPS) return { kind: 'lost', reason: `The fireflies got too sleepy after ${MAX_TAPS} taps and dozed off!` };
    return { kind: 'playing' };
  },
  key: (s) => `${s.lit}|${s.taps}`,
  describeMove: (m) => `Tap the ${cellName(m.cell)} lily pad`,
};
