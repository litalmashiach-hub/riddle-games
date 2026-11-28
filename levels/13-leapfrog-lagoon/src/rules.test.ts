import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { GOAL, NO_WAY, STUCK, rules, START } from './rules';

describe('Leapfrog Lagoon', () => {
  it('is solvable in the advertised number of hops', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(15);
  });

  it('offers only forward moves at the start', () => {
    expect(rules.legalMoves(START).map((m) => m.from).sort()).toEqual([2, 4]);
  });

  it('lets a frog leap over a frog that faces it', () => {
    expect(rules.apply('GG.GOOO', { from: 4 })).toBe('GGOG.OO');
  });

  it('never lets a frog leap over its own team', () => {
    expect(rules.legalMoves('G.GGOOO').map((m) => m.from)).toEqual([0]);
  });

  it('loses when nobody can move', () => {
    // Two greens and two oranges jammed together with the gap in the wrong place.
    expect(rules.status('.GGOOGO')).toEqual({ kind: 'lost', reason: STUCK });
  });

  it('loses as soon as no win is left, while a frog could still hop', () => {
    // An orange frog could still hop onto the gap here, but the row can never be won.
    expect(rules.legalMoves('GGOO.GO').length).toBe(1);
    expect(rules.status('GGOO.GO')).toEqual({ kind: 'lost', reason: NO_WAY });
    // A row that can still be won goes on.
    expect(rules.status('GG.GOOO').kind).toBe('playing');
  });

  it('can still be won from every row it lets the frogs play on, so one Undo always mends a loss', () => {
    const seen = new Set([START]);
    const todo = [START];
    let lost = 0;
    while (todo.length) {
      const s = todo.pop()!;
      expect(solve(rules, s), `a win from ${s}`).not.toBeNull();
      for (const m of rules.legalMoves(s)) {
        const n = rules.apply(s, m);
        const kind = rules.status(n).kind;
        if (kind === 'lost') lost++;
        if (kind === 'playing' && !seen.has(n)) {
          seen.add(n);
          todo.push(n);
        }
      }
    }
    expect(lost).toBeGreaterThan(0);
  });

  it('wins when the teams have swapped', () => {
    expect(rules.status(GOAL).kind).toBe('won');
  });
});
