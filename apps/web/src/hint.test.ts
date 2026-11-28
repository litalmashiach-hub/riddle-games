import { createSession, type RiddleLevel, type RiddleRules } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import { NO_WIN_LEFT, hintLine, hintOutlived, restartLeads, winLine } from './hint';

/** Count from 0 to exactly 3 by adding 1 or 2. Past 3 no win is left; 5 or more is lost. */
const rules: RiddleRules<number, number> = {
  initialState: 0,
  legalMoves: () => [1, 2],
  apply: (n, add) => n + add,
  status: (n) => (n === 3 ? { kind: 'won' } : n >= 5 ? { kind: 'lost', reason: 'Too far' } : { kind: 'playing' }),
  key: String,
  describeMove: (add) => `Add ${add}`,
};
const level = { id: 'count', number: 1, rules, bestMoves: 2, moveDurationMs: 0, endDelayMs: 0 } as unknown as RiddleLevel<number, number>;

/** A session, and the hint text as the play screen keeps it: set by Hint, cleared when the hint is outlived. */
function play() {
  const session = createSession(level);
  let text: string | null = null;
  session.subscribe((now, before) => {
    if (hintOutlived(before, now)) text = null;
  });
  const settle = () => session.setState({ busy: false });
  return {
    session,
    get text() {
      return text;
    },
    hint: () => (text = hintLine(session.getState())),
    move: (add: number) => (settle(), session.getState().play(add)),
    settle,
  };
}

describe('the hint text', () => {
  it('stays while nothing changes, and through the end of a move', () => {
    const p = play();
    p.move(1);
    expect(p.hint()).toBe('Add 2');
    p.settle();
    expect(p.text).toBe('Add 2');
    // Asking again counts a hint and marks the move, and the text stays.
    expect(p.hint()).toBe('Add 2');
    expect(p.session.getState().hintsUsed).toBe(2);
    expect(p.text).toBe('Add 2');
  });

  it('leaves on a move', () => {
    const p = play();
    expect(p.hint()).toMatch(/Add/);
    p.move(1);
    expect(p.text).toBeNull();
  });

  it('leaves on undo: the no-win line does not stand over a position that can be won', () => {
    const p = play();
    p.move(2);
    p.move(2);
    expect(p.hint()).toBe(NO_WIN_LEFT);
    p.session.getState().undo();
    expect(p.text).toBeNull();
    expect(p.hint()).toBe('Add 1');
  });

  it('leaves on redo', () => {
    const p = play();
    p.move(1);
    p.session.getState().undo();
    expect(p.hint()).toMatch(/Add/);
    p.session.getState().redo();
    expect(p.session.getState().moves).toEqual([1]);
    expect(p.text).toBeNull();
  });

  it('leaves on restart, also from the start with only a redo left', () => {
    const p = play();
    p.move(2);
    p.move(2);
    expect(p.hint()).toBe(NO_WIN_LEFT);
    p.session.getState().restart();
    expect(p.text).toBeNull();

    p.move(1);
    p.session.getState().undo();
    expect(p.hint()).toMatch(/Add/);
    p.session.getState().restart();
    expect(p.text).toBeNull();
  });

  it('leaves when a win or loss card comes', () => {
    const before = play().session.getState();
    const asked = { ...before, busy: true, hint: 1, hintsUsed: 1 };
    expect(hintOutlived(before, { ...before, ended: true })).toBe(true);
    expect(hintOutlived(before, asked)).toBe(false);
    expect(hintOutlived({ ...before, ended: true }, { ...before, ended: true })).toBe(false);
  });
});

describe('the win card line', () => {
  it('is only "can you do it?" for a player who has not', () => {
    expect(winLine(9, 7, 0)).toBe('The best is 7. Can you do it?');
    expect(winLine(9, 7, 2)).toBe('The best is 7. Can you do it?');
    expect(winLine(7, 7, 0)).toBe('Perfect, that is the shortest solution!');
  });

  it('asks a player who matched the best with a hint to do it without one', () => {
    const line = winLine(7, 7, 1);
    expect(line).not.toMatch(/Can you do it\?/);
    expect(line).not.toMatch(/The best is/);
    expect(line).toMatch(/without a hint/);
  });
});

describe('restartLeads', () => {
  const lost = { kind: 'lost', reason: 'Too far' } as const;
  const stuck = { ...level, restartWhenStuck: true } as RiddleLevel<number, number>;

  it('leads with Restart only in a level that asks, and only when one Undo cannot save the game', () => {
    // 0, 2, 4, 6: from 4 no win is left, so Undo back to it saves nothing.
    expect(restartLeads({ level: stuck, history: [0, 2, 4, 6], status: lost })).toBe(true);
    expect(restartLeads({ level, history: [0, 2, 4, 6], status: lost })).toBe(false);
    // A position before the losing move that still has a win: Undo stays first.
    expect(restartLeads({ level: stuck, history: [0, 1, 5], status: lost })).toBe(false);
  });

  it('says nothing while the level is still played or before any move', () => {
    expect(restartLeads({ level: stuck, history: [0, 2, 4], status: { kind: 'playing' } })).toBe(false);
    expect(restartLeads({ level: stuck, history: [5], status: lost })).toBe(false);
  });
});
