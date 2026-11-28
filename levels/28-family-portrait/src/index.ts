import type { RiddleLevel } from '@riddle/engine';
import { MOVE_MS, Scene as TilesScene, TilesContext, type Move, type State, type TilesPuzzle } from '@riddle/level-19-picture-tiles';
import { createElement } from 'react';
import { paintFamily } from './art';

import { MAX_SLIDES, START, rules } from './rules';

export { MAX_SLIDES, START, rules };

const puzzle: TilesPuzzle = { maxSlides: MAX_SLIDES, painter: paintFamily, plaque: 'Family' };
const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(TilesContext.Provider, { value: puzzle }, createElement(TilesScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'family-portrait',
  number: 28,
  title: 'Family Portrait',
  world: 'lagoon',
  tagline: 'Shelly has a new mosaic of the whole family, and it is in a worse muddle.',
  instructions: [
    'Shelly the turtle has a new mosaic: herself and her two little ones at sunset. The fireflies have mixed this one up too.',
    'Slide the stones until the picture matches the one on the standing stone.',
    'A stone can only slide into the empty gap next to it.',
    `Shelly is sleepy: finish within ${MAX_SLIDES} slides or she nods off. The numbers in the corners show where each stone belongs.`,
  ],
  controls: ['Tap a stone next to the gap to slide it in. Glowing stones can move.', 'When the picture is whole, the last ★ piece jumps in by itself.'],
  rules,
  bestMoves: 24,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: 3600,
  // Closer and steeper than level 19's view, so that every stone, the back row too, is over 44 points tall on an
  // iPhone held sideways (about 53 at 852 x 393, 51 at 667 x 375), with the standing stone's picture still whole
  // below the move counter. Panned a little left (x -0.45), so Shelly's patience sits between the Undo buttons
  // and the left stones, covering neither.
  camera: { position: [-0.45, 6.9, 3.5], target: [-0.45, 0.9, -0.9], fov: 45 },
  Scene,
};

export default level;
