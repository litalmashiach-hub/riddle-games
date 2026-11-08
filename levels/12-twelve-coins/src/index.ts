import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'twelve-coins',
  number: 12,
  title: 'The Twelve Coins',
  world: 'citadel',
  tagline: 'One fake coin. Three weighings.',
  instructions: [
    'One of the 12 gold coins is a fake. It is either a little heavier or a little lighter than the rest.',
    'You may use the great balance only 3 times.',
    'Then name the fake coin and say if it is heavier or lighter.',
    'The vault is cunning: a lucky guess never works. Only a plan that covers every case will open it.',
  ],
  controls: [
    'Tap a coin to put it on the left pan, tap again for the right pan, once more to take it back.',
    'Press Weigh when both pans hold the same number of coins.',
    'Press Name the fake, tap a coin, then choose heavier or lighter.',
  ],
  rules,
  bestMoves: 4,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: 2200,
  camera: { position: [0, 6.3, 8.6], target: [0, 0.75, -0.1], fov: 45 },
  Scene,
};

export default level;
