/**
 * Real faults of the game that the level tests show today.
 *
 * A level listed here still has to play through to its win: only the page error that matches
 * `pageError` is set apart. The test then ends as an expected failure, with `reason`. Once the fault
 * is fixed the error no longer comes, the test turns red ("expected to fail, but passed"), and the
 * entry is to be removed.
 *
 * Key: the level's id.
 */
export interface KnownFault {
  /** What is wrong, in one sentence. */
  reason: string;
  /** Matches "<error name>: <message>" of the page error that the fault throws. */
  pageError: RegExp;
}

const HTML_LABEL = /NotFoundError: Failed to execute 'removeChild' on 'Node'/;

export const KNOWN_FAULTS: Record<string, KnownFault> = {
  'bridge-five': {
    reason: "Level 9 throws a page error (removeChild on a node that is not a child) when play starts after the rules card: one of the scene's drei <Html> labels is removed twice.",
    pageError: HTML_LABEL,
  },
  'picture-tiles': {
    reason: "Level 19 throws a page error (removeChild on a node that is not a child) when the player leaves the level: one of the scene's drei <Html> labels is removed twice.",
    pageError: HTML_LABEL,
  },
};
