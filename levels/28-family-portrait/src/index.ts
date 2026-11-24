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
    `Shelly is sleepy: finish within ${MAX_SLIDES} slides or she nods off. Tiny numbers in the corners can help.`,
  ],
  controls: ['Tap a stone next to the gap to slide it in. Glowing stones can move.', 'When the picture is whole, the last ★ piece jumps in by itself.'],
  rules,
  bestMoves: 24,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: 3600,
  camera: { position: [0, 7.4, 8.2], target: [0, 0.75, -0.15], fov: 45 },
  Scene,
};

export default level;
