import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { canSail, rules, type State } from './rules';

const play = (moves: string[][]) =>
  moves.reduce<State>((s, riders) => rules.apply(s, { riders: riders as any }), rules.initialState);

describe('Explorers and Guardians', () => {
  it('is solvable in the advertised number of crossings', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(11);
  });

  it('loses when guardians outnumber explorers on a bank', () => {
    // Two explorers leave: one explorer stays with three guardians.
    const s = play([['e0', 'e1']]);
    expect(rules.status(s).kind).toBe('lost');
  });

  it('is fine when a bank has guardians but no explorers', () => {
    const s = play([['g0', 'g1']]);
    expect(rules.status(s).kind).toBe('playing');
  });

  it('counts the riders with the bank they land on', () => {
    // Explorer + guardian across, explorer back: the far bank has one guardian alone (fine).
    const s = play([['e0', 'g0'], ['e0']]);
    expect(rules.status(s).kind).toBe('playing');
    // Then two guardians across: far bank now has 3 guardians, 0 explorers (fine), near bank 3 explorers.
    const s2 = rules.apply(s, { riders: ['g1', 'g2'] });
    expect(rules.status(s2).kind).toBe('playing');
  });

  it('wins with a hand-played solution using any explorer or guardian', () => {
    const s = play([
      ['g2', 'g1'], ['g2'], ['g2', 'g0'], ['g0'], ['e2', 'e1'], ['e1', 'g1'],
      ['e1', 'e0'], ['g2'], ['g2', 'g0'], ['g0'], ['g0', 'g1'],
    ]);
    expect(rules.status(s).kind).toBe('won');
  });

  it('only lets riders on the boat bank sail, one or two at a time', () => {
    const s = rules.initialState;
    expect(canSail(s, [])).toBe(false);
    expect(canSail(s, ['e0'])).toBe(true);
    expect(canSail(s, ['e0', 'g0'])).toBe(true);
    expect(canSail(s, ['e0', 'e1', 'e2'])).toBe(false);
    const after = play([['g0', 'g1']]);
    expect(canSail(after, ['e0'])).toBe(false);
    expect(canSail(after, ['g0'])).toBe(true);
  });

  it('hints describe the group', () => {
    expect(rules.describeMove({ riders: ['e0', 'g0'] }, rules.initialState)).toBe('Sail an explorer and a guardian across');
  });
});
