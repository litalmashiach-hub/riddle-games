import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { rules, TORCH_MINUTES, type Move, type State } from './rules';

const run = (moves: Move[]) => moves.reduce<State>((s, m) => rules.apply(s, m), rules.initialState);

describe('Bridge and Torch', () => {
  it('is solvable in the advertised number of crossings, within 17 minutes', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(5);
    const end = run(sol!.moves);
    expect(rules.status(end).kind).toBe('won');
    expect(end.time).toBe(TORCH_MINUTES);
  });

  it('pairs walk at the slower pace', () => {
    const s = rules.apply(rules.initialState, { walkers: ['juno', 'mo'] });
    expect(s.time).toBe(10);
    expect(s.torch).toBe('R');
  });

  it('loses with the obvious "fastest escorts everyone" plan (19 minutes)', () => {
    const end = run([
      { walkers: ['pip', 'mo'] },
      { walkers: ['pip'] },
      { walkers: ['pip', 'bram'] },
      { walkers: ['pip'] },
      { walkers: ['pip', 'juno'] },
    ]);
    expect(end.time).toBe(19);
    expect(rules.status(end)).toEqual({
      kind: 'lost',
      reason: 'That took 19 minutes, but the torch only lasts 17. Try sending the two slowest together.',
    });
  });

  it('says the real time taken when the torch runs out', () => {
    const end = run([{ walkers: ['juno', 'mo'] }, { walkers: ['juno'] }, { walkers: ['bram', 'juno'] }]);
    expect(end.time).toBe(17);
    expect(rules.status(end).kind).toBe('playing');
    const over = rules.apply(end, { walkers: ['juno'] });
    expect(over.time).toBe(19);
    const status = rules.status(over);
    expect(status.kind === 'lost' && status.reason).toMatch(/^That took 19 minutes, but the torch only lasts 17\./);
  });

  it('puts the torch, not the crossings, on the rules card as the way to three stars', () => {
    expect(level.instructions).toContain('Who carries the torch back matters most.');
    expect(level.starLine).toBe('Get everyone over before the torch burns out for three stars.');
  });

  it('only offers moves from the torch side, with one or two walkers', () => {
    const s = rules.apply(rules.initialState, { walkers: ['pip', 'juno'] });
    const moves = rules.legalMoves(s);
    expect(moves).toHaveLength(3);
    for (const m of moves) for (const w of m.walkers) expect(s[w]).toBe('R');
  });
});
