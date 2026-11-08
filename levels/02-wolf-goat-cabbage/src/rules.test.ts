import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { rules, trouble, type Move, type State } from './rules';

const after = (...passengers: Move['passenger'][]) =>
  passengers.reduce<State>((s, p) => rules.apply(s, { passenger: p }), rules.initialState);

describe('Wolf, Goat and Cabbage', () => {
  it('is solvable in the advertised number of crossings', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(7);
  });

  it('loses when the wolf is left with the goat', () => {
    const s = after('cabbage');
    expect(trouble(s)).toEqual({ bank: 'L', eater: 'wolf' });
    expect(rules.status(s).kind).toBe('lost');
  });

  it('loses when the goat is left with the cabbage', () => {
    const s = after('wolf');
    expect(trouble(s)).toEqual({ bank: 'L', eater: 'goat' });
    expect(rules.status(s).kind).toBe('lost');
  });

  it('is safe to leave the wolf with the cabbage', () => {
    const s = after('goat');
    expect(rules.status(s).kind).toBe('playing');
  });

  it('wins with the classic solution', () => {
    const s = after('goat', null, 'wolf', 'goat', 'cabbage', null, 'goat');
    expect(rules.status(s).kind).toBe('won');
  });

  it('never offers a passenger from the other bank', () => {
    const s = after('goat');
    expect(rules.legalMoves(s)).toEqual([{ passenger: null }, { passenger: 'goat' }]);
  });
});
