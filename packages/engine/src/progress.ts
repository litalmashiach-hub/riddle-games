/** Saved progress, kept in the browser's localStorage. */
export interface Progress {
  /** Best star count per level id. */
  stars: Record<string, number>;
}

const KEY = 'riddle-games:progress:v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { stars: {}, ...JSON.parse(raw) };
  } catch {
    /* private mode or blocked storage: start fresh */
  }
  return { stars: {} };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function recordStars(p: Progress, levelId: string, stars: number): Progress {
  const prev = p.stars[levelId] ?? 0;
  if (stars <= prev) return p;
  const next = { ...p, stars: { ...p.stars, [levelId]: stars } };
  saveProgress(next);
  return next;
}
