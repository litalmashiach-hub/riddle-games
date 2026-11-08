import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { candidates, learn, rules, type Move, type State } from './rules';

const weigh = (left: number[], right: number[]): Move => ({ kind: 'weigh', left, right });
const play = (moves: Move[], s: State = rules.initialState) => moves.reduce((st, m) => rules.apply(st, m), s);

describe('The Twelve Coins', () => {
  it('is solvable in 3 weighings plus the accusation', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(4);
    expect(sol!.moves.slice(0, 3).every((m) => m.kind === 'weigh')).toBe(true);
    const end = play(sol!.moves);
    expect(rules.status(end).kind).toBe('won');
  });

  it('never offers a fourth weighing', () => {
    const s = play([weigh([0], [1]), weigh([2], [3]), weigh([4], [5])]);
    expect(rules.legalMoves(s).some((m) => m.kind === 'weigh')).toBe(false);
  });

  it('a weak first weighing (1 against 1) can no longer be solved', () => {
    const s = play([weigh([0], [1])]);
    expect(solve(rules, s)).toBeNull();
  });

  it('learns from a tilt', () => {
    const k = learn(rules.initialState.know, [0, 1, 2, 3], [4, 5, 6, 7], 'left');
    expect(k.slice(0, 4).every((x) => x === 'H')).toBe(true);
    expect(k.slice(4, 8).every((x) => x === 'L')).toBe(true);
    expect(k.slice(8).every((x) => x === 'G')).toBe(true);
    expect(candidates(k).length).toBe(8);
  });

  it('the classic strategy always wins, whatever the vault answers', () => {
    // 1234 v 5678 first. Follow-ups chosen from the result, as a player would.
    let s = play([weigh([0, 1, 2, 3], [4, 5, 6, 7])]);
    // Solver from here must still finish in 2 weighings + accusation.
    const rest = solve(rules, s);
    expect(rest).not.toBeNull();
    expect(rest!.moves.length).toBe(3);
    s = play(rest!.moves, s);
    expect(rules.status(s).kind).toBe('won');
  });

  it('a lucky guess is punished, with the real fake revealed', () => {
    const s = play([weigh([0, 1, 2, 3], [4, 5, 6, 7])]);
    const c = candidates(s.know)[0];
    const st = rules.status(rules.apply(s, { kind: 'accuse', coin: c.coin, heavy: c.heavy }));
    expect(st.kind).toBe('lost');
    if (st.kind === 'lost') expect(st.reason).toMatch(/coin \d+/i);
  });

  it('the vault always stays consistent: some possibility is always left', () => {
    let s = rules.initialState;
    const rnd = (() => { let x = 7; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); })();
    for (let game = 0; game < 200; game++) {
      s = rules.initialState;
      for (let w = 0; w < 3; w++) {
        const moves = rules.legalMoves(s).filter((m) => m.kind === 'weigh');
        s = rules.apply(s, moves[Math.floor(rnd() * moves.length)]);
        expect(candidates(s.know).length).toBeGreaterThan(0);
      }
    }
  });
});
