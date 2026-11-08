import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { canMove, rules } from './rules';

describe('Tower of Hanoi', () => {
  it('is solvable in the advertised number of moves', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(15);
  });

  it('never offers a bigger disc onto a smaller one', () => {
    const s = rules.apply(rules.initialState, { from: 0, to: 1 });
    expect(canMove(s, 0, 1)).toBe(false);
    expect(rules.legalMoves(s)).not.toContainEqual({ from: 0, to: 1 });
    expect(canMove(s, 0, 2)).toBe(true);
  });

  it('does not mutate the state', () => {
    const before = JSON.stringify(rules.initialState);
    rules.apply(rules.initialState, { from: 0, to: 2 });
    expect(JSON.stringify(rules.initialState)).toBe(before);
  });

  it('is won only with the full tower on the right pillar', () => {
    expect(rules.status({ pegs: [[], [4, 3, 2, 1], []] }).kind).toBe('playing');
    expect(rules.status({ pegs: [[], [], [4, 3, 2, 1]] }).kind).toBe('won');
  });
});
