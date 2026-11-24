import { makeRules, type Jar } from '@riddle/level-16-firefly-jars/rules';

/**
 * Firefly Jars (level 16) with a fifth colour and a seventh jar: same scene, same rules, a longer sort.
 * Jar contents, bottom first. Five full jars and two empty ones.
 */
export const START: Jar[] = [
  ['sky', 'violet', 'gold', 'pink'],
  ['violet', 'mint', 'pink', 'sky'],
  ['mint', 'gold', 'mint', 'violet'],
  ['violet', 'sky', 'pink', 'mint'],
  ['gold', 'pink', 'gold', 'sky'],
  [],
  [],
];

/** Shortest solution length (checked by the test). */
export const BEST = 20;
/** After this many moves without solving, the fireflies have had enough. */
export const PATIENCE = 36;

export const rules = makeRules(START, PATIENCE);
