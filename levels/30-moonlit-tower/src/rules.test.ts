import { solve } from '@riddle/engine';
import first from '@riddle/level-04-tower-of-hanoi';
import { describe, expect, it } from 'vitest';
import level, { DISCS, rules } from './index';

describe('Moonlit Tower', () => {
  it('is solvable in the advertised number of moves', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(31);
    expect(level.bestMoves).toBe(2 ** DISCS - 1);
  });

  it('is one disc taller than level 4, which doubles the work', () => {
    expect(rules.initialState.pegs).toEqual([[5, 4, 3, 2, 1], [], []]);
    expect(level.bestMoves).toBe(first.bestMoves * 2 + 1);
  });

  it('never offers a bigger disc onto a smaller one', () => {
    const s = rules.apply(rules.initialState, { from: 0, to: 1 });
    expect(rules.legalMoves(s)).not.toContainEqual({ from: 0, to: 1 });
    expect(rules.legalMoves(s)).toContainEqual({ from: 0, to: 2 });
    expect(rules.legalMoves(s)).toContainEqual({ from: 1, to: 0 });
  });

  it('does not mutate the state', () => {
    const before = JSON.stringify(rules.initialState);
    rules.apply(rules.initialState, { from: 0, to: 2 });
    expect(JSON.stringify(rules.initialState)).toBe(before);
  });

  it('is won only with all five discs on the right pillar', () => {
    expect(rules.status({ pegs: [[], [5, 4, 3, 2, 1], []] }).kind).toBe('playing');
    expect(rules.status({ pegs: [[5], [], [4, 3, 2, 1]] }).kind).toBe('playing');
    expect(rules.status({ pegs: [[], [], [5, 4, 3, 2, 1]] }).kind).toBe('won');
  });

  it('names the discs for the hint', () => {
    expect(rules.describeMove({ from: 0, to: 2 }, rules.initialState)).toBe('Move the smallest disc from the left pillar to the right pillar');
    expect(rules.describeMove({ from: 0, to: 1 }, { pegs: [[5], [], [4, 3, 2, 1]] })).toBe('Move the biggest disc from the left pillar to the middle pillar');
  });

  it('can be won from every position, so Hint always has an answer', () => {
    const seen = new Set<string>([rules.key(rules.initialState)]);
    const todo = [rules.initialState];
    while (todo.length) {
      const s = todo.pop()!;
      for (const m of rules.legalMoves(s)) {
        const n = rules.apply(s, m);
        if (!seen.has(rules.key(n))) {
          seen.add(rules.key(n));
          todo.push(n);
        }
      }
    }
    expect(seen.size).toBe(3 ** DISCS);
  });
});
