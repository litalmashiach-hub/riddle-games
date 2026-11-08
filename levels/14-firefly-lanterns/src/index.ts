import type { RiddleLevel } from '@riddle/engine';
import { MAX_TAPS, SOLUTION_CELLS, rules, type Move, type State } from './rules';
import { END_DELAY_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'firefly-lanterns',
  number: 14,
  title: 'Firefly Lanterns',
  world: 'lagoon',
  tagline: 'Every tap flips a lantern and its neighbours.',
  instructions: [
    'Light all nine lanterns on the lily pads.',
    'Tapping a pad flips its lantern and the ones right next to it: in front, behind, left and right. Lit ones go dark, dark ones light up.',
    `The fireflies get sleepy: you have ${MAX_TAPS} taps before they doze off.`,
  ],
  controls: ['Tap a lily pad. Pip the frog hops onto it and flips the lanterns.'],
  rules,
  bestMoves: SOLUTION_CELLS.length,
  moveNoun: 'taps',
  moveDurationMs: MOVE_MS,
  endDelayMs: END_DELAY_MS,
  camera: { position: [0, 8.6, 7.4], target: [0, 0, 0.8], fov: 46 },
  Scene,
};

export default level;
