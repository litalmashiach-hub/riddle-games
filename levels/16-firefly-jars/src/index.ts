import type { RiddleLevel } from '@riddle/engine';
import { BEST, PATIENCE, rules, type Move, type State } from './rules';
import { FAIL_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'firefly-jars',
  number: 16,
  title: 'Firefly Jars',
  world: 'lagoon',
  tagline: 'One colour of firefly in every jar.',
  instructions: [
    'Sort the fireflies so each jar glows with just one colour.',
    'Only the top firefly in a jar can fly out.',
    'It may land in an empty jar or on top of a firefly of the same colour. A jar holds four.',
    `The fireflies get grumpy: solve it within ${PATIENCE} moves or they buzz off!`,
  ],
  controls: ['Tap a jar to lift out its top firefly.', 'Tap another jar to send it there, or the same jar to put it back.'],
  rules,
  bestMoves: BEST,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 3.9, 7.6], target: [0, 1.3, 0], fov: 45 },
  Scene,
};

export default level;
