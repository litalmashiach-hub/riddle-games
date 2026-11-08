import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
export type Item = 'wolf' | 'goat' | 'cabbage';
export const ITEMS: Item[] = ['wolf', 'goat', 'cabbage'];

/** Who is on which bank. The farmer is always in the boat, so `farmer` is the boat's side. */
export interface State {
  farmer: Side;
  wolf: Side;
  goat: Side;
  cabbage: Side;
}

/** One crossing: the farmer rows across with at most one passenger. */
export interface Move {
  passenger: Item | null;
}

export const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

export const NAMES: Record<Item, string> = { wolf: 'the wolf', goat: 'the goat', cabbage: 'the cabbage' };

/** What went wrong on an unwatched bank: the wolf eats the goat, or the goat eats the cabbage. */
export interface Trouble {
  bank: Side;
  eater: 'wolf' | 'goat';
}

/** The first bank where someone gets eaten. The wolf is faster than the goat, so it wins ties. */
export function trouble(s: State): Trouble | null {
  for (const bank of ['L', 'R'] as Side[]) {
    if (s.farmer === bank || s.goat !== bank) continue;
    if (s.wolf === bank) return { bank, eater: 'wolf' };
    if (s.cabbage === bank) return { bank, eater: 'goat' };
  }
  return null;
}

export const rules: RiddleRules<State, Move> = {
  initialState: { farmer: 'L', wolf: 'L', goat: 'L', cabbage: 'L' },

  legalMoves(s) {
    const moves: Move[] = [{ passenger: null }];
    for (const a of ITEMS) if (s[a] === s.farmer) moves.push({ passenger: a });
    return moves;
  },

  apply(s, m) {
    const next = { ...s, farmer: other(s.farmer) };
    if (m.passenger) next[m.passenger] = other(s[m.passenger]);
    return next;
  },

  status(s) {
    const t = trouble(s);
    if (t?.eater === 'wolf') return { kind: 'lost', reason: 'The wolf was left alone with the goat and gobbled it up!' };
    if (t?.eater === 'goat') return { kind: 'lost', reason: 'The goat was left alone with the cabbage and munched it!' };
    if (s.farmer === 'R' && ITEMS.every((a) => s[a] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  key: (s) => `${s.farmer}${s.wolf}${s.goat}${s.cabbage}`,

  describeMove(m, s) {
    const dir = s.farmer === 'L' ? 'across' : 'back';
    return m.passenger ? `Row ${NAMES[m.passenger]} ${dir}` : `Row ${dir} alone`;
  },
};
