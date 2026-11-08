import type { RiddleLevel } from '@riddle/engine';
import { MOVE_MS } from './layout';
import { PATIENCE, rules, type Move, type State } from './rules';
import { Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'log-jam',
  number: 18,
  title: 'Log Jam',
  world: 'lagoon',
  tagline: 'Slide the logs aside and free the duck raft.',
  instructions: [
    'Dottie the duck is stuck on her raft. Get the raft out through the gap in the right bank.',
    'Logs only slide along their length, never sideways, and never through each other.',
    'One slide counts as one move, however far it goes.',
    `Dottie gets grumpy. After ${PATIENCE} slides she will try to hop home over the logs!`,
  ],
  controls: ['Drag a log along the water to slide it.', 'Or tap a log, then tap a glowing ring to send it there.'],
  rules,
  bestMoves: 20,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: 4200,
  camera: { position: [1.2, 9.2, 7.4], target: [1.2, 0, 0.2], fov: 44 },
  Scene,
};

export default level;
