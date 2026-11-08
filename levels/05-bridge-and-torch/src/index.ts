import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'bridge-and-torch',
  number: 5,
  title: 'Bridge and Torch',
  world: 'temple',
  tagline: 'Four explorers, one torch, 17 minutes.',
  instructions: [
    'Get all four explorers over the rope bridge to the temple.',
    'At most two can be on the bridge at once, and they must carry the torch.',
    'Pip takes 1 minute, Juno 2, Bram 5 and Grandpa Mo 10. A pair walks at the slower pace.',
    'The torch burns out after 17 minutes.',
  ],
  controls: ['Tap one or two explorers next to the torch to send them to the bridge.', 'Tap the Cross button (or the bridge) to walk over.'],
  rules,
  bestMoves: 5,
  moveNoun: 'crossings',
  moveDurationMs: MOVE_MS,
  endDelayMs: 2800,
  camera: { position: [0, 4.6, 9.4], target: [0, -0.1, 0], fov: 46 },
  Scene,
};

export default level;
