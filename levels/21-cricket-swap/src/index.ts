import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'cricket-swap',
  number: 21,
  title: 'Cricket Swap',
  world: 'lagoon',
  tagline: 'Two amber crickets, two blue ones, and every leap is an L.',
  instructions: [
    'Make the crickets swap sides: blue crickets onto the blue toadstools at the back, amber crickets onto the amber ones at the front.',
    'A cricket leaps in an L: two toadstools straight, then one to the side. It may fly over anything on the way.',
    'It can only land on an empty toadstool. Nobody can land on the firefly jar in the middle.',
  ],
  controls: ['Tap a cricket to make it leap. If it has two places to land, they light up: tap one.'],
  rules,
  bestMoves: 16,
  moveNoun: 'leaps',
  moveDurationMs: MOVE_MS,
  camera: { position: [0, 6.3, 5.6], target: [0, 0.35, 0.1], fov: 40 },
  Scene,
};

export default level;
