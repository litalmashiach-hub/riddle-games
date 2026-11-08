import type { RiddleRules } from '@riddle/engine';

export type JugId = 'small' | 'big';
export const JUGS: JugId[] = ['small', 'big'];

/** Litres each jug holds when full. */
export const CAPACITY: Record<JugId, number> = { small: 3, big: 5 };
export const GOAL = 4;

/** Litres of water in each jug. */
export interface State {
  small: number;
  big: number;
}

export type Move =
  | { kind: 'fill'; jug: JugId }
  | { kind: 'empty'; jug: JugId }
  | { kind: 'pour'; jug: JugId };

export const otherJug = (j: JugId): JugId => (j === 'small' ? 'big' : 'small');

export const NAMES: Record<JugId, string> = { small: 'the 3 L jug', big: 'the 5 L jug' };

/** True if the move would change something. No-op moves are never offered. */
export function canDo(s: State, m: Move): boolean {
  if (m.kind === 'fill') return s[m.jug] < CAPACITY[m.jug];
  if (m.kind === 'empty') return s[m.jug] > 0;
  const to = otherJug(m.jug);
  return s[m.jug] > 0 && s[to] < CAPACITY[to];
}

export const rules: RiddleRules<State, Move> = {
  initialState: { small: 0, big: 0 },

  legalMoves(s) {
    const all: Move[] = JUGS.flatMap((jug) => [
      { kind: 'fill', jug } as Move,
      { kind: 'empty', jug } as Move,
      { kind: 'pour', jug } as Move,
    ]);
    return all.filter((m) => canDo(s, m));
  },

  apply(s, m) {
    const next = { ...s };
    if (m.kind === 'fill') next[m.jug] = CAPACITY[m.jug];
    else if (m.kind === 'empty') next[m.jug] = 0;
    else {
      const to = otherJug(m.jug);
      const amount = Math.min(s[m.jug], CAPACITY[to] - s[to]);
      next[m.jug] -= amount;
      next[to] += amount;
    }
    return next;
  },

  // There is no way to lose: the move counter is the only pressure.
  status: (s) => (s.small === GOAL || s.big === GOAL ? { kind: 'won' } : { kind: 'playing' }),

  key: (s) => `${s.small},${s.big}`,

  describeMove(m) {
    if (m.kind === 'fill') return `Fill ${NAMES[m.jug]} at the pump`;
    if (m.kind === 'empty') return `Empty ${NAMES[m.jug]} into the river`;
    return `Pour ${NAMES[m.jug]} into ${NAMES[otherJug(m.jug)]}`;
  },
};
