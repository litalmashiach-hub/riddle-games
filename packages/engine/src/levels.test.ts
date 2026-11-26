import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../../apps/web/src/levels';
import { SOLVER_LIMIT, solve } from './solver';
import type { RiddleRules } from './types';

/**
 * The solver gives up after SOLVER_LIMIT positions, and then has no hint, just as when no win is left.
 * The shell tells the player "no way to win from here" in both cases, which is only true while no
 * level can make the solver give up. So every level's positions are counted here, all of them, from
 * the start: a search from any position of a level sees no more than these.
 *
 * The levels are the game's own list (apps/web/src/levels.ts), whichever file holds their rules:
 * a level that the game can show is a level that is counted here.
 */
const PARTS = ['legalMoves', 'apply', 'status', 'key'] as const;

/** How many positions a level has, from its start. Stops counting just past `limit`. Throws if the level has no rules to count. */
function positions(level: object | undefined, limit: number): number {
  const rules = (level as { rules?: Partial<RiddleRules<unknown, unknown>> } | undefined)?.rules;
  if (!rules || !('initialState' in rules) || PARTS.some((part) => typeof rules[part] !== 'function')) {
    throw new Error('the level has no rules that can be counted');
  }
  const { initialState, legalMoves, apply, status, key } = rules as RiddleRules<unknown, unknown>;
  const seen = new Set<string>([key(initialState)]);
  const open: unknown[] = [initialState];
  for (let i = 0; i < open.length && seen.size <= limit; i++) {
    for (const move of legalMoves(open[i])) {
      const next = apply(open[i], move);
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      if (status(next).kind === 'playing') open.push(next);
    }
  }
  return seen.size;
}

/** What the guard asks of one level. */
function expectSearchable(level: object | undefined, limit = SOLVER_LIMIT) {
  expect(positions(level, limit)).toBeLessThanOrEqual(limit);
}

const FOLDERS = Object.keys(import.meta.glob('../../../levels/*/package.json'));
const BUILT = LEVELS.filter((entry) => entry.load);
// The game loads a level's code only when it opens; here every level is loaded up front.
const LOADED = await Promise.all(BUILT.map((entry) => entry.load!()));

describe('every level', () => {
  it('is found: the game lists as many levels as there are level folders', () => {
    expect(BUILT.length).toBeGreaterThanOrEqual(22);
    expect(BUILT.length).toBe(FOLDERS.length);
    expect(new Set(BUILT.map((entry) => entry.id)).size).toBe(BUILT.length);
  });

  it('loads, for each card on the map, the level of that number, id, title and world', () => {
    expect(LOADED.map((l) => [l.number, l.id, l.title, l.world])).toEqual(BUILT.map((e) => [e.number, e.id, e.title, e.world]));
  });

  BUILT.forEach((entry, i) => {
    it(`${entry.number} ${entry.id}: the solver can search it to the end, so "no hint" means "no win left"`, () => {
      expectSearchable(LOADED[i]);
    }, 60_000);
  });
});

describe('the guard itself', () => {
  /** A counter from 0 that wins at `goal`: goal + 1 positions. */
  const counter = (goal: number): RiddleRules<number, 1> => ({
    initialState: 0,
    legalMoves: () => [1],
    apply: (n) => n + 1,
    status: (n) => (n === goal ? { kind: 'won' } : { kind: 'playing' }),
    key: String,
    describeMove: () => 'Add 1',
  });

  it('reads the limit that the solver uses', () => {
    // One position under the limit is solved, one over is given up: the limit is the solver's own.
    expect(solve(counter(SOLVER_LIMIT - 1))?.moves).toHaveLength(SOLVER_LIMIT - 1);
    expect(solve(counter(SOLVER_LIMIT + 1))).toBeNull();
  });

  it('passes a level under the limit, and fails it once the limit is lowered', () => {
    expectSearchable({ rules: counter(99) }, 100);
    expect(() => expectSearchable({ rules: counter(99) }, 99)).toThrow(/expected 100 to be less than or equal to 99/);
    // A real level too: level 1 has more than ten positions.
    expect(() => expectSearchable(LOADED[0], 10)).toThrow(/expected 11 to be less than or equal to 10/);
  });

  it('fails a registered level that has no rules it can count', () => {
    const { rules, ...noRules } = LOADED[0];
    expect(() => expectSearchable(noRules)).toThrow(/no rules that can be counted/);
    expect(() => expectSearchable({ rules: { ...rules, legalMoves: undefined } })).toThrow(/no rules that can be counted/);
    expect(() => expectSearchable(undefined)).toThrow(/no rules that can be counted/);
  });
});
