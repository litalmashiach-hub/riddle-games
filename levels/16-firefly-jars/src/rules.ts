import type { RiddleRules } from '@riddle/engine';

/** Firefly colours. Each colour has exactly CAPACITY fireflies. */
export type Color = 'gold' | 'pink' | 'mint' | 'sky';
export const COLORS: Color[] = ['gold', 'pink', 'mint', 'sky'];
export const COLOR_NAMES: Record<Color, string> = { gold: 'gold', pink: 'pink', mint: 'green', sky: 'blue' };

/** How many fireflies fit in one jar. */
export const CAPACITY = 4;

/** Jar contents, bottom first. */
export type Jar = Color[];

export interface State {
  jars: Jar[];
  /** Moves made so far. The fireflies only have so much patience. */
  moves: number;
}

/** Move the top firefly of jar `from` onto jar `to`. */
export interface Move {
  from: number;
  to: number;
}

export const START: Jar[] = [
  ['pink', 'mint', 'pink', 'sky'],
  ['mint', 'gold', 'sky', 'pink'],
  ['gold', 'mint', 'sky', 'gold'],
  ['mint', 'sky', 'pink', 'gold'],
  [],
  [],
];

/** Shortest solution length (checked by the test). */
export const BEST = 16;
/** After this many moves without solving, the fireflies have had enough. */
export const PATIENCE = 30;

export const top = (j: Jar): Color | undefined => j[j.length - 1];

export function canMove(s: State, m: Move): boolean {
  if (m.from === m.to) return false;
  const a = s.jars[m.from];
  const b = s.jars[m.to];
  if (!a || !b || a.length === 0 || b.length >= CAPACITY) return false;
  return b.length === 0 || top(b) === top(a);
}

export const isSorted = (jars: Jar[]) => jars.every((j) => j.length === 0 || (j.length === CAPACITY && j.every((c) => c === j[0])));

/** Jars that are full of one colour (for glow and sounds). */
export const isDone = (j: Jar) => j.length === CAPACITY && j.every((c) => c === j[0]);

export const rules: RiddleRules<State, Move> = {
  initialState: { jars: START, moves: 0 },

  legalMoves(s) {
    const out: Move[] = [];
    for (let from = 0; from < s.jars.length; from++) {
      for (let to = 0; to < s.jars.length; to++) {
        const m = { from, to };
        if (!canMove(s, m)) continue;
        // Moving a lone firefly from one jar into an empty one changes nothing useful.
        if (s.jars[from].length === 1 && s.jars[to].length === 0) continue;
        out.push(m);
      }
    }
    return out;
  },

  apply(s, m) {
    const jars = s.jars.map((j) => j.slice());
    const c = jars[m.from].pop()!;
    jars[m.to].push(c);
    return { jars, moves: s.moves + 1 };
  },

  status(s) {
    if (isSorted(s.jars)) return { kind: 'won' };
    if (s.moves >= PATIENCE) return { kind: 'lost', reason: `The fireflies got grumpy after ${PATIENCE} moves and buzzed off!` };
    return { kind: 'playing' };
  },

  // Jars are interchangeable for the solver, and the move count is not part of the puzzle.
  key: (s) => s.jars.map((j) => j.join('')).sort().join('|'),

  describeMove(m, s) {
    const c = top(s.jars[m.from]);
    const name = c ? COLOR_NAMES[c] : '';
    const to = s.jars[m.to];
    return to.length === 0 ? `Move a ${name} firefly into an empty jar` : `Move a ${name} firefly onto the ${name} ones`;
  },
};
