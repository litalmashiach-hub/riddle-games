import type { RiddleRules } from '@riddle/engine';

/**
 * A 3x3 sliding-tile mosaic (the classic 8-puzzle).
 * Cells are numbered 0..8, row by row from the top-left (the back-left corner on the table).
 * `tiles[cell]` is the tile in that cell: 1..8 are picture pieces, 0 is the empty gap.
 * Solved: 1 2 3 / 4 5 6 / 7 8 _ .
 */
export interface State {
  tiles: readonly number[];
  /** Slides made so far. Shelly the turtle only waits for MAX_SLIDES. */
  slides: number;
}

/** Slide the tile that sits in this cell into the gap. */
export interface Move {
  cell: number;
}

export const SIZE = 3;
export const SOLVED: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
/** 18 slides from solved (proved by the test). The gap starts in the middle. */
export const START: readonly number[] = [7, 5, 2, 8, 0, 3, 1, 4, 6];
/** Shelly's patience. One more slide than this and she nods off. */
export const MAX_SLIDES = 60;

export const rowOf = (cell: number) => Math.floor(cell / SIZE);
export const colOf = (cell: number) => cell % SIZE;

/** Cells next to `cell` (up, down, left, right). */
export function neighbours(cell: number): number[] {
  const r = rowOf(cell);
  const c = colOf(cell);
  const out: number[] = [];
  if (r > 0) out.push(cell - SIZE);
  if (r < SIZE - 1) out.push(cell + SIZE);
  if (c > 0) out.push(cell - 1);
  if (c < SIZE - 1) out.push(cell + 1);
  return out;
}

export const gapOf = (s: State) => s.tiles.indexOf(0);
export const canSlide = (s: State, cell: number) => s.tiles[cell] !== 0 && neighbours(gapOf(s)).includes(cell);
export const isSolved = (tiles: readonly number[]) => tiles.every((t, i) => t === SOLVED[i]);
/** How many picture pieces already sit in their home cell (for the scene's sparkles). */
export const placed = (tiles: readonly number[]) => tiles.filter((t, i) => t !== 0 && t === SOLVED[i]).length;

const DIRS = ['down', 'up', 'right', 'left'] as const;
/** Which way a tile in `cell` moves to reach the gap. */
export function slideDir(s: State, cell: number): (typeof DIRS)[number] {
  const gap = gapOf(s);
  if (gap === cell + SIZE) return 'down';
  if (gap === cell - SIZE) return 'up';
  if (gap === cell + 1) return 'right';
  return 'left';
}

export const rules: RiddleRules<State, Move> = {
  initialState: { tiles: START, slides: 0 },

  legalMoves(s) {
    return neighbours(gapOf(s)).map((cell) => ({ cell }));
  },

  apply(s, { cell }) {
    const gap = gapOf(s);
    const tiles = [...s.tiles];
    tiles[gap] = tiles[cell];
    tiles[cell] = 0;
    return { tiles, slides: s.slides + 1 };
  },

  status(s) {
    if (isSolved(s.tiles)) return { kind: 'won' };
    if (s.slides >= MAX_SLIDES) return { kind: 'lost', reason: `Shelly waited ${MAX_SLIDES} slides for her portrait and fell fast asleep. Splash!` };
    return { kind: 'playing' };
  },

  // The solver does a breadth-first search, so the first time it meets a picture is always the
  // fewest slides. That is why `slides` can be left out of the key.
  key: (s) => s.tiles.join(''),

  describeMove({ cell }, s) {
    // Directions as the player sees them: row 0 is at the back of the table.
    const dir = { down: 'towards you', up: 'away from you', right: 'right', left: 'left' }[slideDir(s, cell)];
    return `Slide tile ${s.tiles[cell]} ${dir}`;
  },
};
