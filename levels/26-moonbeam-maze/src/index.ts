import type { RiddleLevel } from '@riddle/engine';
import { LayoutContext, MOVE_MS, Scene as MirrorScene, type Move, type State } from '@riddle/level-17-moonbeam-mirrors';
import { createElement } from 'react';

import { LAYOUT, rules } from './rules';

export { LAYOUT, rules };

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
