import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { canMove, levelOf, rules, topCog } from './rules';

describe('Four-Pillar Tower', () => {
  it('is solvable in the advertised number of moves', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(17);
  });

  it('stacks the tower biggest at the bottom', () => {
    const s = rules.initialState;
    expect(topCog(s, 0)).toBe(0);
    expect(levelOf(s, 5)).toBe(0);
    expect(levelOf(s, 0)).toBe(5);
  });

  it('never lets a big cog sit on a smaller one', () => {
    let s = rules.apply(rules.initialState, { from: 0, to: 1 });
    expect(canMove(s, 0, 1)).toBe(false);
    expect(canMove(s, 0, 2)).toBe(true);
    expect(rules.legalMoves(s).some((m) => m.from === 0 && m.to === 1)).toBe(false);
    s = rules.apply(s, { from: 0, to: 2 });
    expect(canMove(s, 1, 2)).toBe(true);
  });

  it('wins only when every cog is on the fourth pillar', () => {
    expect(rules.status({ peg: [3, 3, 3, 3, 3, 3] }).kind).toBe('won');
    expect(rules.status({ peg: [3, 3, 3, 3, 3, 2] }).kind).toBe('playing');
  });
});
