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
  /**
   * Tell the shell what the player has picked but not yet played (an animal put in the boat), or null when
   * nothing is. Optional: only a level with a first-play `guide` needs it, to move the guide on a step.
   */
  onPick?(id: string | null): void;
}

/** One step of a first-play guide: a calm ring over one thing in the scene, and a few words. */
export interface GuideStep {
  /** The point to ring, in scene coordinates. */
  at: [number, number, number];
  /** Rough size of the thing, in scene units: the ring's radius. */
  radius: number;
  /** A few words, e.g. "Tap the wolf". */
  say: string;
  /**
   * The step lasts until the scene reports this pick through `onPick`, and the next step shows.
   * A step with none lasts until the first move, which ends the guide.
   */
  pick?: string;
}

/**
 * A light first-play guide: on the very first play of the level, the shell rings the first thing to tap.
 * It is a screen overlay that takes no taps (bar its Skip button), shown once ever on a device.
 */
export interface FirstPlayGuide {
  steps: GuideStep[];
}

/** Which step of a guide shows while the player has `picked` this (see `GuideStep.pick`). */
export function guideStepFor(guide: FirstPlayGuide, picked: string | null): number {
  let k = 0;
  while (k < guide.steps.length - 1 && guide.steps[k].pick != null && guide.steps[k].pick === picked) k++;
  return k;
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
  /**
   * `fitAspect`: the narrowest screen shape (width / height) that still shows the whole scene at this framing.
   * On narrower screens, like phones held upright, the shell pulls the camera back to keep that width. Default 1.7.
   */
  camera?: { position: [number, number, number]; target: [number, number, number]; fov?: number; fitAspect?: number };
  /** A first-play guide, shown once ever, on the level's very first play. Level 1 has one. */
  guide?: FirstPlayGuide;
  /** The 3D scene. Rendered inside the shell's <Canvas>. */
  Scene: ComponentType<SceneProps<S, M>>;
}
