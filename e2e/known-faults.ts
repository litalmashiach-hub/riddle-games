/**
 * Real faults of the game that the level tests show today.
 *
 * A level listed here still has to play through to its win. Only one page error is set apart: the
 * first that matches `pageError` and comes during `when`. A second one, or one at any other moment,
 * fails the test like any other page error. The test then ends as an expected failure, with `reason`.
 * Once the fault is fixed the error no longer comes, the test turns red ("expected to fail, but
 * passed"), and the entry is to be removed.
 *
 * Key: the level's id.
 */
export interface KnownFault {
  /** What is wrong, in one sentence. */
  reason: string;
  /** Matches "<error name>: <message>" of the page error that the fault throws. */
  pageError: RegExp;
  /**
   * The part of the play-through in which the error comes:
   * 'start' is from the tap on "Let's go!" to the end of the first move,
   * 'leave' is from the tap on "All levels" on the win card to the end of the test.
   */
  when: 'start' | 'leave';
}

export const KNOWN_FAULTS: Record<string, KnownFault> = {};
