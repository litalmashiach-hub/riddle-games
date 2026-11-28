import { solve, type SessionState } from '@riddle/engine';

/** What Hint says when no move from here leads to a win. Shell text, the same in every level. */
export const NO_WIN_LEFT = "No way to win from here. Undo a step, or restart!";

/**
 * The line for the hint toast. The session's hint, when there is one. When the level is still being
 * played but the solver finds no win from here, a line that says so: a silent Hint button looks broken.
 * That line costs nothing: the session only counts a hint that it could give.
 */
export function hintLine(s: Pick<SessionState, 'askHint' | 'status'>): string | null {
  if (s.status.kind !== 'playing') return null;
  return s.askHint() ?? NO_WIN_LEFT;
}

/**
 * A hint speaks of one position. True when it has outlived it: a move, an undo, a redo or a restart
 * changed the position, or a win or loss card came. Asking for a hint changes neither.
 */
export function hintOutlived(before: Pick<SessionState, 'history' | 'ended'>, now: Pick<SessionState, 'history' | 'ended'>): boolean {
  return now.history !== before.history || (now.ended && !before.ended);
}

/** The win card's line under the stars. It only asks "can you do it?" of a player who has not yet. */
export function winLine(moves: number, best: number, hintsUsed: number): string {
  if (moves > best) return `The best is ${best}. Can you do it?`;
  if (hintsUsed > 0) return 'That is the shortest solution! Can you do it without a hint?';
  return 'Perfect, that is the shortest solution!';
}

/**
 * The extra line on the last level's win card, when that win means every riddle is solved.
 * `count` is the number of levels in the game.
 */
export function finaleLine(count: number): string {
  return `That was the last riddle, and you have solved all ${count}. Well done, riddle master!`;
}

/**
 * True when the loss card should lead with Restart: the level asks for it, and one Undo can't save the game,
 * as no win is left from the position before the losing move.
 */
export function restartLeads(s: Pick<SessionState, 'level' | 'history' | 'status'>): boolean {
  if (!s.level.restartWhenStuck || s.status.kind !== 'lost' || s.history.length < 2) return false;
  return solve(s.level.rules, s.history[s.history.length - 2]) === null;
}
