import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import { raftProblem, rules, type Move, type State } from './rules';

const play = (moves: Move[], from: State = rules.initialState) => moves.reduce((s, m) => rules.apply(s, m), from);

describe('Family Crossing', () => {
  it('is solvable in the advertised number of crossings', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(17);
    const end = play(sol!.moves);
    expect(rules.status(end).kind).toBe('won');
  });

  it('only lets Dad, Mom or the guard steer', () => {
    expect(raftProblem(['thief'])).toMatch(/steer/);
    expect(raftProblem(['sonA', 'daughterA'])).toMatch(/steer/);
    expect(raftProblem(['guard', 'thief'])).toBeNull();
  });

  it('keeps the raft itself safe', () => {
    expect(raftProblem(['father', 'daughterA'])).not.toBeNull();
    expect(raftProblem(['mother', 'sonB'])).not.toBeNull();
    expect(raftProblem(['father', 'thief'])).not.toBeNull();
    const moves = rules.legalMoves(rules.initialState);
    expect(moves.every((m) => m.riders.length <= 2 && raftProblem(m.riders) === null)).toBe(true);
  });

  it('loses when the guard leaves the thief with the family', () => {
    const s = play([{ riders: ['guard'] }]);
    expect(rules.status(s)).toMatchObject({ kind: 'lost' });
  });

  it('loses when Dad is left with a daughter and no Mom', () => {
    // Mom leaves with one daughter, so Dad stays behind with the other one.
    const s = play([{ riders: ['mother', 'daughterA'] }]);
    expect(rules.status(s).kind).toBe('lost');
  });

  it('is fine to send the guard and the thief over first', () => {
    const s = play([{ riders: ['guard', 'thief'] }]);
    expect(rules.status(s).kind).toBe('playing');
  });
});
