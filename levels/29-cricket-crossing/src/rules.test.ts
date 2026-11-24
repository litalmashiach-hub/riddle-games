import { solve } from '@riddle/engine';
import first, { leaps } from '@riddle/level-21-cricket-swap';
import { describe, expect, it } from 'vitest';
import level, { BOARD, rules } from './index';

/** Every board the crickets can reach from the start. */
function reachable(from: typeof rules): Set<string> {
  const seen = new Set<string>([from.initialState.board]);
  const todo = [from.initialState];
  while (todo.length) {
    const s = todo.pop()!;
    for (const m of from.legalMoves(s)) {
      const n = from.apply(s, m);
      if (!seen.has(n.board)) {
        seen.add(n.board);
        todo.push(n);
      }
    }
  }
  return seen;
}

describe('Cricket Crossing', () => {
  it('is solvable in the advertised number of leaps, and no fewer', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(16);
    const end = sol!.moves.reduce((s, m) => rules.apply(s, m), rules.initialState);
    expect(end.board).toBe(BOARD.goal);
    expect(rules.status(end).kind).toBe('won');
  });

  it('has twelve toadstools, three crickets a side and no jar', () => {
    expect(BOARD.start.length).toBe(BOARD.cols * BOARD.rows);
    expect(BOARD.start).toBe('AAA......BBB');
    expect(BOARD.goal).toBe('BBB......AAA');
    expect(BOARD.jars).toEqual([]);
  });

  it('leaps like a chess knight on the longer patch', () => {
    expect(leaps(0, BOARD).sort((a, b) => a - b)).toEqual([5, 7]);
    expect(leaps(1, BOARD).sort((a, b) => a - b)).toEqual([6, 8]);
    // The middle toadstools, which nobody could reach on the small patch, are in play here.
    expect(leaps(4, BOARD).sort((a, b) => a - b)).toEqual([9, 11]);
    expect(leaps(7, BOARD).sort((a, b) => a - b)).toEqual([0, 2]);
    for (let c = 0; c < 12; c++) expect(leaps(c, BOARD).length).toBeGreaterThanOrEqual(2);
  });

  it('only leaps onto empty toadstools', () => {
    expect(rules.legalMoves(rules.initialState).length).toBe(12);
    const s = rules.apply(rules.initialState, { from: 0, to: 5 });
    expect(s.board).toBe('.AA..A...BBB');
    expect(rules.legalMoves(s)).not.toContainEqual({ from: 10, to: 5 });
  });

  it('gives far more room to go wrong than level 21', () => {
    expect(reachable(rules).size).toBeGreaterThan(reachable(first.rules).size * 50);
  });

  it('is not won by half a swap', () => {
    expect(rules.status(rules.initialState).kind).toBe('playing');
    expect(rules.status({ board: 'BBA......ABA' }).kind).toBe('playing');
  });

  it('gives a hint a player can follow', () => {
    expect(rules.describeMove({ from: 0, to: 5 }, rules.initialState)).toBe('Leap the amber cricket from the back left toadstool to the second right one');
    expect(rules.describeMove({ from: 10, to: 3 }, rules.initialState)).toBe('Leap the blue cricket from the front middle toadstool to the second left one');
  });
});
