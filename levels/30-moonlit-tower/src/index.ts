import type { RiddleLevel } from '@riddle/engine';
import { MOVE_MS, Scene, type Move, type State } from '@riddle/level-04-tower-of-hanoi';

import { DISCS, rules } from './rules';

export { DISCS, rules };

const level: RiddleLevel<State, Move> = {
  id: 'moonlit-tower',
  number: 30,
  title: 'Moonlit Tower',
  world: 'lagoon',
  tagline: 'The jade tower again, by night, and one disc taller.',
  instructions: [
    'The jade tower has grown a fifth disc. Move all of it from the left pillar to the golden sun pillar on the right.',
    'Only the top disc of a pillar can move, one disc at a time.',
    'Never put a bigger disc on top of a smaller one.',
    'One more disc doubles the work: every move counts.',
  ],
  controls: ['Tap a pillar to lift its top disc.', 'Tap another pillar to drop it there. Tap the same pillar to put it back.'],
  rules,
  bestMoves: 31,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: 1500,
  camera: { position: [0, 5.0, 9.8], target: [0, 1.1, -0.4], fov: 42 },
  Scene,
};

export default level;
