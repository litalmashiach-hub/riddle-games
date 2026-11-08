import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'explorers-guardians',
  number: 6,
  title: 'Explorers and Guardians',
  world: 'temple',
  tagline: 'Never let the guardians outnumber you.',
  instructions: [
    'Get all three explorers and all three stone guardians across the glowing lake.',
    'The barge holds one or two, and it needs at least one rider to move.',
    'On either bank, guardians must never outnumber the explorers standing there (riders count once they land).',
    'Guardians alone, with no explorers around, are fine.',
  ],
  controls: ['Tap an explorer or guardian to seat them in the barge (tap again to step off).', 'Tap the barge or the Sail button to cross.'],
  rules,
  bestMoves: 11,
  moveNoun: 'crossings',
  moveDurationMs: MOVE_MS,
  endDelayMs: 1700,
  camera: { position: [0, 5.6, 9.2], target: [0, 0.9, -1.2], fov: 45 },
  Scene,
};

export default level;
