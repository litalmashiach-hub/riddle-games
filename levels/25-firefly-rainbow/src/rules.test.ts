import { solve } from '@riddle/engine';
import first, { CAPACITY, type Color, type State } from '@riddle/level-16-firefly-jars';
import { describe, expect, it } from 'vitest';
import level, { BEST, PATIENCE, START, rules } from './index';

const FIVE: Color[] = ['gold', 'pink', 'mint', 'sky', 'violet'];

describe('Firefly Rainbow', () => {
  it('has five colours, each exactly CAPACITY times, in seven jars', () => {
    for (const c of FIVE) expect(START.flat().filter((x) => x === c).length).toBe(CAPACITY);
    expect(START.flat().length).toBe(FIVE.length * CAPACITY);
    expect(START.length).toBe(7);
    expect(START.filter((j) => j.length === 0).length).toBe(2);
  });

  it('is solvable in the advertised number of moves', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(BEST);
    expect(BEST).toBe(20);
  });

  it('is a longer sort than level 16', () => {
    expect(level.bestMoves).toBeGreaterThan(first.bestMoves);
  });

  it('moves the top firefly without mutating the old state', () => {
    const s = rules.initialState;
    const n = rules.apply(s, { from: 0, to: 5 });
    expect(n.jars[5]).toEqual(['pink']);
    expect(n.jars[0]).toEqual(['sky', 'violet', 'gold']);
    expect(s.jars[0].length).toBe(4);
    expect(n.moves).toBe(1);
  });

  it('wins when every colour has its own jar and loses when patience runs out', () => {
    const sorted: State = { jars: [...FIVE.map((c) => [c, c, c, c]), [], []], moves: 25 };
    expect(rules.status(sorted).kind).toBe('won');
    expect(rules.status({ ...sorted, moves: PATIENCE }).kind).toBe('won');
    expect(rules.status({ jars: START, moves: PATIENCE }).kind).toBe('lost');
    expect(rules.status({ jars: START, moves: PATIENCE - 1 }).kind).toBe('playing');
  });

  it('leaves room to make mistakes', () => {
    expect(PATIENCE).toBeGreaterThanOrEqual(Math.ceil(BEST * 1.5) + 4);
  });
});
