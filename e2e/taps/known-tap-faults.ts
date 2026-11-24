import type { TapFaultKind } from './harness';

/**
 * Steps that a finger cannot make today, found by the real-tap run. This run mends no level: a level
 * listed here is expected to stop at one of the steps named, in exactly this way, at the sizes named.
 * Its test then ends as an expected failure. Once the level is mended the test turns red
 * ("expected to fail, but passed"), and the entry is to be removed. A fault at another step, or of
 * another kind, fails the test like any other.
 *
 * Key: the level's id. `sizes` are the run's project names. In every entry the touch is aimed at the
 * middle of the thing as it is drawn, with the scene on top at that point.
 */
export interface KnownTapFault {
  sizes: string[];
  /**
   * The move's number, from 1. More than one where the aim point lies on the very edge of what takes
   * the touch, so that the same touch is lost in one run at an earlier step and in another at a later one.
   */
  steps: number[];
  kind: TapFaultKind;
  /** What happens, in one or two sentences. */
  reason: string;
}

const ALL = ['iphone-landscape', 'iphone-small-landscape', 'iphone-large-landscape'];

export const KNOWN_TAP_FAULTS: Record<string, KnownTapFault[]> = {
  'wolf-goat-cabbage': [
    {
      // At 956 by 440 the same tap reached the cabbage and the level was won: the edge of the goat's
      // sphere lies close to the cabbage's middle there.
      sizes: ['iphone-landscape', 'iphone-small-landscape'],
      steps: [5],
      kind: 'wrong-pick',
      reason:
        "Level 2, move 5 (row the cabbage across): on the left bank a tap on the middle of the cabbage puts the goat in the boat. The goat stands in front, and its unseen tap sphere (radius 0.6) reaches over the cabbage's middle.",
    },
  ],
  'jealous-couples': [
    {
      sizes: ALL,
      steps: [1],
      kind: 'wrong-pick',
      reason:
        "Level 7, move 1 (Mrs Coral and Mr Coral fly): a tap on the middle of Mrs Coral picks Mr Teal, who stands in front of her with his top hat over her. Aiming at her head instead gets as far as move 10, where only a sliver of her shows beside his hat.",
    },
  ],
  'family-crossing': [
    {
      sizes: ['iphone-landscape'],
      steps: [1, 3],
      kind: 'wrong-pick',
      reason:
        "Level 11, the guard's first or second crossing: a tap on the middle of the guard puts Dad on the raft. Dad stands in front, and his unseen tap cylinder (radius 0.38) is wider than his body and ends at the guard's middle, so the same tap is lost at move 1 in one run and at move 3 in another.",
    },
    {
      sizes: ['iphone-small-landscape', 'iphone-large-landscape'],
      steps: [1],
      kind: 'wrong-pick',
      reason: "Level 11, move 1 (the guard and the thief cross): a tap on the middle of the guard puts Dad on the raft. Dad's unseen tap cylinder is wider than his body and covers the guard's middle.",
    },
  ],
  'twelve-coins': [
    {
      sizes: ALL,
      steps: [1],
      kind: 'wrong-pick',
      reason:
        "Level 12, first weighing: a tap on the middle of coin 3, in the far row, sends coin 9 to the pan. Each coin's unseen grab cylinder (radius 0.4, the coin drawn 0.24) covers the lower half of the coin behind it; coin 4 loses to coin 10 the same way.",
    },
  ],
  'log-jam': [
    {
      sizes: ALL,
      steps: [3],
      kind: 'no-move',
      reason:
        "Level 18, move 3: with the log picked, a tap on the middle of its glowing ring is lost. The upright log on the next cell toward the camera takes the touch with its unseen grab box and is picked instead. Dragging the log works.",
    },
  ],
  'timber-tangle': [
    {
      sizes: ALL,
      steps: [9],
      kind: 'no-move',
      reason:
        "Level 27, move 9: with the long log picked, a tap on the middle of the ring right behind its own far end is lost. The picked log's unseen grab box takes the touch and the log is put down. Dragging the log works.",
    },
  ],
};
