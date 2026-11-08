import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'three-jugs',
  number: 8,
  title: 'Three Jugs',
  world: 'sky',
  tagline: 'Split 8 litres of potion into two fours.',
  instructions: [
    'The 8 L flask is full of potion. The 5 L and 3 L flasks are empty.',
    'Split the potion into two equal halves: 4 L in the 8 L flask and 4 L in the 5 L flask.',
    'There are no measuring marks to pour by: a pour stops only when one flask is empty or the other is full.',
  ],
  controls: ['Tap a flask to pick it up, then tap another flask to pour into it.', 'Tap the raised flask again to put it down.'],
  rules,
  bestMoves: 7,
  moveNoun: 'pours',
  moveDurationMs: MOVE_MS,
  endDelayMs: 900,
  camera: { position: [0, 3.3, 6.7], target: [0, 1.1, 0], fov: 38 },
  Scene,
};

export default level;
