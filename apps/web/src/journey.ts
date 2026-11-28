import type { Progress } from '@riddle/engine';

/** What these helpers need of a map entry (apps/web/src/levels.ts). */
interface Entry {
  id: string;
  number: number;
  /** Set when the level is built; "coming soon" entries have none. */
  level?: unknown;
}

const solved = (p: Progress, id: string) => (p.stars[id] ?? 0) > 0;

/**
 * The level the player is up to, which the sideways map rings in gold and opens on: the first open, built
 * level without a star. Undefined once every built level is solved: the game is finished, and nothing is next.
 */
export function upNext<E extends Entry>(levels: readonly E[], progress: Progress, isOpen: (e: E) => boolean): E | undefined {
  return levels.find((l) => l.level && isOpen(l) && !solved(progress, l.id));
}

/** True when a win of this level finishes the game: it is the last built level, and every other one is solved. */
export function finishesGame(levels: readonly Entry[], id: string, progress: Progress): boolean {
  const built = levels.filter((l) => l.level);
  const last = built[built.length - 1];
  return !!last && last.id === id && built.every((l) => l.id === id || solved(progress, l.id));
}
