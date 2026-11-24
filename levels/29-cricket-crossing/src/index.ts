import type { RiddleLevel } from '@riddle/engine';
import { BoardContext, MOVE_MS, Scene as CricketScene, makeRules, type Board, type Move, type State } from '@riddle/level-21-cricket-swap';
import { createElement } from 'react';

/**
 * Cricket Swap (level 21) on a longer patch: twelve toadstools, three crickets a side, and no jar in the way.
 * Same scene, same leap. On the small patch the eight toadstools form one ring, so the crickets can only
 * chase each other round it. Here the paths branch and cross, and a careless leap blocks a friend.
 *
 * Cells are numbered row by row: 0 1 2 is the back row (far from the camera), 9 10 11 the front row.
 */
export const BOARD: Board = { cols: 3, rows: 4, start: 'AAA......BBB', goal: 'BBB......AAA', jars: [] };

export const rules = makeRules(BOARD);

const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(BoardContext.Provider, { value: BOARD }, createElement(CricketScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'cricket-crossing',
  number: 29,
  title: 'Cricket Crossing',
  world: 'lagoon',
  tagline: 'Three amber crickets, three blue ones and twelve toadstools to cross.',
  instructions: [
    'Make the crickets swap ends: blue crickets onto the blue toadstools at the back, amber crickets onto the amber ones at the front.',
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
