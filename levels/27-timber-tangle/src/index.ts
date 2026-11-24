import type { RiddleLevel } from '@riddle/engine';
import { JamContext, MOVE_MS, Scene as JamScene, type Move, type State } from '@riddle/level-18-log-jam';
import { createElement } from 'react';

import { PATIENCE, PIECES, START, jam, rules } from './rules';

export { PATIENCE, PIECES, START, jam, rules };

const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(JamContext.Provider, { value: jam }, createElement(JamScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'timber-tangle',
  number: 27,
  title: 'Timber Tangle',
  world: 'lagoon',
  tagline: 'A tighter knot of logs, and Dottie is no more patient than before.',
  instructions: [
    'Dottie the duck is stuck again, and this jam is tighter. Get her raft out through the gap in the right bank.',
    'Logs only slide along their length, never sideways, and never through each other.',
    'One slide counts as one move, however far it goes.',
    `Dottie gets grumpy. After ${PATIENCE} slides she will try to hop home over the logs!`,
  ],
  controls: ['Drag a log along the water to slide it.', 'Or tap a log, then tap a glowing ring to send it there.'],
  rules,
  bestMoves: 30,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: 4200,
  camera: { position: [1.2, 9.2, 7.4], target: [1.2, 0, 0.2], fov: 44 },
  Scene,
};

export default level;
