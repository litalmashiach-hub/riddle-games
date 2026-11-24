import type { RiddleRules } from '@riddle/engine';

/**
 * Pancake Stack ("pancake sorting", posed by Jacob Goodman in 1975: sort a stack using only a spatula).
 *
 * Six pancakes of six sizes are stacked in a muddle. The only move: slide the spatula under any pancake
 * and flip it together with everything above it, which turns that top part of the stack upside down.
 * Sort the stack so the biggest is at the bottom and the smallest on top.
 * The pancakes cool down: after MAX_FLIPS flips without success the wobbly tower topples and the level is lost.
 *
 * This starting stack is one of only two (out of 720) that need the most flips of all: seven.
 */
export const PANCAKES = 6;
export const MAX_FLIPS = 12;

export interface State {
  /** Sizes from the top of the stack down. 1 is the smallest pancake, PANCAKES the biggest. */
  stack: number[];
  flips: number;
}

/** Flip the top `count` pancakes (2 or more: flipping just the top one changes nothing). */
export interface Move {
  count: number;
}

export const START: number[] = [5, 3, 6, 1, 4, 2];

export const flipTop = (stack: number[], count: number) => [...stack.slice(0, count).reverse(), ...stack.slice(count)];
export const isSorted = (stack: number[]) => stack.every((size, i) => size === i + 1);

export const rules: RiddleRules<State, Move> = {
  initialState: { stack: START, flips: 0 },
  legalMoves: () => Array.from({ length: PANCAKES - 1 }, (_, i) => ({ count: i + 2 })),
  apply: (s, m) => ({ stack: flipTop(s.stack, m.count), flips: s.flips + 1 }),
  status: (s) => {
    if (isSorted(s.stack)) return { kind: 'won' };
    if (s.flips >= MAX_FLIPS) return { kind: 'lost', reason: `After ${MAX_FLIPS} flips the wobbly tower toppled over. Flop!` };
    return { kind: 'playing' };
  },
  key: (s) => `${s.stack.join('')}|${s.flips}`,
  describeMove: (m) => (m.count === PANCAKES ? 'Flip the whole stack' : `Flip the top ${m.count} pancakes`),
};
