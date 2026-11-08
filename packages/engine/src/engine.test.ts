import { describe, expect, it, vi } from 'vitest';
import { createSession, solve, starsFor, type RiddleLevel, type RiddleRules } from './index';

// A tiny riddle: reach 5 by adding 1 or 2, never landing on 3.
const rules: RiddleRules<number, number> = {
  initialState: 0,
  legalMoves: (s) => [1, 2].filter((d) => s + d <= 5),
  apply: (s, d) => s + d,
  status: (s) => (s === 3 ? { kind: 'lost', reason: 'Landed on 3' } : s === 5 ? { kind: 'won' } : { kind: 'playing' }),
  key: (s) => String(s),
  describeMove: (d) => `Add ${d}`,
};
const level = { rules, moveDurationMs: 10, bestMoves: 3 } as unknown as RiddleLevel<number, number>;

describe('solve', () => {
  it('finds a shortest path that avoids lost states', () => {
    const sol = solve(rules)!;
    expect(sol.moves.reduce((a, b) => a + b, 0)).toBe(5);
    expect(sol.moves.length).toBe(3);
  });
});

describe('session', () => {
  it('plays, undoes and restarts', () => {
    vi.useFakeTimers();
    const s = createSession(level);
    s.getState().play(2);
    expect(s.getState().busy).toBe(true);
    vi.advanceTimersByTime(20);
    s.getState().play(1);
    expect(s.getState().status.kind).toBe('lost');
    s.getState().undo();
    expect(s.getState().status.kind).toBe('playing');
    expect(s.getState().askHint()).toMatch(/Add/);
    s.getState().restart();
    expect(s.getState().history).toEqual([0]);
    vi.useRealTimers();
  });
});

describe('stars', () => {
  it('rewards optimal play', () => {
    expect(starsFor(7, 7, 0)).toBe(3);
    expect(starsFor(7, 7, 1)).toBe(2);
    expect(starsFor(12, 7, 0)).toBe(1);
  });
});
