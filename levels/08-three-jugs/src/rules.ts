import type { RiddleRules } from '@riddle/engine';

/** Flask index: 0 = the 8 L flask, 1 = the 5 L flask, 2 = the 3 L flask. */
export type Flask = 0 | 1 | 2;
export const FLASKS: Flask[] = [0, 1, 2];
export const CAPACITY: readonly [number, number, number] = [8, 5, 3];
export const GOAL = 4;

/** Litres of potion in each flask. */
export type State = readonly [number, number, number];

/** Pour from one flask into another until the source is empty or the target is full. */
export interface Move {
  from: Flask;
  to: Flask;
}

export const NAMES: Record<Flask, string> = { 0: 'the 8 L flask', 1: 'the 5 L flask', 2: 'the 3 L flask' };

/** How many litres a pour would move. 0 means the pour is pointless (empty source or full target). */
export function pourAmount(s: State, from: Flask, to: Flask): number {
  if (from === to) return 0;
  return Math.min(s[from], CAPACITY[to] - s[to]);
}

export const rules: RiddleRules<State, Move> = {
  initialState: [8, 0, 0],

  legalMoves(s) {
    const moves: Move[] = [];
    for (const from of FLASKS) for (const to of FLASKS) if (pourAmount(s, from, to) > 0) moves.push({ from, to });
    return moves;
  },

  apply(s, m) {
    const n = pourAmount(s, m.from, m.to);
    const next = [s[0], s[1], s[2]] as [number, number, number];
    next[m.from] -= n;
    next[m.to] += n;
    return next;
  },

  status(s) {
    // Two flasks of exactly 4 L: that can only be the 8 L and the 5 L flask.
    if (s[0] === GOAL && s[1] === GOAL) return { kind: 'won' };
    return { kind: 'playing' };
  },

  key: (s) => s.join(','),

  describeMove(m, s) {
    const n = pourAmount(s, m.from, m.to);
    return `Pour ${NAMES[m.from]} into ${NAMES[m.to]} (${n} L)`;
  },
};
