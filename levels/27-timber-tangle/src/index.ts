import type { RiddleLevel } from '@riddle/engine';
import { JamContext, MOVE_MS, Scene as JamScene, makeJam, type Move, type Piece, type State } from '@riddle/level-18-log-jam';
import { createElement } from 'react';

/**
 * Log Jam (level 18) with a tighter knot of logs: same scene, same rules, half as many slides again.
 * Piece 0 is Dottie's raft. An original layout, checked by the tests to need exactly 30 slides.
 */
export const PIECES: Piece[] = [
  { axis: 'h', len: 2, line: 2 },
  { axis: 'h', len: 3, line: 0, rider: 'snail' },
  { axis: 'v', len: 2, line: 3 },
  { axis: 'v', len: 3, line: 5, rider: 'mushrooms' },
  { axis: 'v', len: 3, line: 4, rider: 'frog' },
  { axis: 'v', len: 3, line: 0, rider: 'mushrooms' },
  { axis: 'v', len: 2, line: 2 },
  { axis: 'h', len: 2, line: 5, rider: 'flowers' },
  { axis: 'h', len: 2, line: 1 },
  { axis: 'h', len: 2, line: 5 },
  { axis: 'v', len: 2, line: 1 },
  { axis: 'h', len: 2, line: 4, rider: 'flowers' },
];

/** Where each piece starts: the column of an 'h' piece's left end, or the row of a 'v' piece's back end. */
export const START: number[] = [1, 3, 1, 2, 3, 2, 0, 2, 4, 0, 3, 2];

/** Dottie's patience: after this many slides she tries to waddle home over the logs. */
export const PATIENCE = 75;

export const jam = makeJam(PIECES, START, PATIENCE);
export const rules = jam.rules;

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
