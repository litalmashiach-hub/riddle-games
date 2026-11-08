import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { FAIL_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'wolf-two-sheep',
  number: 1,
  title: 'Wolf and Two Sheep',
  world: 'meadow',
  tagline: 'Never leave the wolf with a lonely sheep.',
  instructions: [
    'Get the wolf and both sheep to the far bank.',
    'The boat holds the farmer and one animal.',
    'Never leave the wolf alone with exactly one sheep. Two sheep together are safe.',
  ],
  controls: ['Tap an animal to put it in the boat (tap again to take it out).', 'Tap the boat or the Row button to cross.'],
  rules,
  bestMoves: 7,
  moveNoun: 'crossings',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 5.4, 8.6], target: [0, 0.3, 0.3], fov: 45 },
  Scene,
};

export default level;
