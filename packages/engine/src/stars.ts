/**
 * 3 stars: optimal, no hints. 2 stars: within 50% of optimal (or optimal with hints).
 * 1 star: solved.
 */
export function starsFor(moves: number, bestMoves: number, hintsUsed: number): 1 | 2 | 3 {
  if (moves <= bestMoves && hintsUsed === 0) return 3;
  if (moves <= Math.ceil(bestMoves * 1.5)) return 2;
  return 1;
}
