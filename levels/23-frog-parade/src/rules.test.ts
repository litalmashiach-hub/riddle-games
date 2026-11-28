import { solve } from '@riddle/engine';
import { goalOf } from '@riddle/level-13-leapfrog-lagoon';
import { NO_WAY, STUCK } from '@riddle/level-13-leapfrog-lagoon/rules';
import { describe, expect, it } from 'vitest';
import level, { START, rules } from './index';

const applyAll = (s: string, froms: number[]) => froms.reduce((row, from) => rules.apply(row, { from }), s);

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
    expect(rules.status('.GGGOOGOO')).toEqual({ kind: 'lost', reason: STUCK });
    expect(rules.status('OOOO.GGGG').kind).toBe('won');
  });

  it('loses at the first hop that leaves no win, not up to nine hops later at the bonk', () => {
    // The newcomer's first try: a green frog in, an orange frog leaps it, then two more orange frogs hop forward.
    let s = START;
    const hops = [3, 5, 6, 7];
    hops.forEach((from, i) => {
      expect(rules.legalMoves(s).map((m) => m.from)).toContain(from);
      s = rules.apply(s, { from });
      expect(rules.status(s).kind, `after hop ${i + 1}`).toBe(i < hops.length - 1 ? 'playing' : 'lost');
    });
    // Frogs could still hop here, and the card says the row can no longer be won.
    expect(rules.legalMoves(s).length).toBeGreaterThan(0);
    expect(rules.status(s)).toEqual({ kind: 'lost', reason: NO_WAY });
    // One Undo mends it: the row before that hop can still be won.
    expect(rules.status(applyAll(START, hops.slice(0, -1))).kind).toBe('playing');
  });

  it('never lets the frogs play on in a row that can no longer be won', () => {
    const seen = new Set([START]);
    const todo = [START];
    while (todo.length) {
      const s = todo.pop()!;
      expect(solve(rules, s), `a win from ${s}`).not.toBeNull();
      for (const m of rules.legalMoves(s)) {
        const n = rules.apply(s, m);
        if (rules.status(n).kind === 'playing' && !seen.has(n)) {
          seen.add(n);
          todo.push(n);
        }
      }
    }
  });
});
