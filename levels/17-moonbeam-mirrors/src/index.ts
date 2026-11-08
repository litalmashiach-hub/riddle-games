import type { RiddleLevel } from '@riddle/engine';
import { LAYOUT, rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'moonbeam-mirrors',
  number: 17,
  title: 'Moonbeam Mirrors',
  world: 'lagoon',
  tagline: 'Bounce the moonbeam onto every moon-flower.',
  instructions: [
    'A moonbeam shines across the lagoon. Crystal mirrors bounce it to the side.',
    'Light all four moon-flowers with the beam at the same time to make them bloom.',
    'Shh! Never let the beam touch the sleeping toad, or he will sneeze everything away.',
    `The moon sets after ${LAYOUT.maxTurns} turns.`,
  ],
  controls: ['Tap a crystal to turn it.', 'Watch where the beam goes before you tap the next one.'],
  rules,
  bestMoves: 6,
  moveNoun: 'turns',
  moveDurationMs: MOVE_MS,
  endDelayMs: 3600,
  camera: { position: [0, 8.6, 7.4], target: [0, 0, 0.55], fov: 45 },
  Scene,
};

export default level;
