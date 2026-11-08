import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'four-pillar-tower',
  number: 10,
  title: 'Four-Pillar Tower',
  world: 'citadel',
  tagline: 'Hanoi with an extra pillar and a bigger stack.',
  instructions: [
    'Move the whole tower of six cogs to the golden pillar on the right.',
    'Move one cog at a time, and only the top cog of a pillar.',
    'A cog can never sit on a smaller cog.',
    'You have four pillars, not three. Use the spare ones well!',
  ],
  controls: ['Tap a pillar to lift its top cog.', 'Tap another pillar to drop it there (tap the same pillar to put it back).'],
  rules,
  bestMoves: 17,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: 1800,
  camera: { position: [0, 3.3, 8.6], target: [0, 1.3, 0], fov: 42 },
  Scene,
};

export default level;
