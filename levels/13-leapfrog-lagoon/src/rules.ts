import type { RiddleRules } from '@riddle/engine';

/** G = green frog (faces right), O = orange frog (faces left), . = empty pad. */
export type Cell = 'G' | 'O' | '.';
/** Seven lily pads in a row, left to right. */
export type State = string;

/** Move the frog sitting on pad `from`. Each frog has at most one possible move. */
export interface Move {
  from: number;
}

export const START: State = 'GGG.OOO';
/** The teams have swapped: every orange frog on the left, every green frog on the right. */
export const goalOf = (start: State): State => 'O'.repeat(start.split('O').length - 1) + '.' + 'G'.repeat(start.split('G').length - 1);
export const GOAL: State = goalOf(START);

/** Which way a frog faces: +1 is right, -1 is left. */
export const facing = (c: Cell) => (c === 'G' ? 1 : -1);

/** Where the frog on pad `from` would land, or null if it cannot move. */
export function target(s: State, from: number): number | null {
  const c = s[from] as Cell;
  if (c === '.') return null;
  const d = facing(c);
  const one = from + d;
  if (one < 0 || one >= s.length) return null;
  if (s[one] === '.') return one;
  // Leap over a frog that is looking at you, into an empty pad right behind it.
  const two = from + 2 * d;
  if (s[one] !== c && two >= 0 && two < s.length && s[two] === '.') return two;
  return null;
}

export const isJump = (s: State, m: Move) => {
  const t = target(s, m.from);
  return t != null && Math.abs(t - m.from) === 2;
};

/** Pairs of pads where two frogs stand nose to nose (green on the left, orange on the right). */
export function noseToNose(s: State): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length - 1; i++) if (s[i] === 'G' && s[i + 1] === 'O') out.push(i);
  return out;
}

const NAME: Record<'G' | 'O', string> = { G: 'green', O: 'orange' };

/** The loss card's words when nobody can hop at all. */
export const STUCK = 'The frogs are stuck nose to nose and nobody can hop! BONK!';
/**
 * The loss card's words as soon as a hop leaves no way to win, while frogs could still hop for a while.
 * One Undo always mends it: the row before that hop could still be won.
 */
export const NO_WAY = 'Bonk! That hop left no way for the frogs to swap sides. Undo it, or restart!';

/** The frog swap for any starting row, such as 'GGGG.OOOO'. */
export function makeRules(start: State): RiddleRules<State, Move> {
  const goal = goalOf(start);
  // Can the frogs still swap sides from this row? Frogs only go forward, so no row comes back: a plain search ends.
  // Level 23's nine pads reach 195 rows, so every answer is kept.
  const winnable = new Map<State, boolean>([[goal, true]]);
  const canWin = (s: State): boolean => {
    let yes = winnable.get(s);
    if (yes == null) {
      yes = rules.legalMoves(s).some((m) => canWin(rules.apply(s, m)));
      winnable.set(s, yes);
    }
    return yes;
  };
  const rules: RiddleRules<State, Move> = {
    initialState: start,

    legalMoves(s) {
      const moves: Move[] = [];
      for (let i = 0; i < s.length; i++) if (target(s, i) != null) moves.push({ from: i });
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
      if (s === goal) return { kind: 'won' };
      if (rules.legalMoves(s).length === 0) return { kind: 'lost', reason: STUCK };
      // Lost as soon as no win is left, not hops later at the final bonk: most wrong hops doom the row long
      // before anybody is stuck, and Undo then has to take back exactly one hop.
      if (!canWin(s)) return { kind: 'lost', reason: NO_WAY };
      return { kind: 'playing' };
    },

    key: (s) => s,

    describeMove(m, s) {
      const c = s[m.from] as 'G' | 'O';
      const other = c === 'G' ? 'O' : 'G';
      return isJump(s, m) ? `The ${NAME[c]} frog on pad ${m.from + 1} leaps over the ${NAME[other]} frog` : `The ${NAME[c]} frog on pad ${m.from + 1} hops forward`;
    },
  };
  return rules;
}

export const rules = makeRules(START);
