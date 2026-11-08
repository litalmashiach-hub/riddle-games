import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
export type Explorer = 'e0' | 'e1' | 'e2';
export type Guardian = 'g0' | 'g1' | 'g2';
export type Who = Explorer | Guardian;

export const EXPLORERS: Explorer[] = ['e0', 'e1', 'e2'];
export const GUARDIANS: Guardian[] = ['g0', 'g1', 'g2'];
export const EVERYONE: Who[] = [...EXPLORERS, ...GUARDIANS];
export const BOAT_SEATS = 2;

export const isExplorer = (w: Who): w is Explorer => w[0] === 'e';

/** Where everyone stands, plus which bank the boat is moored at. */
export type State = { boat: Side } & Record<Who, Side>;

/** One crossing: one or two riders on the boat's bank sail to the other bank. */
export interface Move {
  riders: Who[];
}

export const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

export function countOn(s: State, bank: Side) {
  let explorers = 0;
  let guardians = 0;
  for (const w of EVERYONE) {
    if (s[w] !== bank) continue;
    if (isExplorer(w)) explorers++;
    else guardians++;
  }
  return { explorers, guardians };
}

/** The bank (if any) where guardians outnumber explorers who are there. */
export function dangerBank(s: State): Side | null {
  for (const bank of ['L', 'R'] as Side[]) {
    const { explorers, guardians } = countOn(s, bank);
    if (explorers > 0 && guardians > explorers) return bank;
  }
  return null;
}

/** True if this group can sail from the boat's bank. */
export function canSail(s: State, riders: Who[]) {
  return riders.length >= 1 && riders.length <= BOAT_SEATS && new Set(riders).size === riders.length && riders.every((w) => s[w] === s.boat);
}

function describeGroup(riders: Who[]) {
  const e = riders.filter(isExplorer).length;
  const g = riders.length - e;
  if (e === 2) return 'two explorers';
  if (g === 2) return 'two guardians';
  if (e === 1 && g === 1) return 'an explorer and a guardian';
  return e === 1 ? 'one explorer' : 'one guardian';
}

export const rules: RiddleRules<State, Move> = {
  initialState: { boat: 'L', e0: 'L', e1: 'L', e2: 'L', g0: 'L', g1: 'L', g2: 'L' },

  // Explorers are interchangeable and so are guardians, so offer one move per kind of group,
  // always using the first available explorer/guardian. The scene may send any of them.
  legalMoves(s) {
    const es = EXPLORERS.filter((w) => s[w] === s.boat);
    const gs = GUARDIANS.filter((w) => s[w] === s.boat);
    const groups: Who[][] = [];
    if (es.length >= 2) groups.push([es[0], es[1]]);
    if (es.length >= 1 && gs.length >= 1) groups.push([es[0], gs[0]]);
    if (gs.length >= 2) groups.push([gs[0], gs[1]]);
    if (es.length >= 1) groups.push([es[0]]);
    if (gs.length >= 1) groups.push([gs[0]]);
    return groups.map((riders) => ({ riders }));
  },

  apply(s, m) {
    const next: State = { ...s, boat: other(s.boat) };
    for (const w of m.riders) next[w] = other(s[w]);
    return next;
  },

  status(s) {
    if (dangerBank(s)) return { kind: 'lost', reason: 'The stone guardians outnumbered the explorers and turned them to stone!' };
    if (EVERYONE.every((w) => s[w] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  key(s) {
    const { explorers, guardians } = countOn(s, 'L');
    return `${s.boat}${explorers}${guardians}`;
  },

  describeMove(m, s) {
    const dir = s.boat === 'L' ? 'across' : 'back';
    return `Sail ${describeGroup(m.riders)} ${dir}`;
  },
};
