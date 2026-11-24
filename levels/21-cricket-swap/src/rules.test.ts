import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { CELLS, GOAL, START, freeLeaps, leaps, rules } from './rules';

describe('Cricket Swap', () => {
  it('is solvable in the advertised number of leaps, and no fewer', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(16);
    const end = sol!.moves.reduce((s, m) => rules.apply(s, m), rules.initialState);
    expect(end.board).toBe(GOAL);
    expect(rules.status(end).kind).toBe('won');
  });

  it('leaps like a chess knight', () => {
    expect(leaps(0).sort()).toEqual([5, 7]);
    expect(leaps(1).sort()).toEqual([6, 8]);
    expect(leaps(3).sort()).toEqual([2, 8]);
    // Nothing can ever reach or leave the middle toadstool.
    expect(leaps(4)).toEqual([]);
    for (let c = 0; c < CELLS; c++) expect(leaps(c)).not.toContain(4);
  });

  it('only leaps onto empty toadstools', () => {
    expect(rules.legalMoves(rules.initialState).length).toBe(8);
    const s = rules.apply(rules.initialState, { from: 0, to: 5 });
    expect(s.board).toBe('..A..AB.B');
    // The front left cricket could leap to 1 or 5, but 5 is taken now.
    expect(freeLeaps(s, 6)).toEqual([1]);
    expect(freeLeaps(s, 4)).toEqual([]);
  });

  it('starts with the colours on the wrong sides and is not won by half a swap', () => {
    expect(rules.initialState.board).toBe(START);
    expect(rules.status(rules.initialState).kind).toBe('playing');
    expect(rules.status({ board: 'B.A...A.B' }).kind).toBe('playing');
  });

  it('treats crickets of one colour as the same', () => {
    const a = [{ from: 0, to: 5 }, { from: 2, to: 7 }].reduce((s, m) => rules.apply(s, m), rules.initialState);
    const b = [{ from: 2, to: 7 }, { from: 0, to: 5 }].reduce((s, m) => rules.apply(s, m), rules.initialState);
    expect(rules.key(a)).toBe(rules.key(b));
  });

  it('gives a hint a player can follow', () => {
    expect(rules.describeMove({ from: 0, to: 5 }, rules.initialState)).toBe('Leap the amber cricket from the back left toadstool to the middle right one');
  });
});
