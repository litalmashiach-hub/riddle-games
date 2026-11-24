import type { RiddleRules } from '@riddle/engine';

/**
 * Cricket Swap (the "four knights" puzzle, first written down by Paolo Guarini in 1512).
 *
 * Nine toadstools stand in a 3 x 3 square. Two amber crickets sit on the back corners and two blue crickets
 * on the front corners. A cricket leaps like a chess knight: two toadstools straight and one to the side,
 * and only onto an empty toadstool. Make the two colours swap sides.
 *
 * The middle toadstool can never be reached, so the other eight really form one ring, and the crickets
 * chase each other around it. Seeing that ring is the trick.
 *
 * Cells are numbered row by row: 0 1 2 is the back row (far from the camera), 6 7 8 the front row.
 */
export const SIZE = 3;
export const CELLS = SIZE * SIZE;
export type Colour = 'A' | 'B';
export const COLOUR_NAME: Record<Colour, string> = { A: 'amber', B: 'blue' };

export interface State {
  /** One character per cell: 'A' amber cricket, 'B' blue cricket, '.' empty. */
  board: string;
}

export interface Move {
  from: number;
  to: number;
}

export const START = 'A.A...B.B';
export const GOAL = 'B.B...A.A';

/** A patch of toadstools and who sits where. Level 21 uses `BOARD`; a level that reuses this scene brings its own. */
export interface Board {
  cols: number;
  rows: number;
  start: string;
  goal: string;
  /** Toadstools nobody can land on (they hold a firefly jar). */
  jars: number[];
}
export const BOARD: Board = { cols: SIZE, rows: SIZE, start: START, goal: GOAL, jars: [4] };

/** The cells a cricket on `cell` could leap to, like a chess knight. */
export function leaps(cell: number, board: Board = BOARD): number[] {
  const r = Math.floor(cell / board.cols);
  const c = cell % board.cols;
  const out: number[] = [];
  for (let to = 0; to < board.cols * board.rows; to++) {
    const dr = Math.abs(Math.floor(to / board.cols) - r);
    const dc = Math.abs((to % board.cols) - c);
    if (dr * dc === 2 && !board.jars.includes(to)) out.push(to);
  }
  return out;
}

/** Empty toadstools the cricket on `cell` can leap to right now. */
export const freeLeaps = (s: State, cell: number, board: Board = BOARD) => (s.board[cell] === '.' ? [] : leaps(cell, board).filter((to) => s.board[to] === '.'));

const ROW = ['back', 'middle', 'front'];
const ROW4 = ['back', 'second', 'third', 'front'];
const COL = ['left', 'middle', 'right'];
export const cellName = (cell: number, board: Board = BOARD) => `${(board.rows === 4 ? ROW4 : ROW)[Math.floor(cell / board.cols)]} ${COL[cell % board.cols]}`;

/** The swap on any board. */
export function makeRules(board: Board): RiddleRules<State, Move> {
  return {
    initialState: { board: board.start },
    legalMoves: (s) => {
      const out: Move[] = [];
      for (let from = 0; from < board.cols * board.rows; from++) for (const to of freeLeaps(s, from, board)) out.push({ from, to });
      return out;
    },
    apply: (s, m) => {
      const b = s.board.split('');
      b[m.to] = b[m.from];
      b[m.from] = '.';
      return { board: b.join('') };
    },
    status: (s) => (s.board === board.goal ? { kind: 'won' } : { kind: 'playing' }),
    key: (s) => s.board,
    describeMove: (m, s) => `Leap the ${COLOUR_NAME[s.board[m.from] as Colour]} cricket from the ${cellName(m.from, board)} toadstool to the ${cellName(m.to, board)} one`,
  };
}

export const rules = makeRules(BOARD);
