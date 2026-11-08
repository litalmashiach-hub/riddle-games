import type { RiddleLevel } from '@riddle/engine';
import { MAX_SLIDES, rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'picture-tiles',
  number: 19,
  title: 'Picture Tiles',
  world: 'lagoon',
  tagline: 'Slide the stones back into the turtle picture.',
  instructions: [
    "The fireflies mixed up the stones of Shelly the turtle's mosaic portrait.",
    'Slide the stones until the picture matches the one on the standing stone.',
    'A stone can only slide into the empty gap next to it.',
    `Shelly is sleepy: finish within ${MAX_SLIDES} slides or she nods off. Tiny numbers in the corners can help.`,
  ],
  controls: ['Tap a stone next to the gap to slide it in. Glowing stones can move.', 'When the picture is whole, the last ★ piece jumps in by itself.'],
  rules,
  bestMoves: 18,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: 3600,
  camera: { position: [0, 7.4, 8.2], target: [0, 0.75, -0.15], fov: 45 },
  Scene,
};

export default level;
