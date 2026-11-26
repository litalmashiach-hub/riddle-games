import { solve } from '@riddle/engine';
import { goalOf } from '@riddle/level-13-leapfrog-lagoon';
import { describe, expect, it } from 'vitest';
import level, { START, rules } from './index';

describe('Frog Parade', () => {
  it('is solvable in the advertised number of hops', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(24);
  });

  it('cannot be won in any other number of hops', () => {
    // Nobody ever goes back, so a row can only be reached one way round: every win takes exactly 24 hops.
    const seen = new Map<string, Set<number>>();
    const walk = (s: string, n: number) => {
      const at = seen.get(s) ?? new Set<number>();
      if (at.has(n)) return;
      at.add(n);
      seen.set(s, at);
      for (const m of rules.legalMoves(s)) walk(rules.apply(s, m), n + 1);
    };
    walk(START, 0);
    expect([...seen.get(goalOf(START))!]).toEqual([24]);
  });

  it('has nine pads, four frogs a side and the gap in the middle', () => {
    expect(START).toBe('GGGG.OOOO');
    expect(goalOf(START)).toBe('OOOO.GGGG');
    expect(rules.legalMoves(START).map((m) => m.from).sort()).toEqual([3, 5]);
  });

  it('is harder than level 13: most rows the frogs can reach are dead ends', () => {
    const reach = new Set<string>([START]);
    const todo = [START];
    while (todo.length) {
      const s = todo.pop()!;
      for (const m of rules.legalMoves(s)) {
        const n = rules.apply(s, m);
        if (!reach.has(n)) {
          reach.add(n);
          todo.push(n);
        }
      }
    }
    const winnable = [...reach].filter((s) => solve(rules, s) != null).length;
    expect(winnable * 2).toBeLessThan(reach.size);
  });

  it('loses when nobody can move and wins when the teams have swapped', () => {
    expect(rules.status('GGGOO.GOO').kind).toBe('playing');
    expect(rules.status('.GGGOOGOO').kind).toBe('lost');
    expect(rules.status('OOOO.GGGG').kind).toBe('won');
  });
});
