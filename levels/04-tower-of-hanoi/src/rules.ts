import type { RiddleRules } from '@riddle/engine';

/** Number of discs. Disc sizes are 1 (smallest) to DISCS (largest). */
export const DISCS = 4;
export type Peg = 0 | 1 | 2;
export const PEGS: Peg[] = [0, 1, 2];

/** Each pillar's stack, bottom disc first. */
export interface State {
  pegs: [number[], number[], number[]];
}

/** Move the top disc of one pillar onto another. */
export interface Move {
  from: Peg;
  to: Peg;
}

export const PEG_NAMES = ['left', 'middle', 'right'] as const;

export const top = (s: State, p: Peg): number | undefined => s.pegs[p][s.pegs[p].length - 1];

/** Can the top disc of `from` go onto `to`? Never a bigger disc on a smaller one. */
export function canMove(s: State, from: Peg, to: Peg): boolean {
  if (from === to) return false;
  const d = top(s, from);
  if (d === undefined) return false;
  const t = top(s, to);
  return t === undefined || t > d;
}

/** The tower with any number of discs. */
export function makeRules(discs: number): RiddleRules<State, Move> {
  return {
    initialState: { pegs: [Array.from({ length: discs }, (_, i) => discs - i), [], []] },

    legalMoves(s) {
      const moves: Move[] = [];
      for (const from of PEGS) for (const to of PEGS) if (canMove(s, from, to)) moves.push({ from, to });
      return moves;
    },

    apply(s, m) {
      const pegs = s.pegs.map((p) => p.slice()) as State['pegs'];
      const d = pegs[m.from].pop();
      if (d !== undefined) pegs[m.to].push(d);
      return { pegs };
    },

    // No way to lose: illegal moves are never offered. The goal is the whole tower on the right pillar.
    status: (s) => (s.pegs[2].length === discs ? { kind: 'won' } : { kind: 'playing' }),

    key: (s) => s.pegs.map((p) => p.join('')).join('|'),

    describeMove(m, s) {
      const d = top(s, m.from);
      const name = d === 1 ? 'the smallest disc' : d === discs ? 'the biggest disc' : `disc ${d}`;
      return `Move ${name} from the ${PEG_NAMES[m.from]} pillar to the ${PEG_NAMES[m.to]} pillar`;
    },
  };
}

export const rules = makeRules(DISCS);
