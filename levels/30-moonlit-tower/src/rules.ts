import { makeRules } from '@riddle/level-04-tower-of-hanoi/rules';

/**
 * Tower of Hanoi (level 4) with a fifth disc: same scene, same rules, twice the work.
 * It is played in the lagoon's twilight, so the old temple is seen by night.
 */
export const DISCS = 5;
export const rules = makeRules(DISCS);
