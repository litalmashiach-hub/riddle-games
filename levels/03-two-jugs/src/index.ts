import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'two-jugs',
  number: 3,
  title: 'Two Jugs',
  world: 'meadow',
  tagline: 'Measure exactly 4 litres with a 3 and a 5.',
  instructions: [
    'Get exactly 4 litres of water into one jug.',
    'You have a 3 L jug and a 5 L jug, with no marks in between.',
    'Fill a jug at the pump, empty it into the river, or pour one into the other until it is full or empty.',
  ],
  controls: [
    'Tap a jug to pick it up, then choose Fill, Pour or Empty.',
    'Or, holding a jug, tap the pump, the river or the other jug.',
  ],
  rules,
  bestMoves: 6,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: 1800,
  camera: { position: [3.95, 3.2, 4.9], target: [4.85, 0.95, -0.4], fov: 45 },
  Scene,
};

export default level;
