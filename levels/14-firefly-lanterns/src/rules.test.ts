import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { ALL_LIT, MAX_TAPS, SOLUTION_CELLS, flipMask, rules } from './rules';

describe('Firefly Lanterns', () => {
  it('is solvable in the advertised number of taps', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(SOLUTION_CELLS.length);
  });

  it('starts with some lanterns lit and some dark', () => {
    const lit = rules.initialState.lit;
    expect(lit).not.toBe(0);
    expect(lit).not.toBe(ALL_LIT);
  });

  it('flips a corner, an edge and the centre correctly', () => {
    expect(flipMask(0)).toBe(0b000_001_011);
    expect(flipMask(1)).toBe(0b000_010_111);
    expect(flipMask(4)).toBe(0b010_111_010);
  });

  it('wins when every lantern is lit', () => {
    const s = SOLUTION_CELLS.reduce((st, cell) => rules.apply(st, { cell }), rules.initialState);
    expect(rules.status(s).kind).toBe('won');
  });

  it('loses when the fireflies fall asleep', () => {
    let s = rules.initialState;
    for (let i = 0; i < MAX_TAPS; i++) s = rules.apply(s, { cell: 2 });
    expect(rules.status(s).kind).toBe('lost');
  });
});
