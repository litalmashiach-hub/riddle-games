import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { rules, slide, START } from './rules';

describe('Slippery Pond', () => {
  it('is solvable in the advertised number of slides', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(7);
  });

  it('slides until a rock stops it', () => {
    expect(slide(START, 'up')).toEqual({ to: { x: 3, y: 5 }, steps: 1, stopper: 'rock' });
  });

  it('stops at the snowy rim', () => {
    expect(slide(START, 'right')).toEqual({ to: { x: 6, y: 6 }, steps: 3, stopper: 'edge' });
  });

  it('cannot slide into the rim it is already touching', () => {
    expect(rules.legalMoves(START).map((m) => m.dir)).not.toContain('down');
  });

  it('falls in an ice hole', () => {
    const s = rules.apply(START, { dir: 'left' });
    expect(rules.status(s).kind).toBe('lost');
  });

  it('stops on a snow drift', () => {
    const s = slide({ x: 1, y: 5 }, 'up');
    expect(s.stopper).toBe('snow');
    expect(s.to).toEqual({ x: 1, y: 2 });
  });

  it('plays the known solution to the basket', () => {
    let s = START;
    for (const dir of ['up', 'left', 'up', 'up', 'right', 'up', 'right'] as const) s = rules.apply(s, { dir });
    expect(rules.status(s).kind).toBe('won');
  });
});
