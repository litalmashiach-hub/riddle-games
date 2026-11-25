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
   * The move's number, from 1. More than one where the same kind of touch is lost in some runs and not
   * in others: a run that gets past the first such step stops at a later one. Every step listed was seen
   * in a run of the whole level.
   */
  steps: number[];
  kind: TapFaultKind;
  /** What happens, in one or two sentences. */
  reason: string;
}

const ALL = ['iphone-landscape', 'iphone-small-landscape', 'iphone-large-landscape'];

export const KNOWN_TAP_FAULTS: Record<string, KnownTapFault[]> = {
  'family-crossing': [
    {
      sizes: ALL,
      steps: [1, 3, 14],
      kind: 'wrong-pick',
      reason:
        "Level 11: a tap on the middle of the guard puts Dad on the raft (move 1, or move 3 if move 1 got through), and late in the level a tap on the thief puts Mom on it (move 14). The one in front takes the touch with its unseen tap cylinder, which is wider than its body, and the same tap is lost in some runs and not in others.",
    },
  ],
  'log-jam': [
    {
      sizes: ALL,
      steps: [3, 17, 19],
      kind: 'no-move',
      reason:
        "Level 18: with the log picked, a tap on the middle of its glowing ring is lost to the upright log on the next cell toward the camera, which takes the touch with its unseen grab box (move 3, and in a run that gets past it, move 17 or 19, both on a ring that lies right behind a log). Dragging the log works.",
    },
  ],
  'timber-tangle': [
    {
      sizes: ALL,
      steps: [2, 9],
      kind: 'no-move',
      reason:
        "Level 27: with a log picked, a tap on the middle of its ring is lost to a log's unseen grab box (another log at move 2, the picked log itself at move 9). Which move it stops at changes from run to run. Dragging the log works.",
    },
  ],
};
