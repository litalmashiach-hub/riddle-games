import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { MAX_SLIDES, SOLVED, rules, type State } from './rules';

describe('Picture Tiles', () => {
  it('is solvable in the advertised number of slides', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(18);
  });

  it('only lets tiles next to the gap move', () => {
    const moves = rules.legalMoves(rules.initialState).map((m) => m.cell).sort();
    // gap starts in the middle, so the four edge-middle cells can slide
    expect(moves).toEqual([1, 3, 5, 7]);
  });

  it('wins when the picture is whole', () => {
    const s: State = { tiles: [1, 2, 3, 4, 5, 6, 7, 0, 8], slides: 5 };
    const done = rules.apply(s, { cell: 8 });
    expect(done.tiles).toEqual(SOLVED);
    expect(rules.status(done).kind).toBe('won');
  });

  it('loses when Shelly runs out of patience', () => {
    const s: State = { tiles: rules.initialState.tiles, slides: MAX_SLIDES - 1 };
    const next = rules.apply(s, rules.legalMoves(s)[0]);
    expect(rules.status(next).kind).toBe('lost');
  });

  it('describes hints in plain words', () => {
    const text = rules.describeMove({ cell: 1 }, rules.initialState);
    expect(text).toBe('Slide tile 5 towards you');
  });
});
