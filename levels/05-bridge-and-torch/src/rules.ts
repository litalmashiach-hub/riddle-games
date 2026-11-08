import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
export type Explorer = 'pip' | 'juno' | 'bram' | 'mo';
/** Fastest first. */
export const EXPLORERS: Explorer[] = ['pip', 'juno', 'bram', 'mo'];

/** Minutes each explorer needs to cross the bridge alone. */
export const MINUTES: Record<Explorer, number> = { pip: 1, juno: 2, bram: 5, mo: 10 };
export const NAMES: Record<Explorer, string> = { pip: 'Pip', juno: 'Juno', bram: 'Bram', mo: 'Grandpa Mo' };

/** How long the torch burns. */
export const TORCH_MINUTES = 17;

/** Which side everyone is on, where the torch is, and the minutes used so far. */
export interface State {
  torch: Side;
  pip: Side;
  juno: Side;
  bram: Side;
  mo: Side;
  time: number;
}

/** One crossing: one or two explorers walk over with the torch. Sorted fastest first. */
export interface Move {
  walkers: Explorer[];
}

export const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

/** A pair walks at the slower explorer's pace. */
export const crossingMinutes = (m: Move) => Math.max(...m.walkers.map((w) => MINUTES[w]));

const joinNames = (ws: Explorer[]) => ws.map((w) => NAMES[w]).join(' and ');

export const rules: RiddleRules<State, Move> = {
  initialState: { torch: 'L', pip: 'L', juno: 'L', bram: 'L', mo: 'L', time: 0 },

  legalMoves(s) {
    const here = EXPLORERS.filter((e) => s[e] === s.torch);
    const moves: Move[] = [];
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) moves.push({ walkers: [here[i], here[j]] });
      moves.push({ walkers: [here[i]] });
    }
    return moves;
  },

  apply(s, m) {
    const next = { ...s, torch: other(s.torch), time: s.time + crossingMinutes(m) };
    for (const w of m.walkers) next[w] = other(s[w]);
    return next;
  },

  status(s) {
    if (s.time > TORCH_MINUTES) {
      return { kind: 'lost', reason: `The torch burned out after ${TORCH_MINUTES} minutes and left the explorers in the dark!` };
    }
    if (EXPLORERS.every((e) => s[e] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  key: (s) => `${s.torch}${EXPLORERS.map((e) => s[e]).join('')}${s.time}`,

  describeMove(m, s) {
    const min = crossingMinutes(m);
    const dir = s.torch === 'L' ? 'across' : 'back';
    if (m.walkers.length === 1) return `${NAMES[m.walkers[0]]} brings the torch ${dir} (${min} min)`;
    return `Send ${joinNames(m.walkers)} ${dir} (${min} min)`;
  },
};
