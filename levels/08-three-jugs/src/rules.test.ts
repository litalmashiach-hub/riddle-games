import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { pourAmount, rules, type State } from './rules';

describe('Three Jugs', () => {
  it('is solvable in the advertised number of pours', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(7);
  });

  it('pours until the target is full', () => {
    const s = rules.apply(rules.initialState, { from: 0, to: 2 });
    expect(s).toEqual([5, 0, 3]);
    const t = rules.apply(s, { from: 0, to: 1 });
    expect(t).toEqual([0, 5, 3]);
  });

  it('never offers a pointless pour', () => {
    const full: State = [0, 5, 3];
    expect(pourAmount(full, 1, 2)).toBe(0);
    expect(rules.legalMoves(full).every((m) => m.from !== 0)).toBe(true);
  });

  it('keeps 8 litres in total', () => {
    let s = rules.initialState;
    for (const m of solve(rules)!.moves) {
      s = rules.apply(s, m);
      expect(s[0] + s[1] + s[2]).toBe(8);
    }
    expect(rules.status(s).kind).toBe('won');
  });
});
