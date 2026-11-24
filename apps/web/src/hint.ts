import type { SessionState } from '@riddle/engine';

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
