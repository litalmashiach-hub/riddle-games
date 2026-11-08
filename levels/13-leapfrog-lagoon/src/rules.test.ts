import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { GOAL, rules, START } from './rules';

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
    expect(rules.status('GGOO.GO').kind).toBe('playing');
    expect(rules.status('.GGOOGO').kind).toBe('lost');
  });

  it('wins when the teams have swapped', () => {
    expect(rules.status(GOAL).kind).toBe('won');
  });
});
