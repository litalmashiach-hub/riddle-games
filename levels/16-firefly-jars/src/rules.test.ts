import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { BEST, CAPACITY, COLORS, PATIENCE, START, canMove, rules, type State } from './rules';

describe('Firefly Jars', () => {
  it('has every colour exactly CAPACITY times', () => {
    for (const c of COLORS) expect(START.flat().filter((x) => x === c).length).toBe(CAPACITY);
  });

  it('is solvable in the advertised number of moves', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(BEST);
  });

  it('only lands a firefly on an empty jar or the same colour', () => {
    const s: State = { jars: [['gold', 'pink'], ['mint'], [], ['pink', 'pink', 'pink', 'gold']], moves: 0 };
    expect(canMove(s, { from: 0, to: 1 })).toBe(false); // pink onto green
    expect(canMove(s, { from: 0, to: 2 })).toBe(true); // empty jar
    expect(canMove(s, { from: 3, to: 0 })).toBe(false); // gold onto pink
    expect(canMove(s, { from: 1, to: 3 })).toBe(false); // full jar
    expect(canMove(s, { from: 2, to: 0 })).toBe(false); // nothing to move
  });

  it('moves the top firefly without mutating the old state', () => {
    const s = rules.initialState;
    const n = rules.apply(s, { from: 0, to: 4 });
    expect(n.jars[4]).toEqual(['sky']);
    expect(n.jars[0]).toEqual(['pink', 'mint', 'pink']);
    expect(s.jars[0].length).toBe(4);
    expect(n.moves).toBe(1);
  });

  it('wins when every colour has its own jar and loses when patience runs out', () => {
    const sorted: State = { jars: [['gold', 'gold', 'gold', 'gold'], [], ['sky', 'sky', 'sky', 'sky'], ['pink', 'pink', 'pink', 'pink'], ['mint', 'mint', 'mint', 'mint'], []], moves: 20 };
    expect(rules.status(sorted).kind).toBe('won');
    expect(rules.status({ ...sorted, moves: PATIENCE }).kind).toBe('won');
    expect(rules.status({ jars: START, moves: PATIENCE }).kind).toBe('lost');
    expect(rules.status({ jars: START, moves: PATIENCE - 1 }).kind).toBe('playing');
  });

  it('leaves room to make mistakes', () => {
    expect(PATIENCE).toBeGreaterThanOrEqual(Math.ceil(BEST * 1.5) + 4);
  });
});
