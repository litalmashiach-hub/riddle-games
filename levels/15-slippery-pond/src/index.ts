import type { RiddleLevel } from '@riddle/engine';
import { FAIL_MS } from './layout';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'slippery-pond',
  number: 15,
  title: 'Slippery Pond',
  world: 'lagoon',
  tagline: 'Once you start sliding, you cannot stop.',
  instructions: [
    'Help Pip the otter reach the basket of fish.',
    'The ice is slippery: Pip slides all the way until a rock or the snowy edge stops the slide.',
    'Soft snow drifts stop Pip right on top of them.',
    'Watch out for the holes in the ice. Splash!',
  ],
  controls: ['Tap a glowing arrow (or the ice in a straight line from Pip) to slide.', 'Arrow keys or WASD work too.'],
  rules,
  bestMoves: 7,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 8.7, 6.2], target: [0, -0.5, 0.2], fov: 45 },
  Scene,
};

export default level;
