import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { LANTERN_MINUTES, crossingMinutes, rules, type Move, type State } from './rules';

const run = (moves: Move[]) => moves.reduce<State>((s, m) => rules.apply(s, m), rules.initialState);

describe('Bridge of Five', () => {
  it('is solvable in the advertised number of crossings', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(7);
    expect(run(sol!.moves).time).toBeLessThanOrEqual(LANTERN_MINUTES);
  });

  it('wins with the classic 29-minute plan', () => {
    const s = run([
      { walkers: ['zip', 'mira'] },
      { walkers: ['zip'] },
      { walkers: ['elm', 'tuk'] },
      { walkers: ['mira'] },
      { walkers: ['zip', 'mira'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'bo'] },
    ]);
    expect(s.time).toBe(29);
    expect(rules.status(s).kind).toBe('won');
  });

  it('loses with the "fastest escorts everyone" plan (32 minutes)', () => {
    const s = run([
      { walkers: ['zip', 'tuk'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'elm'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'bo'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'mira'] },
    ]);
    expect(s.time).toBe(32);
    expect(rules.status(s).kind).toBe('lost');
  });

  it('only lets people on the lantern side walk, at most two at a time', () => {
    const s = rules.apply(rules.initialState, { walkers: ['zip', 'mira'] });
    for (const m of rules.legalMoves(s)) {
      expect(m.walkers.length).toBeGreaterThan(0);
      expect(m.walkers.length).toBeLessThanOrEqual(2);
      for (const w of m.walkers) expect(s.pos[w]).toBe('R');
    }
    expect(crossingMinutes(['bo', 'tuk'])).toBe(12);
  });

  it('describes moves for hints', () => {
    expect(rules.describeMove({ walkers: ['zip', 'mira'] }, rules.initialState)).toBe('Send Zip and Mira across (3 min)');
  });
});
