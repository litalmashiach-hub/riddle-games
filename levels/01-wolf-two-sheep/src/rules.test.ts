import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { rules } from './rules';

describe('Wolf and Two Sheep', () => {
  it('is solvable in the advertised number of crossings', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(7);
  });

  it('loses when the wolf is left with one sheep', () => {
    const s = rules.apply(rules.initialState, { passenger: 'sheepA' });
    expect(rules.status(s).kind).toBe('lost');
  });

  it('is fine to leave the wolf with both sheep', () => {
    const s = rules.apply(rules.initialState, { passenger: null });
    expect(rules.status(s).kind).toBe('playing');
  });
});
