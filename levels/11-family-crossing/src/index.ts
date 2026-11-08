import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'family-crossing',
  number: 11,
  title: 'Family Crossing',
  world: 'citadel',
  tagline: 'A family, a guard and a thief on one raft.',
  instructions: [
    'Get all eight across the canal. The raft holds two.',
    'Only Dad, Mom and the guard can steer the raft.',
    'Dad can’t be with a daughter unless Mom is there.',
    'Mom can’t be with a son unless Dad is there.',
    'The thief can’t be with any of the family unless the guard is there.',
  ],
  controls: [
    'Tap people on the raft’s side to seat them (tap again to stand them up).',
    'Tap the raft or the Cast off button to cross.',
  ],
  rules,
  bestMoves: 17,
  moveNoun: 'crossings',
  moveDurationMs: MOVE_MS,
  endDelayMs: 1500,
  camera: { position: [0, 5.2, 8.9], target: [0, 0.9, -0.9], fov: 46 },
  Scene,
};

export default level;
