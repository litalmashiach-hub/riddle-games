import type { RiddleLevel } from '@riddle/engine';
import { rules, type Move, type State } from './rules';
import { MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'bridge-five',
  number: 9,
  title: 'Bridge of Five',
  world: 'sky',
  tagline: 'Five travellers, one lantern, 30 minutes.',
  instructions: [
    'Get all five travellers across the sky bridge before the lantern burns out (30 minutes).',
    'At most two people can be on the bridge at once, and nobody crosses without the lantern.',
    'Each traveller has their own pace: 1, 3, 6, 8 and 12 minutes. A pair walks at the slower pace.',
    'Someone has to bring the lantern back each time.',
  ],
  controls: ['Tap one or two travellers on the lantern side to pick them (tap again to unpick).', 'Press Cross to walk them over the bridge.'],
  rules,
  bestMoves: 7,
  moveNoun: 'crossings',
  moveDurationMs: MOVE_MS,
  endDelayMs: 2600,
  camera: { position: [0, 4.6, 9.6], target: [0, 0.1, 0.3], fov: 45 },
  Scene,
};

export default level;
