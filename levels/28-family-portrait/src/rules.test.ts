import { solve } from '@riddle/engine';
import first, { SOLVED, type State } from '@riddle/level-19-picture-tiles';
import { describe, expect, it } from 'vitest';
import level, { MAX_SLIDES, START, rules } from './index';

describe('Family Portrait', () => {
  it('is solvable in the advertised number of slides', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(24);
  });

  it('is a worse muddle than level 19', () => {
    expect(level.bestMoves).toBeGreaterThan(first.bestMoves);
    // No stone starts in its home cell.
    expect(START.filter((t, i) => t !== 0 && t === SOLVED[i]).length).toBe(0);
    expect([...START].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('only lets tiles next to the gap move', () => {
    const moves = rules.legalMoves(rules.initialState).map((m) => m.cell).sort();
    // the gap starts in the top right corner, so only the two stones beside it can slide
    expect(moves).toEqual([1, 5]);
  });

  it('wins when the picture is whole', () => {
    const s: State = { tiles: [1, 2, 3, 4, 5, 6, 7, 0, 8], slides: 5 };
    const done = rules.apply(s, { cell: 8 });
    expect(done.tiles).toEqual(SOLVED);
    expect(rules.status(done).kind).toBe('won');
  });

  it('loses when Shelly runs out of patience, with room for mistakes before that', () => {
    const s: State = { tiles: rules.initialState.tiles, slides: MAX_SLIDES - 1 };
    const next = rules.apply(s, rules.legalMoves(s)[0]);
    const st = rules.status(next);
    expect(st.kind).toBe('lost');
    expect(st.kind === 'lost' && st.reason).toMatch(/80 slides/);
    expect(MAX_SLIDES).toBeGreaterThanOrEqual(level.bestMoves * 3);
  });

  it('finds a hint quickly enough for a phone', () => {
    const t = performance.now();
    solve(rules);
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
