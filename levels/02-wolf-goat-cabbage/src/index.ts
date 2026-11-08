import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { FAIL_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'wolf-goat-cabbage',
  number: 2,
  title: 'Wolf, Goat and Cabbage',
  world: 'meadow',
  tagline: 'Everyone wants to eat someone.',
  instructions: [
    'Get the wolf, the goat and the cabbage to the far bank.',
    'The boat holds the farmer and one passenger.',
    'Never leave the wolf alone with the goat, or the goat alone with the cabbage.',
  ],
  controls: ['Tap a passenger to put it in the boat (tap again to take it out).', 'Tap the boat or the Row button to cross.'],
  rules,
  bestMoves: 7,
  moveNoun: 'crossings',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 5.4, 8.6], target: [0, 0.3, 0.3], fov: 45 },
  Scene,
};

export default level;
