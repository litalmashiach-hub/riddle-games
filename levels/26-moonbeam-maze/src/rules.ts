import { makeRules, type Layout } from '@riddle/level-17-moonbeam-mirrors/rules';

/**
 * Moonbeam Mirrors (level 17) with a fuller pond: same scene, same rules, eleven crystals and five flowers.
 * Columns run left to right, rows back to front; the beam comes in from the left on the middle row.
 */
export const LAYOUT: Layout = {
  source: { c: -1, r: 2, dir: 'E' },
  mirrors: [
    { c: 0, r: 3, start: '/' },
    { c: 2, r: 4, start: '\\' },
    { c: 2, r: 2, start: '\\' },
    { c: 4, r: 1, start: '/' },
    { c: 0, r: 2, start: '\\' },
    { c: 3, r: 2, start: '\\' },
    { c: 3, r: 0, start: '/' },
    { c: 4, r: 3, start: '\\' },
    { c: 1, r: 0, start: '\\' },
    { c: 2, r: 3, start: '/' },
    { c: 1, r: 1, start: '/' },
  ],
  flowers: [
    { c: 3, r: 1 },
    { c: 3, r: 3 },
    { c: 2, r: 1 },
    { c: 2, r: 0 },
    { c: 0, r: 4 },
  ],
  toad: { c: 0, r: 1 },
  rocks: [
    { c: 0, r: 0 },
    { c: 4, r: 0 },
  ],
  maxTurns: 14,
};

export const rules = makeRules(LAYOUT);
