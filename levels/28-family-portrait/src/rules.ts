import { makeRules } from '@riddle/level-19-picture-tiles/rules';

/**
 * Picture Tiles (level 19) with a new picture and a worse muddle: same scene, same rules.
 * `tiles[cell]` is the tile in that cell, row by row from the top-left; 0 is the gap.
 * 24 slides from solved (proved by the test). No stone starts where it belongs.
 */
export const START: readonly number[] = [5, 1, 0, 2, 4, 8, 6, 7, 3];
/** Shelly's patience. One more slide than this and she nods off. */
export const MAX_SLIDES = 80;

export const rules = makeRules(START, MAX_SLIDES);
