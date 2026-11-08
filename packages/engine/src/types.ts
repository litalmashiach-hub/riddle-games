import type { ComponentType } from 'react';

/** Where a riddle currently stands. */
export type RiddleStatus =
  | { kind: 'playing' }
  | { kind: 'won' }
  | { kind: 'lost'; reason: string };

/**
 * The pure logic of one riddle. No React, no Three.js: this is what the
 * solver, the hint button and the tests use.
 *
 * S = a state snapshot (keep it plain data and treat it as immutable).
 * M = one player move (also plain data).
 */
export interface RiddleRules<S, M> {
  initialState: S;
  /** Every move the player is allowed to make from this state. */
  legalMoves(state: S): M[];
  /** Returns the next state. Must not mutate `state`. */
  apply(state: S, move: M): S;
  /** Won, lost (with a short, player-facing reason) or still playing. */
  status(state: S): RiddleStatus;
  /** A unique string for a state, used by the solver to skip repeats. */
  key(state: S): string;
  /** Short player-facing text for a move, used by hints. e.g. "Row the wolf across". */
  describeMove(move: M, state: S): string;
}

/** What the engine hands to a level's 3D scene. */
export interface SceneProps<S, M> {
  state: S;
  /** The state before the last move (null at the start). Handy for animations. */
  previous: S | null;
  lastMove: M | null;
  status: RiddleStatus;
  /** Make a move. Ignored while `busy` or when the game is over. */
  play(move: M): void;
  /** True while the last move is still animating. */
  busy: boolean;
  /** A move the hint button suggested, so the scene can highlight it. */
  hint: M | null;
  /** Counts up each time the level is restarted, so scenes can reset local UI state. */
  resetCount: number;
  /**
   * Number of moves made so far. When it goes up, animate the new move.
   * When it goes down (undo) or resets, snap or quickly move back.
   */
  moveCount: number;
}

export type WorldId = 'meadow' | 'temple' | 'sky' | 'citadel' | 'lagoon';

/**
 * Everything the game shell needs to show one level.
 * Each `levels/NN-name` package default-exports one of these.
 */
export interface RiddleLevel<S = any, M = any> {
  /** Kebab-case id, e.g. "wolf-two-sheep". */
  id: string;
  /** 1-based order in the game. */
  number: number;
  title: string;
  world: WorldId;
  /** One-line pitch shown on the level card. */
  tagline: string;
  /** Rules shown before and during play, one short sentence each. */
  instructions: string[];
  /** How to play (controls), one short sentence each. */
  controls: string[];
  rules: RiddleRules<S, M>;
  /** Optimal number of moves; the 3-star target. */
  bestMoves: number;
  /** Label for a move in the HUD, e.g. "crossings", "pours". */
  moveNoun: string;
  /** How long a move animates, in ms. Input is locked for this long. */
  moveDurationMs: number;
  /** Extra delay before the win/lose screen, so a fail animation can play. */
  endDelayMs?: number;
  /** Starting camera. The player can orbit a little around `target`. */
  camera?: { position: [number, number, number]; target: [number, number, number]; fov?: number };
  /** The 3D scene. Rendered inside the shell's <Canvas>. */
  Scene: ComponentType<SceneProps<S, M>>;
}
