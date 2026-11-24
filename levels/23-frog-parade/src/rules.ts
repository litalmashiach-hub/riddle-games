import { makeRules, type State } from '@riddle/level-13-leapfrog-lagoon/rules';

/** Leapfrog Lagoon (level 13) with a longer row: four frogs a side on nine pads. Same scene, same rules. */
export const START: State = 'GGGG.OOOO';
export const rules = makeRules(START);
