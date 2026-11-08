import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'tower-of-hanoi',
  number: 4,
  title: 'Tower of Hanoi',
  world: 'temple',
  tagline: 'Move the jade tower, one disc at a time.',
  instructions: [
    'Move the whole jade tower from the left pillar to the golden sun pillar on the right.',
    'Only the top disc of a pillar can move, one disc at a time.',
    'Never put a bigger disc on top of a smaller one.',
  ],
  controls: ['Tap a pillar to lift its top disc.', 'Tap another pillar to drop it there. Tap the same pillar to put it back.'],
  rules,
  bestMoves: 15,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: 1500,
  camera: { position: [0, 5.0, 9.8], target: [0, 1.1, -0.4], fov: 42 },
  Scene,
};

export default level;
