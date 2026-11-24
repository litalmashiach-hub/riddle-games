import type { RiddleLevel } from '@riddle/engine';
import { LayoutContext, MOVE_MS, Scene as MirrorScene, makeRules, type Layout, type Move, type State } from '@riddle/level-17-moonbeam-mirrors';
import { createElement } from 'react';

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

const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(LayoutContext.Provider, { value: LAYOUT }, createElement(MirrorScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'moonbeam-maze',
  number: 26,
  title: 'Moonbeam Maze',
  world: 'lagoon',
  tagline: 'Five moon-flowers, eleven crystals and one very light sleeper.',
  instructions: [
    'A moonbeam shines across the lagoon. Crystal mirrors bounce it to the side.',
    'Light all five moon-flowers with the beam at the same time to make them bloom.',
    'Shh! Never let the beam touch the sleeping toad, or he will sneeze everything away. He sleeps right beside the way in, so mind the order of your turns.',
    `The moon sets after ${LAYOUT.maxTurns} turns.`,
  ],
  controls: ['Tap a crystal to turn it.', 'Watch where the beam goes before you tap the next one.'],
  rules,
  bestMoves: 9,
  moveNoun: 'turns',
  moveDurationMs: MOVE_MS,
  endDelayMs: 3600,
  camera: { position: [0, 8.6, 7.4], target: [0, 0, 0.55], fov: 45 },
  Scene,
};

export default level;
