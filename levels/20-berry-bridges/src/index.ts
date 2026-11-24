import type { RiddleLevel } from '@riddle/engine';
import { BRIDGES, rules, type Move, type State } from './rules';
import { END_DELAY_MS, MOVE_MS, Scene } from './Scene';

const level: RiddleLevel<State, Move> = {
  id: 'berry-bridges',
  number: 20,
  title: 'Berry Bridges',
  world: 'lagoon',
  tagline: 'Cross every bridge once. Each one sinks behind you.',
  instructions: [
    `Collect all ${BRIDGES.length} glow-berries. One hangs over the middle of every bridge.`,
    'The reed bridges are soggy: each one sinks as soon as Bramble the hedgehog has crossed it.',
    'Bramble may start on any islet. If he ends up on an islet with no bridge left while berries remain, he is stranded.',
  ],
  controls: ['Tap an islet to start there. Then tap a ringed islet next door to cross the bridge to it.'],
  rules,
  bestMoves: BRIDGES.length + 1,
  moveNoun: 'moves',
  moveDurationMs: MOVE_MS,
  endDelayMs: END_DELAY_MS,
  camera: { position: [-0.85, 8.3, 6.5], target: [-0.85, 0, 0.1], fov: 42, fitAspect: 2.15 },
  Scene,
};

export default level;
