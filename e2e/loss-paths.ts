import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { RiddleRules } from '../packages/engine/src/types';
import { LEVELS } from './levels';

/**
 * The levels that can be lost, each with a way to a loss found from its own rules: the shortest one
 * where that is quick to find, else a fixed walk that never wins (levels lost by running out of moves).
 */

const LEVELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'levels');

export interface LossCase {
  level: (typeof LEVELS)[number];
  /** The moves to the loss: every move but the last keeps the level going. */
  path: unknown[];
  /** Set for a second kind of loss in the same level, to tell the two apart in a test's name. */
  kind?: string;
}

/** The moves to a loss: every move but the last keeps the level going. Null if the level cannot be lost. */
export function lossPath<S, M>(rules: RiddleRules<S, M>): M[] | null {
  // Shortest way, as long as the search stays small.
  const seen = new Set([rules.key(rules.initialState)]);
  let layer: { state: S; path: M[] }[] = [{ state: rules.initialState, path: [] }];
  while (layer.length && seen.size < 20_000) {
    const next: typeof layer = [];
    for (const { state, path } of layer) {
      for (const m of rules.legalMoves(state)) {
        const after = rules.apply(state, m);
        const kind = rules.status(after).kind;
        if (kind === 'lost') return [...path, m];
        if (kind !== 'playing' || seen.has(rules.key(after))) continue;
        seen.add(rules.key(after));
        next.push({ state: after, path: [...path, m] });
      }
    }
    layer = next;
  }
  // A long way: a fixed walk that never wins, taking a losing move as soon as there is one.
  let state = rules.initialState;
  const path: M[] = [];
  let seed = 7;
  const pick = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  for (let i = 0; i < 400; i++) {
    const moves = rules.legalMoves(state).map((m) => ({ m, after: rules.apply(state, m) }));
    const losing = moves.find((x) => rules.status(x.after).kind === 'lost');
    if (losing) return [...path, losing.m];
    const going = moves.filter((x) => rules.status(x.after).kind === 'playing');
    if (!going.length) return null;
    const { m, after } = going[pick(going.length)];
    path.push(m);
    state = after;
  }
  return null;
}

/**
 * The losses that come only when nothing else is left: a walk that keeps the level going as long as any
 * move does, then every losing move from where it ends. Empty if the walk wins, or never ends.
 */
export function lastResortLossPaths<S, M>(rules: RiddleRules<S, M>): { path: M[]; reason: string }[] {
  let state = rules.initialState;
  const path: M[] = [];
  for (let i = 0; i < 400; i++) {
    const moves = rules.legalMoves(state).map((m) => ({ m, after: rules.apply(state, m), status: rules.status(rules.apply(state, m)) }));
    const going = moves.find((x) => x.status.kind === 'playing');
    if (!going) return moves.flatMap((x) => (x.status.kind === 'lost' ? [{ path: [...path, x.m], reason: x.status.reason }] : []));
    path.push(going.m);
    state = going.after;
  }
  return [];
}

export async function levelRules(dir: string): Promise<RiddleRules<unknown, unknown>> {
  return ((await import(pathToFileURL(join(LEVELS_DIR, dir, 'src', 'rules.ts')).href)) as { rules: RiddleRules<unknown, unknown> }).rules;
}

/** One loss for every level that can be lost. */
export async function lossCases(): Promise<LossCase[]> {
  const cases: LossCase[] = [];
  for (const level of LEVELS) {
    const path = lossPath(await levelRules(level.dir));
    if (path) cases.push({ level, path });
  }
  return cases;
}
