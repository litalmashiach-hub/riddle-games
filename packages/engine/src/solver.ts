import type { RiddleRules } from './types';

export interface Solution<M> {
  moves: M[];
}

/**
 * Breadth-first search for the shortest winning sequence of moves.
 * Lost states are dead ends. Returns null if the riddle cannot be won.
 * Fine for every riddle in this game (all have small state spaces).
 */
export function solve<S, M>(
  rules: RiddleRules<S, M>,
  from: S = rules.initialState,
  maxStates = 500_000,
): Solution<M> | null {
  const start = rules.status(from);
  if (start.kind === 'won') return { moves: [] };
  if (start.kind === 'lost') return null;

  type Node = { state: S; parent: number; move: M | null };
  const nodes: Node[] = [{ state: from, parent: -1, move: null }];
  const seen = new Set<string>([rules.key(from)]);

  for (let i = 0; i < nodes.length; i++) {
    if (nodes.length > maxStates) return null;
    const node = nodes[i];
    for (const move of rules.legalMoves(node.state)) {
      const next = rules.apply(node.state, move);
      const k = rules.key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      const st = rules.status(next);
      if (st.kind === 'lost') continue;
      nodes.push({ state: next, parent: i, move });
      if (st.kind === 'won') {
        const moves: M[] = [];
        for (let j = nodes.length - 1; j > 0; j = nodes[j].parent) moves.push(nodes[j].move as M);
        return { moves: moves.reverse() };
      }
    }
  }
  return null;
}

/** The first move of a shortest solution from `state`, or null. */
export function nextHint<S, M>(rules: RiddleRules<S, M>, state: S): M | null {
  const sol = solve(rules, state);
  return sol && sol.moves.length > 0 ? sol.moves[0] : null;
}
