import { describe, expect, it } from 'vitest';
import type { RiddleRules } from './types';

/**
 * The solver gives up after 500,000 positions, and then has no hint, just as when no win is left.
 * The shell tells the player "no way to win from here" in both cases, which is only true while no
 * level can make the solver give up. So every level's positions are counted here, all of them, from
 * the start: a search from any position of a level sees no more than these.
 */
const SOLVER_LIMIT = 500_000;
const LEVELS = import.meta.glob<{ rules: RiddleRules<unknown, unknown> }>('../../../levels/*/src/rules.ts');

describe('every level', () => {
  it('is found', () => {
    expect(Object.keys(LEVELS).length).toBeGreaterThanOrEqual(22);
  });

  for (const [path, load] of Object.entries(LEVELS).sort(([a], [b]) => a.localeCompare(b))) {
    const dir = path.split('/').at(-3);
    it(`${dir}: the solver can search it to the end, so "no hint" means "no win left"`, async () => {
      const { rules } = await load();
      const seen = new Set<string>([rules.key(rules.initialState)]);
      const open: unknown[] = [rules.initialState];
      for (let i = 0; i < open.length && seen.size <= SOLVER_LIMIT; i++) {
        for (const move of rules.legalMoves(open[i])) {
          const next = rules.apply(open[i], move);
          const k = rules.key(next);
          if (seen.has(k)) continue;
          seen.add(k);
          if (rules.status(next).kind === 'playing') open.push(next);
        }
      }
      expect(seen.size).toBeLessThanOrEqual(SOLVER_LIMIT);
    }, 60_000);
  }
});
