import type { RiddleRules } from '@riddle/engine';

/** G = green frog (faces right), O = orange frog (faces left), . = empty pad. */
export type Cell = 'G' | 'O' | '.';
/** Seven lily pads in a row, left to right. */
export type State = string;

/** Move the frog sitting on pad `from`. Each frog has at most one possible move. */
export interface Move {
  from: number;
}

export const PADS = 7;
export const START: State = 'GGG.OOO';
export const GOAL: State = 'OOO.GGG';

/** Which way a frog faces: +1 is right, -1 is left. */
export const facing = (c: Cell) => (c === 'G' ? 1 : -1);

/** Where the frog on pad `from` would land, or null if it cannot move. */
export function target(s: State, from: number): number | null {
  const c = s[from] as Cell;
  if (c === '.') return null;
  const d = facing(c);
  const one = from + d;
  if (one < 0 || one >= PADS) return null;
  if (s[one] === '.') return one;
  // Leap over a frog that is looking at you, into an empty pad right behind it.
  const two = from + 2 * d;
  if (s[one] !== c && two >= 0 && two < PADS && s[two] === '.') return two;
  return null;
}

export const isJump = (s: State, m: Move) => {
  const t = target(s, m.from);
  return t != null && Math.abs(t - m.from) === 2;
};

/** Pairs of pads where two frogs stand nose to nose (green on the left, orange on the right). */
export function noseToNose(s: State): number[] {
  const out: number[] = [];
  for (let i = 0; i < PADS - 1; i++) if (s[i] === 'G' && s[i + 1] === 'O') out.push(i);
  return out;
}

const NAME: Record<'G' | 'O', string> = { G: 'green', O: 'orange' };

export const rules: RiddleRules<State, Move> = {
  initialState: START,

  legalMoves(s) {
    const moves: Move[] = [];
    for (let i = 0; i < PADS; i++) if (target(s, i) != null) moves.push({ from: i });
    return moves;
  },

  apply(s, m) {
    const t = target(s, m.from);
    if (t == null) return s;
    const a = s.split('');
    a[t] = a[m.from];
    a[m.from] = '.';
    return a.join('');
  },

  status(s) {
    if (s === GOAL) return { kind: 'won' };
    if (rules.legalMoves(s).length === 0) return { kind: 'lost', reason: 'The frogs are stuck nose to nose and nobody can hop! BONK!' };
    return { kind: 'playing' };
  },

  key: (s) => s,

  describeMove(m, s) {
    const c = s[m.from] as 'G' | 'O';
    const other = c === 'G' ? 'O' : 'G';
    return isJump(s, m) ? `The ${NAME[c]} frog on pad ${m.from + 1} leaps over the ${NAME[other]} frog` : `The ${NAME[c]} frog on pad ${m.from + 1} hops forward`;
  },
};
