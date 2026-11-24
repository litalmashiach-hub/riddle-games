import type { RiddleLevel } from '@riddle/engine';
import { FAIL_MS, MOVE_MS, Scene, type Move, type State } from '@riddle/level-13-leapfrog-lagoon';

import { START, rules } from './rules';

export { START, rules };

const level: RiddleLevel<State, Move> = {
  id: 'frog-parade',
  number: 23,
  title: 'Frog Parade',
  world: 'lagoon',
  tagline: 'Four green frogs, four orange frogs, and still only one empty pad.',
  instructions: [
    'Four green frogs and four orange frogs want to swap sides of the lagoon.',
    'Frogs only go forward, the way they are looking. They never turn back.',
    'A frog can hop onto the empty lily pad right in front of it.',
    'Or it can leap over one frog that is looking at it, if the pad just behind that frog is empty. Frogs never leap over their own team.',
    'If nobody can move, the frogs are stuck. Bonk!',
  ],
  controls: ['Tap a frog to make it hop or leap.', 'Stuck? Use Undo to take back a hop.'],
  rules,
  bestMoves: 24,
  moveNoun: 'hops',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 4.6, 8.8], target: [0, 0.35, -0.2], fov: 44, fitAspect: 1.95 },
  Scene,
};

export default level;
