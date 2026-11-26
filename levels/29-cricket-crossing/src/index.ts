import type { RiddleLevel } from '@riddle/engine';
import { BoardContext, MOVE_MS, Scene as CricketScene, type Move, type State } from '@riddle/level-21-cricket-swap';
import { createElement } from 'react';

import { BOARD, rules } from './rules';

export { BOARD, rules };

const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(BoardContext.Provider, { value: BOARD }, createElement(CricketScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'cricket-crossing',
  number: 29,
  title: 'Cricket Crossing',
  world: 'lagoon',
  tagline: 'Three striped crickets, three spotted ones and twelve toadstools to cross.',
  instructions: [
    'Make the crickets swap ends: the spotted blue crickets onto the spotted blue toadstools at the back, the striped amber crickets onto the striped amber ones at the front.',
    'A cricket leaps in an L: two toadstools straight, then one to the side. It may fly over anything on the way.',
    'It can only land on an empty toadstool. There are three crickets a side now, so they get in each other\'s way.',
  ],
  controls: ['Tap a cricket to make it leap. If it has more than one place to land, they light up: tap one.'],
  rules,
  bestMoves: 16,
  moveNoun: 'leaps',
  moveDurationMs: MOVE_MS,
  camera: { position: [0, 7.9, 6.2], target: [0, 0.35, -0.05], fov: 40 },
  Scene,
};

export default level;
