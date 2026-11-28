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
  // Nearly from the side, so a big pancake's rim hides little of a small one under it (every pancake is a band of
  // 44 points or more to tap on an iPhone held sideways). The stack stands a little right of the middle, clear of
  // the flips counter at the top left even on the smallest iPhone at the largest text.
  camera: { position: [-0.2, 2.98, 8.0], target: [-0.2, 2.07, 0], fov: 24, maxPolar: 1.46 },
  Scene,
};

export default level;
