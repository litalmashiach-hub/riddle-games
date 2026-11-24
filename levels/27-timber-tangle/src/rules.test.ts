import { solve } from '@riddle/engine';
import first, { SIZE, cells } from '@riddle/level-18-log-jam';
import { describe, expect, it } from 'vitest';
import level, { PATIENCE, PIECES, START, jam, rules } from './index';

describe('Timber Tangle', () => {
  it('starts with every piece inside the pond and no overlaps', () => {
    const covered = PIECES.flatMap((p, i) => cells(p, START[i]));
    for (const [r, c] of covered) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(SIZE);
      expect(c).toBeLessThan(SIZE);
    }
    expect(new Set(covered.map(([r, c]) => r * SIZE + c)).size).toBe(covered.length);
    expect(jam.grid(START).filter((g) => g >= 0).length).toBe(covered.length);
  });

  it('is solvable in exactly the advertised number of slides', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(30);
    expect(level.bestMoves).toBeLessThan(PATIENCE);
  });

  it('takes half as many slides again as level 18', () => {
    expect(level.bestMoves).toBeGreaterThanOrEqual(first.bestMoves * 1.5);
  });

  it('is the hardest way to set these logs out, and can be won from wherever the logs end up', () => {
    // Walk every position the logs can reach. All can still be won, and none needs more slides than the start.
    const seen = new Map<string, number[]>([[START.join(','), START]]);
    const todo = [START];
    for (let i = 0; i < todo.length; i++) {
      for (const m of rules.legalMoves({ pos: todo[i], moves: 0 })) {
        const pos = todo[i].slice();
        pos[m.piece] = m.to;
        if (!seen.has(pos.join(','))) {
          seen.set(pos.join(','), pos);
          todo.push(pos);
        }
      }
    }
    // Slides needed from each position: search outward from every freed position at once.
    const dist = new Map<string, number>();
    const queue: number[][] = [];
    for (const pos of todo) {
      if (jam.isFree(pos)) {
        dist.set(pos.join(','), 0);
        queue.push(pos);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const d = dist.get(queue[i].join(','))!;
      PIECES.forEach((_, piece) => {
        for (const to of jam.reach(queue[i], piece)) {
          const pos = queue[i].slice();
          pos[piece] = to;
          if (!dist.has(pos.join(','))) {
            dist.set(pos.join(','), d + 1);
            queue.push(pos);
          }
        }
      });
    }
    expect(dist.size).toBe(seen.size);
    expect(Math.max(...dist.values())).toBe(30);
    expect(dist.get(START.join(','))).toBe(30);
    expect(seen.size).toBeGreaterThan(10000);
  });

  it('boxes the raft in at the start', () => {
    expect(jam.reach(START, 0)).toEqual([]);
    for (const m of rules.legalMoves(rules.initialState)) {
      const next = rules.apply(rules.initialState, m);
      const covered = PIECES.flatMap((p, i) => cells(p, next.pos[i]));
      expect(new Set(covered.map(([r, c]) => r * SIZE + c)).size).toBe(covered.length);
    }
  });

  it('runs out of patience after too many slides', () => {
    let s = rules.initialState;
    const m = rules.legalMoves(s)[0];
    const back = { piece: m.piece, to: s.pos[m.piece] };
    for (let i = 0; i < PATIENCE; i++) s = rules.apply(s, i % 2 === 0 ? m : back);
    expect(rules.status(s).kind).toBe('lost');
  });

  it('describes hint moves in plain words', () => {
    const sol = solve(rules)!;
    expect(rules.describeMove(sol.moves[0], rules.initialState)).toMatch(/^Slide .+ (left|right|up|down) \d space/);
  });
});
