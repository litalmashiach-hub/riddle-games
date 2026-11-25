import type { RiddleLevel } from '@riddle/engine';
import { CAMERA } from './places';
import { COUPLE_NAMES, COUPLE_PATTERNS, rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'jealous-couples',
  number: 7,
  title: 'Three Jealous Couples',
  world: 'sky',
  tagline: 'A balloon for two and a lot of jealousy.',
  instructions: [
    'Fly all three bird couples to the far island.',
    `A couple shares a colour and a pattern: ${COUPLE_NAMES.map((n, i) => `the ${n}s are ${COUPLE_PATTERNS[i]}`).join(', ')}.`,
    'The balloon carries one or two birds, and someone must be aboard to fly it.',
    'The gents are jealous: a lady may never be with another gent unless her own gent is there too.',
    'That counts on both islands and inside the balloon basket. Ladies alone together are fine.',
  ],
  controls: ['Tap a bird to put it in the basket (tap again to take it out).', 'Tap the balloon or the Fly button to cross.'],
  rules,
  bestMoves: 11,
  moveNoun: 'flights',
  moveDurationMs: MOVE_MS,
  endDelayMs: 2800,
  camera: CAMERA,
  Scene,
};

export default level;
