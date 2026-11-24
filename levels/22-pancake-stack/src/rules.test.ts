import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { MAX_FLIPS, PANCAKES, START, flipTop, isSorted, rules, type State } from './rules';

/** Fewest flips needed from every possible stack, by searching outward from the sorted one (a flip undoes itself). */
function flipsNeeded(): Map<string, number> {
  const goal = Array.from({ length: PANCAKES }, (_, i) => i + 1);
  const dist = new Map<string, number>([[goal.join(''), 0]]);
  let frontier = [goal];
  while (frontier.length) {
    const next: number[][] = [];
    for (const stack of frontier) {
      for (let count = 2; count <= PANCAKES; count++) {
        const t = flipTop(stack, count);
        if (dist.has(t.join(''))) continue;
        dist.set(t.join(''), dist.get(stack.join(''))! + 1);
        next.push(t);
      }
    }
    frontier = next;
  }
  return dist;
}

describe('Pancake Stack', () => {
  it('is solvable in the advertised number of flips, and no fewer', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(7);
    const end = sol!.moves.reduce((s, m) => rules.apply(s, m), rules.initialState);
    expect(end.stack).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rules.status(end).kind).toBe('won');
  });

  it('starts from one of the hardest stacks there is', () => {
    const dist = flipsNeeded();
    expect(dist.size).toBe(720);
    const worst = Math.max(...dist.values());
    expect(worst).toBe(7);
    expect(dist.get(START.join(''))).toBe(worst);
    expect([...dist.values()].filter((d) => d === worst).length).toBe(2);
  });

  it('leaves room for the simple way: biggest to the top, then down to its place', () => {
    // That method needs at most two flips per pancake, and none for the last one.
    let s: State = rules.initialState;
    for (let size = PANCAKES; size > 1 && !isSorted(s.stack); size--) {
      const at = s.stack.indexOf(size);
      if (at === size - 1) continue;
      if (at > 0) s = rules.apply(s, { count: at + 1 });
      s = rules.apply(s, { count: size });
    }
    expect(isSorted(s.stack)).toBe(true);
    expect(s.flips).toBeLessThan(MAX_FLIPS);
  });

  it('flips the top part of the stack upside down', () => {
    expect(flipTop([5, 3, 6, 1, 4, 2], 3)).toEqual([6, 3, 5, 1, 4, 2]);
    expect(flipTop([5, 3, 6, 1, 4, 2], 6)).toEqual([2, 4, 1, 6, 3, 5]);
    expect(rules.legalMoves(rules.initialState).map((m) => m.count)).toEqual([2, 3, 4, 5, 6]);
    const s = rules.apply(rules.initialState, { count: 2 });
    expect(s.stack).toEqual([3, 5, 6, 1, 4, 2]);
    expect(rules.initialState.stack).toEqual(START);
  });

  it('loses when the tower topples', () => {
    let s = rules.initialState;
    for (let i = 0; i < MAX_FLIPS; i++) s = rules.apply(s, { count: 2 });
    expect(s.stack).toEqual(START);
    expect(rules.status(s).kind).toBe('lost');
  });

  it('still counts a win on the very last flip', () => {
    // Waste as many flips as can be spared. Whatever stack that leaves, seven flips are always enough.
    let s = rules.initialState;
    for (let i = 0; i < MAX_FLIPS - 7; i++) s = rules.apply(s, { count: 2 });
    expect(rules.status(s).kind).toBe('playing');
    const rest = solve(rules, s);
    expect(rest).not.toBeNull();
    s = rest!.moves.reduce((st, m) => rules.apply(st, m), s);
    expect(s.flips).toBeLessThanOrEqual(MAX_FLIPS);
    expect(rules.status(s).kind).toBe('won');
  });

  it('gives a hint a player can follow', () => {
    expect(rules.describeMove({ count: 3 }, rules.initialState)).toBe('Flip the top 3 pancakes');
    expect(rules.describeMove({ count: 6 }, rules.initialState)).toBe('Flip the whole stack');
  });
});
