import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { cells, grid, PATIENCE, PIECES, reach, rules, SIZE, START } from './rules';

describe('Log Jam', () => {
  it('starts with every piece inside the pond and no overlaps', () => {
    const covered = PIECES.flatMap((p, i) => cells(p, START[i]));
    for (const [r, c] of covered) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(SIZE);
      expect(c).toBeLessThan(SIZE);
    }
    expect(new Set(covered.map(([r, c]) => r * SIZE + c)).size).toBe(covered.length);
    expect(grid(START).filter((g) => g >= 0).length).toBe(covered.length);
  });

  it('is solvable in exactly the advertised number of slides', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBeLessThan(PATIENCE);
  });

  it('lets logs slide any distance but never through each other', () => {
    // The raft starts boxed in by the long log in column 3, which is itself stuck between two logs.
    expect(reach(START, 0)).toEqual([]);
    expect(reach(START, 7)).toEqual([]);
    // The long log in column 5 can slide down one or two spaces in one go.
    expect(reach(START, 5)).toEqual([2, 3]);
    for (const m of rules.legalMoves(rules.initialState)) {
      const next = rules.apply(rules.initialState, m);
      const covered = PIECES.flatMap((p, i) => cells(p, next.pos[i]));
      expect(new Set(covered.map(([r, c]) => r * SIZE + c)).size).toBe(covered.length);
    }
  });

  it('runs out of patience after too many slides', () => {
    let s = rules.initialState;
    const m = rules.legalMoves(s)[0];
    const back = { piece: m.piece, to: s.pos[m.piece] };
    for (let i = 0; i < PATIENCE; i++) s = rules.apply(s, i % 2 === 0 ? m : back);
    expect(rules.status(s).kind).toBe('lost');
  });

  it('describes hint moves in plain words', () => {
    const sol = solve(rules)!;
    expect(rules.describeMove(sol.moves[0], rules.initialState)).toMatch(/^Slide .+ (left|right|up|down) \d space/);
  });
});
