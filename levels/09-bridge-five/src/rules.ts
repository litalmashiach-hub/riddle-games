import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
export type Traveller = 'zip' | 'mira' | 'bo' | 'elm' | 'tuk';
export const TRAVELLERS: Traveller[] = ['zip', 'mira', 'bo', 'elm', 'tuk'];

/** Minutes each traveller needs to cross the bridge. */
export const MINUTES: Record<Traveller, number> = { zip: 1, mira: 3, bo: 6, elm: 8, tuk: 12 };
export const NAMES: Record<Traveller, string> = { zip: 'Zip', mira: 'Mira', bo: 'Bo', elm: 'Granny Elm', tuk: 'Tuk' };

/** How long the lantern lasts, in minutes. */
export const LANTERN_MINUTES = 30;
/** At most this many people on the bridge at once. */
export const BRIDGE_CAPACITY = 2;

export interface State {
  /** Which island each traveller is on. */
  pos: Record<Traveller, Side>;
  /** The lantern's island. Someone must carry it on every crossing. */
  lantern: Side;
  /** Minutes the lantern has burned so far. */
  time: number;
}

/** One crossing: one or two travellers walk over with the lantern. */
export interface Move {
  walkers: Traveller[];
}

export const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

/** A crossing takes as long as the slowest walker. */
export const crossingMinutes = (walkers: Traveller[]) => Math.max(...walkers.map((w) => MINUTES[w]));

export const rules: RiddleRules<State, Move> = {
  initialState: {
    pos: { zip: 'L', mira: 'L', bo: 'L', elm: 'L', tuk: 'L' },
    lantern: 'L',
    time: 0,
  },

  legalMoves(s) {
    const here = TRAVELLERS.filter((t) => s.pos[t] === s.lantern);
    const moves: Move[] = [];
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) moves.push({ walkers: [here[i], here[j]] });
    }
    for (const t of here) moves.push({ walkers: [t] });
    return moves;
  },

  apply(s, m) {
    const pos = { ...s.pos };
    for (const w of m.walkers) pos[w] = other(s.pos[w]);
    return { pos, lantern: other(s.lantern), time: s.time + crossingMinutes(m.walkers) };
  },

  status(s) {
    if (s.time > LANTERN_MINUTES) return { kind: 'lost', reason: `The lantern burned out after ${LANTERN_MINUTES} minutes, leaving everyone in the dark!` };
    if (TRAVELLERS.every((t) => s.pos[t] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  key: (s) => `${TRAVELLERS.map((t) => s.pos[t]).join('')}${s.lantern}${s.time}`,

  describeMove(m, s) {
    const dir = s.lantern === 'L' ? 'across' : 'back';
    const who = m.walkers.map((w) => NAMES[w]).join(' and ');
    return `Send ${who} ${dir} (${crossingMinutes(m.walkers)} min)`;
  },
};
