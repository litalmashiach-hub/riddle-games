import type { RiddleRules } from '@riddle/engine';

/** Number of cogs in the tower. Cog 0 is the smallest. */
export const COGS = 6;
/** Number of pillars. The tower starts on pillar 0 and must end on pillar 3. */
export const PILLARS = 4;
export const GOAL = PILLARS - 1;

/** `peg[c]` is the pillar that cog `c` sits on. */
export interface State {
  peg: number[];
}

/** Lift the top cog off one pillar and drop it on another. */
export interface Move {
  from: number;
  to: number;
}

export const PILLAR_NAMES = ['first', 'second', 'third', 'fourth'];

/** The smallest cog on a pillar (its top cog), or -1 if the pillar is empty. */
export function topCog(s: State, pillar: number): number {
  for (let c = 0; c < COGS; c++) if (s.peg[c] === pillar) return c;
  return -1;
}

/** How many cogs sit under cog `c` (0 = on the floor of its pillar). */
export function levelOf(s: State, c: number): number {
  let n = 0;
  for (let d = c + 1; d < COGS; d++) if (s.peg[d] === s.peg[c]) n++;
  return n;
}

/** Can the top cog of `from` go onto `to`? */
export function canMove(s: State, from: number, to: number): boolean {
  if (from === to) return false;
  const c = topCog(s, from);
  if (c < 0) return false;
  const under = topCog(s, to);
  return under < 0 || under > c;
}

export const rules: RiddleRules<State, Move> = {
  initialState: { peg: Array.from({ length: COGS }, () => 0) },

  legalMoves(s) {
    const moves: Move[] = [];
    for (let from = 0; from < PILLARS; from++)
      for (let to = 0; to < PILLARS; to++) if (canMove(s, from, to)) moves.push({ from, to });
    return moves;
  },

  apply(s, m) {
    const c = topCog(s, m.from);
    const peg = s.peg.slice();
    if (c >= 0) peg[c] = m.to;
    return { peg };
  },

  status(s) {
    return s.peg.every((p) => p === GOAL) ? { kind: 'won' } : { kind: 'playing' };
  },

  key: (s) => s.peg.join(''),

  describeMove(m, s) {
    const c = topCog(s, m.from);
    return `Move the ${SIZE_NAMES[c] ?? 'top'} cog from the ${PILLAR_NAMES[m.from]} pillar to the ${PILLAR_NAMES[m.to]}`;
  },
};

export const SIZE_NAMES = ['tiny red', 'small orange', 'yellow', 'green', 'blue', 'big purple'];
