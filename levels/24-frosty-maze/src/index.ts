import type { RiddleLevel } from '@riddle/engine';
import { FAIL_MS, MOVE_MS, PondContext, Scene as PondScene, makePond, type Move, type State } from '@riddle/level-15-slippery-pond';
import { createElement } from 'react';

/**
 * Slippery Pond (level 15) on another sheet of ice: same scene, same rules, a route twice as long.
 * Drawn like level 15's board: R rock, S snow drift, H ice hole, G fish basket, O the otter.
 */
export const BOARD = [
  'R..R...', //
  'R..S..R',
  '..RHSH.',
  'R......',
  '...RG..',
  '.......',
  'H.RO...',
];

export const pond = makePond(BOARD);
export const rules = pond.rules;

const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(PondContext.Provider, { value: pond }, createElement(PondScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'frosty-maze',
  number: 24,
  title: 'Frosty Maze',
  world: 'lagoon',
  tagline: 'The fish are in the middle of the ice, and the way in is anything but straight.',
  instructions: [
    'Help Pip the otter reach the basket of fish in the middle of the pond.',
    'The ice is slippery: Pip slides all the way until a rock or the snowy edge stops the slide.',
    'Soft snow drifts stop Pip right on top of them.',
    'Watch out for the holes in the ice. Splash!',
    'The way in is long and winding: some slides have to lead away from the fish.',
  ],
  controls: ['Tap a glowing arrow (or the ice in a straight line from Pip) to slide.', 'Arrow keys or WASD work too.'],
  rules,
  bestMoves: 15,
  moveNoun: 'slides',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 8.7, 6.2], target: [0, -0.5, 0.2], fov: 45, fitAspect: 1.15 },
  Scene,
};

export default level;
