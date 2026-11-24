import { makePond } from '@riddle/level-15-slippery-pond/rules';

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
