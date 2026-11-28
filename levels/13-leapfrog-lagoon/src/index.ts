import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { FAIL_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'leapfrog-lagoon',
  number: 13,
  title: 'Leapfrog Lagoon',
  world: 'lagoon',
  tagline: 'Three green frogs, three orange frogs, one empty lily pad.',
  instructions: [
    'Three green frogs and three orange frogs want to swap sides of the lagoon.',
    'Frogs only go forward, the way they are looking. They never turn back.',
    'A frog can hop onto the empty lily pad right in front of it.',
    'Or it can leap over one frog that is looking at it, if the pad just behind that frog is empty. Frogs never leap over their own team.',
    'A wrong hop can leave the frogs no way to swap sides. Then they bump noses at once. Bonk!',
  ],
  controls: ['Tap a frog to make it hop or leap.', 'Bonk? Undo takes back the hop that did it, or Restart starts over.'],
  rules,
  bestMoves: 15,
  moveNoun: 'hops',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 4.4, 8.2], target: [0, 0.35, -0.2], fov: 44 },
  Scene,
};

export default level;

// For a second helping of this riddle with a longer row (see levels/23-frog-parade).
export { makeRules, goalOf, type Move, type State } from './rules';
export { FAIL_MS, MOVE_MS, Scene } from './Scene';
