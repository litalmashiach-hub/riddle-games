import { makeRules, type Board } from '@riddle/level-21-cricket-swap/rules';

/**
 * Cricket Swap (level 21) on a longer patch: twelve toadstools, three crickets a side, and no jar in the way.
 * Same scene, same leap. On the small patch the eight toadstools form one ring, so the crickets can only
 * chase each other round it. Here the paths branch and cross, and a careless leap blocks a friend.
 *
 * Cells are numbered row by row: 0 1 2 is the back row (far from the camera), 9 10 11 the front row.
 */
export const BOARD: Board = { cols: 3, rows: 4, start: 'AAA......BBB', goal: 'BBB......AAA', jars: [] };

export const rules = makeRules(BOARD);
