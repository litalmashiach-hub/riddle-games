import type { RiddleRules } from '@riddle/engine';

/**
 * The frozen pond, row 0 is the far side (away from the camera), row 6 is nearest.
 *   .  ice        R  rock (stops the otter in front of it)
 *   S  snow drift (the otter plows in and stops on it)
 *   H  ice hole (the otter falls in: splash!)
 *   G  fish basket (the goal; the otter stops when it bumps into it)
 *   O  where the otter starts (plain ice)
 * The pond's snowy rim stops the otter too.
 */
export const BOARD = [
  '.R..G.H', //
  '...R.R.',
  'HS.....',
  '.....R.',
  '...R..R',
  'R......',
  '.H.O...',
];

export const SIZE = BOARD.length;
export type Cell = '.' | 'R' | 'S' | 'H' | 'G';
export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
export const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export interface State {
  x: number;
  y: number;
}
export interface Move {
  dir: Dir;
}

export const cellAt = (x: number, y: number): Cell => {
  const c = BOARD[y][x];
  return (c === 'O' ? '.' : c) as Cell;
};

function find(ch: string): State {
  for (let y = 0; y < SIZE; y++) {
    const x = BOARD[y].indexOf(ch);
    if (x >= 0) return { x, y };
  }
  throw new Error(`no ${ch} on the board`);
}

export const START = find('O');
export const BASKET = find('G');

/** Every cell of a given kind, for the scene. */
export function cellsOf(kind: Cell): State[] {
  const out: State[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (cellAt(x, y) === kind) out.push({ x, y });
  return out;
}

/** What stopped a slide. */
export type Stopper = 'rock' | 'edge' | 'snow' | 'hole' | 'basket';

export interface Slide {
  to: State;
  /** Cells travelled. 0 means the otter cannot move that way. */
  steps: number;
  stopper: Stopper;
}

/** Where the otter ends up if it slides from `s` in direction `dir`. */
export function slide(s: State, dir: Dir): Slide {
  const [dx, dy] = STEP[dir];
  let x = s.x;
  let y = s.y;
  let steps = 0;
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return { to: { x, y }, steps, stopper: 'edge' };
    const c = cellAt(nx, ny);
    if (c === 'R') return { to: { x, y }, steps, stopper: 'rock' };
    x = nx;
    y = ny;
    steps++;
    if (c === 'S') return { to: { x, y }, steps, stopper: 'snow' };
    if (c === 'H') return { to: { x, y }, steps, stopper: 'hole' };
    if (c === 'G') return { to: { x, y }, steps, stopper: 'basket' };
  }
}

const ARROW: Record<Dir, string> = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };

export const rules: RiddleRules<State, Move> = {
  initialState: START,
  legalMoves: (s) => DIRS.filter((dir) => slide(s, dir).steps > 0).map((dir) => ({ dir })),
  apply: (s, m) => slide(s, m.dir).to,
  status: (s) => {
    const c = cellAt(s.x, s.y);
    if (c === 'H') return { kind: 'lost', reason: 'Splash! The otter slid straight into an ice hole. Brrr!' };
    if (c === 'G') return { kind: 'won' };
    return { kind: 'playing' };
  },
  key: (s) => `${s.x},${s.y}`,
  describeMove: (m) => `Slide ${m.dir} ${ARROW[m.dir]}`,
};
