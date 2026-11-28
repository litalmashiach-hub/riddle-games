import { describe, expect, it } from 'vitest';
import { finaleLine, winLine } from './hint';
import { finishesGame, upNext } from './journey';

/** Four built levels and one "coming soon" card, opened as the map opens them: each after the ones before. */
const levels = [
  { id: 'a', number: 1, level: {} },
  { id: 'b', number: 2, level: {} },
  { id: 'c', number: 3, level: {} },
  { id: 'd', number: 4, level: {} },
  { id: 'e', number: 5 },
];
const open = (stars: Record<string, number>) => (l: { number: number }) => levels.filter((x) => x.level && x.number < l.number).every((x) => (stars[x.id] ?? 0) > 0);
const at = (stars: Record<string, number>) => upNext(levels, { stars }, open(stars))?.id;

describe('the level the map rings as next', () => {
  it('is the first open level without a star', () => {
    expect(at({})).toBe('a');
    expect(at({ a: 3 })).toBe('b');
    expect(at({ a: 3, b: 1, c: 2 })).toBe('d');
  });

  it('is none once every level is solved (30 of 30), not level 1', () => {
    expect(at({ a: 3, b: 3, c: 3, d: 3 })).toBeUndefined();
    expect(at({ a: 1, b: 2, c: 1, d: 1 })).toBeUndefined();
  });
});

describe('the last win', () => {
  it('finishes the game only on the last level, with every other one solved', () => {
    expect(finishesGame(levels, 'd', { stars: { a: 3, b: 3, c: 1 } })).toBe(true);
    // Again, when it is played once more after the end.
    expect(finishesGame(levels, 'd', { stars: { a: 3, b: 3, c: 1, d: 2 } })).toBe(true);
    // Not with one before it unsolved, and never on another level.
    expect(finishesGame(levels, 'd', { stars: { a: 3, c: 1 } })).toBe(false);
    expect(finishesGame(levels, 'c', { stars: { a: 3, b: 3, d: 3 } })).toBe(false);
    expect(finishesGame(levels, 'e', { stars: { a: 3, b: 3, c: 3, d: 3 } })).toBe(false);
  });

  it('says in the game voice that every riddle is solved', () => {
    expect(finaleLine(30)).toBe('That was the last riddle, and you have solved all 30. Well done, riddle master!');
    expect(winLine(31, 31, 0)).toBe('Perfect, that is the shortest solution!');
  });
});
