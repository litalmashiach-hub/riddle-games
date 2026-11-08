import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { rules, type State } from './rules';

describe('Two Jugs', () => {
  it('is solvable in the advertised number of moves', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(6);
  });

  it('pours only as much as fits', () => {
    const s = rules.apply({ small: 1, big: 5 }, { kind: 'pour', jug: 'big' });
    expect(s).toEqual({ small: 3, big: 3 });
  });

  it('never offers a move that changes nothing', () => {
    expect(rules.legalMoves(rules.initialState)).toEqual([
      { kind: 'fill', jug: 'small' },
      { kind: 'fill', jug: 'big' },
    ]);
    const full: State = { small: 3, big: 5 };
    expect(rules.legalMoves(full).map((m) => m.kind).sort()).toEqual(['empty', 'empty']);
  });

  it('wins with exactly 4 litres', () => {
    expect(rules.status({ small: 0, big: 4 }).kind).toBe('won');
    expect(rules.status({ small: 3, big: 5 }).kind).toBe('playing');
  });
});
