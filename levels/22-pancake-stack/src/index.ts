import type { RiddleLevel } from '@riddle/engine';
import { MAX_FLIPS, rules, type Move, type State } from './rules';
import { END_DELAY_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'pancake-stack',
  number: 22,
  title: 'Pancake Stack',
  world: 'lagoon',
  tagline: 'Flip the top of the stack until the biggest is at the bottom.',
  instructions: [
    'Sort the pancakes by size: the biggest at the bottom, the smallest on top.',
    'Chef Pom can only slide his spatula under a pancake and flip it together with everything above it. That turns the top part of the stack upside down.',
    `The tower gets wobbly: a lantern goes out with every flip, and after ${MAX_FLIPS} flips it topples.`,
  ],
  controls: ['Tap a pancake to flip it and all the pancakes above it.'],
  rules,
  bestMoves: 7,
  moveNoun: 'flips',
  moveDurationMs: MOVE_MS,
  endDelayMs: END_DELAY_MS,
  camera: { position: [0.6, 3.3, 6.3], target: [0.6, 1.75, 0], fov: 38 },
  Scene,
};

export default level;
