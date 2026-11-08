import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
export type Animal = 'wolf' | 'sheepA' | 'sheepB';
export const ANIMALS: Animal[] = ['wolf', 'sheepA', 'sheepB'];

/** Who is on which bank. The farmer is always in the boat, so `farmer` is the boat's side. */
export interface State {
  farmer: Side;
  wolf: Side;
  sheepA: Side;
  sheepB: Side;
}

/** One crossing: the farmer rows across with at most one passenger. */
export interface Move {
  passenger: Animal | null;
}

const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

export const NAMES: Record<Animal, string> = { wolf: 'the wolf', sheepA: 'a sheep', sheepB: 'a sheep' };

/** The bank (if any) where the wolf is alone with exactly one sheep. */
export function dangerBank(s: State): Side | null {
  for (const bank of ['L', 'R'] as Side[]) {
    if (s.farmer === bank || s.wolf !== bank) continue;
    const sheep = (s.sheepA === bank ? 1 : 0) + (s.sheepB === bank ? 1 : 0);
    if (sheep === 1) return bank;
  }
  return null;
}

export const rules: RiddleRules<State, Move> = {
  initialState: { farmer: 'L', wolf: 'L', sheepA: 'L', sheepB: 'L' },

  legalMoves(s) {
    const moves: Move[] = [{ passenger: null }];
    for (const a of ANIMALS) if (s[a] === s.farmer) moves.push({ passenger: a });
    return moves;
  },

  apply(s, m) {
    const next = { ...s, farmer: other(s.farmer) };
    if (m.passenger) next[m.passenger] = other(s[m.passenger]);
    return next;
  },

  status(s) {
    if (dangerBank(s)) return { kind: 'lost', reason: 'The wolf was left alone with one sheep and pounced!' };
    if (s.farmer === 'R' && ANIMALS.every((a) => s[a] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  // The two sheep are identical, so count them rather than track which is which.
  key: (s) => `${s.farmer}${s.wolf}${(s.sheepA === 'R' ? 1 : 0) + (s.sheepB === 'R' ? 1 : 0)}`,

  describeMove(m, s) {
    const dir = s.farmer === 'L' ? 'across' : 'back';
    return m.passenger ? `Row ${NAMES[m.passenger]} ${dir}` : `Row ${dir} alone`;
  },
};
