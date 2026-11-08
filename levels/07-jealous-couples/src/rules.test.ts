import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { rules, type Bird, type State } from './rules';

const fly = (s: State, ...riders: Bird[]) => rules.apply(s, { riders });

describe('Three Jealous Couples', () => {
  it('is solvable in the advertised number of flights', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(11);
  });

  it('every move takes one or two riders from the balloon island', () => {
    for (const m of rules.legalMoves(rules.initialState)) {
      expect(m.riders.length).toBeGreaterThanOrEqual(1);
      expect(m.riders.length).toBeLessThanOrEqual(2);
    }
    expect(rules.legalMoves(rules.initialState)).toHaveLength(6 + 15);
  });

  it('a couple can fly together safely', () => {
    expect(rules.status(fly(rules.initialState, 'g0', 'l0')).kind).toBe('playing');
  });

  it('loses when a lady rides with another gent', () => {
    const s = fly(rules.initialState, 'g0', 'l1');
    const st = rules.status(s);
    expect(st.kind).toBe('lost');
    if (st.kind === 'lost') expect(st.reason).toContain('in the balloon');
  });

  it('loses when a lady is left on an island with another gent', () => {
    // Mr Coral flies away, leaving Mrs Coral with the other gents.
    const st = rules.status(fly(rules.initialState, 'g0'));
    expect(st.kind).toBe('lost');
  });

  it('ladies together without gents are fine', () => {
    expect(rules.status(fly(rules.initialState, 'l0', 'l1')).kind).toBe('playing');
  });

  it('wins when everyone is across', () => {
    const s: State = { balloon: 'R', at: { g0: 'R', g1: 'R', g2: 'R', l0: 'R', l1: 'R', l2: 'R' }, basketFault: null };
    expect(rules.status(s).kind).toBe('won');
  });
});
