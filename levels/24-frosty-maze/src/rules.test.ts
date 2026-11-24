import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level, { BOARD, pond, rules } from './index';

describe('Frosty Maze', () => {
  it('is solvable in the advertised number of slides', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(15);
  });

  it('has only one shortest route, so the puzzle has a clear answer', () => {
    // Count shortest paths with a breadth-first search over otter positions.
    const dist = new Map<string, number>([[rules.key(pond.start), 0]]);
    const ways = new Map<string, number>([[rules.key(pond.start), 1]]);
    const queue = [pond.start];
    let goalWays = 0;
    while (queue.length) {
      const s = queue.shift()!;
      const k = rules.key(s);
      if (rules.status(s).kind === 'won') {
        if (dist.get(k) === level.bestMoves) goalWays += ways.get(k)!;
        continue;
      }
      for (const m of rules.legalMoves(s)) {
        const n = rules.apply(s, m);
        if (rules.status(n).kind === 'lost') continue;
        const nk = rules.key(n);
        const d = dist.get(k)! + 1;
        if (!dist.has(nk)) {
          dist.set(nk, d);
          ways.set(nk, ways.get(k)!);
          queue.push(n);
        } else if (dist.get(nk) === d) ways.set(nk, ways.get(nk)! + ways.get(k)!);
      }
    }
    expect(goalWays).toBe(1);
  });

  it('can always be won from wherever the otter stops, so Hint always has an answer', () => {
    const seen = new Set<string>([rules.key(pond.start)]);
    const todo = [pond.start];
    while (todo.length) {
      const s = todo.pop()!;
      if (rules.status(s).kind !== 'playing') continue;
      expect(solve(rules, s)).not.toBeNull();
      for (const m of rules.legalMoves(s)) {
        const n = rules.apply(s, m);
        if (!seen.has(rules.key(n))) {
          seen.add(rules.key(n));
          todo.push(n);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('plays the known solution to the basket', () => {
    let s = pond.start;
    for (const dir of ['up', 'left', 'up', 'right', 'up', 'left', 'up', 'right', 'down', 'right', 'right', 'up', 'left', 'down', 'down'] as const) {
      expect(rules.status(s).kind).toBe('playing');
      s = rules.apply(s, { dir });
    }
    expect(rules.status(s).kind).toBe('won');
  });

  it('has holes to fall in and a drift to stop on', () => {
    expect(pond.cellsOf('H').length).toBe(3);
    expect(pond.cellsOf('S').length).toBe(2);
    expect(BOARD.join('').split('G').length).toBe(2);
    // Two slides from the start end in the water: up to the rock, then right into the hole.
    const s = rules.apply(rules.apply(pond.start, { dir: 'up' }), { dir: 'left' });
    expect(pond.slide(s, 'up').stopper).toBe('rock');
    expect(pond.slide({ x: 0, y: 5 }, 'down').stopper).toBe('hole');
    expect(rules.status({ x: 0, y: 6 }).kind).toBe('lost');
  });

  it('is a different pond from level 15, and twice as long', async () => {
    const first = (await import('@riddle/level-15-slippery-pond')).default;
    expect(level.bestMoves).toBeGreaterThanOrEqual(first.bestMoves * 2);
  });
});
