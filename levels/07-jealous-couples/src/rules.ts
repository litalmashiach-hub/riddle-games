import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
/** Three couples of sky birds. Each couple has a gent (top hat) and a lady (flower bow). */
export type Couple = 0 | 1 | 2;
export type Role = 'gent' | 'lady';
export type Bird = 'g0' | 'g1' | 'g2' | 'l0' | 'l1' | 'l2';
export const BIRDS: Bird[] = ['g0', 'l0', 'g1', 'l1', 'g2', 'l2'];
export const COUPLES: Couple[] = [0, 1, 2];

export const roleOf = (b: Bird): Role => (b[0] === 'g' ? 'gent' : 'lady');
export const coupleOf = (b: Bird): Couple => Number(b[1]) as Couple;
export const gent = (c: Couple) => `g${c}` as Bird;
export const lady = (c: Couple) => `l${c}` as Bird;

export const COUPLE_NAMES = ['Coral', 'Teal', 'Plum'] as const;
export const nameOf = (b: Bird) => `${roleOf(b) === 'gent' ? 'Mr' : 'Mrs'} ${COUPLE_NAMES[coupleOf(b)]}`;

/** Where everyone is. `balloon` is the island the balloon is moored at. */
export interface State {
  balloon: Side;
  at: Record<Bird, Side>;
  /** Set when a jealous rule was broken inside the balloon basket on the last flight. */
  basketFault: Bird[] | null;
}

/** One flight: one or two birds ride the balloon to the other island. */
export interface Move {
  riders: Bird[];
}

const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

/**
 * A lady is in trouble if she is with another couple's gent while her own gent is not there.
 * Returns [the lady, the other gent] for the first broken pair in the group, or null.
 */
export function jealousPair(group: Bird[]): [Bird, Bird] | null {
  for (const c of COUPLES) {
    if (!group.includes(lady(c)) || group.includes(gent(c))) continue;
    const rival = group.find((b) => roleOf(b) === 'gent');
    if (rival) return [lady(c), rival];
  }
  return null;
}

export const onIsland = (s: State, side: Side) => BIRDS.filter((b) => s.at[b] === side);

/** Who is involved in the broken rule, and where. */
export function trouble(s: State): { where: Side | 'basket'; lady: Bird; rival: Bird } | null {
  if (s.basketFault) {
    const p = jealousPair(s.basketFault);
    if (p) return { where: 'basket', lady: p[0], rival: p[1] };
  }
  for (const side of ['L', 'R'] as Side[]) {
    const p = jealousPair(onIsland(s, side));
    if (p) return { where: side, lady: p[0], rival: p[1] };
  }
  return null;
}

export const rules: RiddleRules<State, Move> = {
  initialState: {
    balloon: 'L',
    at: { g0: 'L', g1: 'L', g2: 'L', l0: 'L', l1: 'L', l2: 'L' },
    basketFault: null,
  },

  legalMoves(s) {
    const here = onIsland(s, s.balloon);
    const moves: Move[] = [];
    for (let i = 0; i < here.length; i++) {
      moves.push({ riders: [here[i]] });
      for (let j = i + 1; j < here.length; j++) moves.push({ riders: [here[i], here[j]] });
    }
    return moves;
  },

  apply(s, m) {
    const at = { ...s.at };
    for (const b of m.riders) at[b] = other(s.at[b]);
    return { balloon: other(s.balloon), at, basketFault: jealousPair(m.riders) ? [...m.riders] : null };
  },

  status(s) {
    const t = trouble(s);
    if (t) {
      const where = t.where === 'basket' ? 'in the balloon' : 'on the island';
      return {
        kind: 'lost',
        reason: `${nameOf(t.lady)} was ${where} with ${nameOf(t.rival)} without ${nameOf(gent(coupleOf(t.lady)))}. Jealousy!`,
      };
    }
    if (BIRDS.every((b) => s.at[b] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  key: (s) => `${s.balloon}${BIRDS.map((b) => s.at[b]).join('')}${s.basketFault ? '!' : ''}`,

  describeMove(m, s) {
    const dir = s.balloon === 'L' ? 'over' : 'back';
    const who = m.riders.map(nameOf);
    return `Fly ${who.join(' and ')} ${dir}`;
  },
};
