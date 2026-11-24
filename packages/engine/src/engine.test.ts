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

describe('hints', () => {
  // Reach 5 by adding 2 only: from 1 every path ends on 3 or passes 5, so no win is left there.
  const odd: RiddleRules<number, number> = {
    ...rules,
    initialState: 0,
    legalMoves: (s) => (s === 0 ? [1, 2] : s + 2 <= 5 ? [2] : []),
    status: (s) => (s === 3 ? { kind: 'lost', reason: 'Landed on 3' } : s === 4 ? { kind: 'won' } : { kind: 'playing' }),
  };
  const oddLevel = { rules: odd, moveDurationMs: 10, bestMoves: 2 } as unknown as RiddleLevel<number, number>;

  it('gives no hint, and counts none, where no win is left', () => {
    vi.useFakeTimers();
    const s = createSession(oddLevel);
    s.getState().play(1);
    vi.advanceTimersByTime(20);
    expect(s.getState().status.kind).toBe('playing');
    expect(solve(odd, 1)).toBeNull();
    expect(s.getState().askHint()).toBeNull();
    expect(s.getState().hint).toBeNull();
    expect(s.getState().hintsUsed).toBe(0);
    // One step back there is a win again, and that hint is counted.
    s.getState().undo();
    expect(s.getState().askHint()).toBe('Add 2');
    expect(s.getState().hintsUsed).toBe(1);
    vi.useRealTimers();
  });

  it('forgets the hints at a restart, so a fresh run can earn three stars', () => {
    vi.useFakeTimers();
    const s = createSession(level);
    expect(s.getState().askHint()).toMatch(/Add/);
    expect(s.getState().askHint()).toMatch(/Add/);
    expect(s.getState().hintsUsed).toBe(2);
    s.getState().restart();
    expect(s.getState().hintsUsed).toBe(0);
    expect(s.getState().hint).toBeNull();
    for (const d of solve(rules)!.moves) {
      s.getState().play(d);
      vi.advanceTimersByTime(20);
    }
    const end = s.getState();
    expect(end.status.kind).toBe('won');
    expect(starsFor(end.moves.length, level.bestMoves, end.hintsUsed)).toBe(3);
    vi.useRealTimers();
  });

  it('keeps the hints through undo and redo', () => {
    vi.useFakeTimers();
    const s = createSession(level);
    s.getState().askHint();
    s.getState().play(1);
    vi.advanceTimersByTime(20);
    s.getState().undo();
    expect(s.getState().hintsUsed).toBe(1);
    s.getState().redo();
    expect(s.getState().hintsUsed).toBe(1);
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
