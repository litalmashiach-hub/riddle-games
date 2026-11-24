import type { RiddleRules } from '@riddle/engine';

/**
 * Berry Bridges (an "Euler walk", after the seven bridges of Königsberg).
 *
 * Eight islets are joined by twelve reed bridges, and a glow-berry hangs over the middle of each bridge.
 * Bramble the hedgehog picks an islet to start on, then walks from islet to islet. Crossing a bridge
 * collects its berry, and the soggy bridge sinks behind him, so every bridge can be used exactly once.
 * Collect all twelve berries. If Bramble stands on an islet with no bridge left while berries remain, he is stranded.
 *
 * The trick is where to start: only an islet with an odd number of bridges works, and there are exactly two.
 *
 * Islets are numbered left to right: 0 1 2 3 in the back row, 4 5 6 7 in the front row.
 */
export const ISLAND_NAMES = ['lantern', 'mushroom', 'willow', 'boulder', 'stump', 'lotus', 'reed', 'shell'] as const;
export const ISLANDS = ISLAND_NAMES.length;

/** Each bridge joins two islets. */
export const BRIDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], // back row
  [4, 5], [5, 6], // front row (there is no bridge between the reed and shell islets)
  [0, 4], [1, 5], [2, 6], [3, 7], // back to front
  [0, 5], [1, 6], [2, 7], // diagonals
];
export const ALL_USED = (1 << BRIDGES.length) - 1;
/** Not on an islet yet: Bramble waits on his leaf raft. */
export const ON_RAFT = -1;

export interface State {
  /** The islet Bramble stands on, or ON_RAFT before the first move. */
  at: number;
  /** Bit i set = bridge i has been crossed and has sunk. */
  used: number;
}

/** Go to this islet: the first move picks the start, every later move crosses the bridge to it. */
export interface Move {
  to: number;
}

/** The bridge between two islets, or -1. */
export function bridgeBetween(a: number, b: number): number {
  return BRIDGES.findIndex(([p, q]) => (p === a && q === b) || (p === b && q === a));
}

export const isUsed = (s: State, bridge: number) => ((s.used >> bridge) & 1) === 1;
export const berriesLeft = (s: State) => BRIDGES.filter((_, i) => !isUsed(s, i)).length;

/** Islets Bramble can walk to right now. */
export function reachable(s: State): number[] {
  if (s.at === ON_RAFT) return Array.from({ length: ISLANDS }, (_, i) => i);
  const out: number[] = [];
  BRIDGES.forEach(([p, q], i) => {
    if (isUsed(s, i)) return;
    if (p === s.at) out.push(q);
    else if (q === s.at) out.push(p);
  });
  return out;
}

export const rules: RiddleRules<State, Move> = {
  initialState: { at: ON_RAFT, used: 0 },
  legalMoves: (s) => reachable(s).map((to) => ({ to })),
  apply: (s, m) => (s.at === ON_RAFT ? { at: m.to, used: s.used } : { at: m.to, used: s.used | (1 << bridgeBetween(s.at, m.to)) }),
  status: (s) => {
    if (s.used === ALL_USED) return { kind: 'won' };
    if (reachable(s).length === 0) {
      const left = berriesLeft(s);
      return { kind: 'lost', reason: `Bramble is stranded on the ${ISLAND_NAMES[s.at]} islet with ${left} ${left === 1 ? 'berry' : 'berries'} still out of reach!` };
    }
    return { kind: 'playing' };
  },
  key: (s) => `${s.at}|${s.used}`,
  describeMove: (m, s) => (s.at === ON_RAFT ? `Start on the ${ISLAND_NAMES[m.to]} islet` : `Cross the bridge to the ${ISLAND_NAMES[m.to]} islet`),
};
