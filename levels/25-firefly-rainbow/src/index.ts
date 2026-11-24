import type { RiddleLevel } from '@riddle/engine';
import { FAIL_MS, JarsContext, MOVE_MS, Scene as JarsScene, jarRow, makeRules, type Jar, type JarsPuzzle, type Move, type State } from '@riddle/level-16-firefly-jars';
import { createElement } from 'react';

/**
 * Firefly Jars (level 16) with a fifth colour and a seventh jar: same scene, same rules, a longer sort.
 * Jar contents, bottom first. Five full jars and two empty ones.
 */
export const START: Jar[] = [
  ['sky', 'violet', 'gold', 'pink'],
  ['violet', 'mint', 'pink', 'sky'],
  ['mint', 'gold', 'mint', 'violet'],
  ['violet', 'sky', 'pink', 'mint'],
  ['gold', 'pink', 'gold', 'sky'],
  [],
  [],
];

/** Shortest solution length (checked by the test). */
export const BEST = 20;
/** After this many moves without solving, the fireflies have had enough. */
export const PATIENCE = 36;

export const rules = makeRules(START, PATIENCE);

const puzzle: JarsPuzzle = { start: START, patience: PATIENCE, row: jarRow(START.length) };
const Scene: RiddleLevel<State, Move>['Scene'] = (props) => createElement(JarsContext.Provider, { value: puzzle }, createElement(JarsScene, props));

const level: RiddleLevel<State, Move> = {
  id: 'firefly-rainbow',
  number: 25,
  title: 'Firefly Rainbow',
  world: 'lagoon',
  tagline: 'Five colours of firefly now, and only two jars to spare.',
  instructions: [
    'Sort the fireflies so each jar glows with just one colour. There are five colours this time.',
    'Only the top firefly in a jar can fly out.',
    'It may land in an empty jar or on top of a firefly of the same colour. A jar holds four.',
    `The fireflies get grumpy: solve it within ${PATIENCE} moves or they buzz off!`,
  ],
  controls: ['Tap a jar to lift out its top firefly.', 'Tap another jar to send it there, or the same jar to put it back.'],
  rules,
  bestMoves: BEST,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: FAIL_MS,
  camera: { position: [0, 3.9, 7.6], target: [0, 1.3, 0], fov: 45 },
  Scene,
};

export default level;
