import type { Vec3 } from '@riddle/fx';
import { CELLS, SIZE } from './rules';

/** Distance between lily pads. */
export const GAP = 1.75;
export const POND_R = 5.4;
/** Water surface height. */
export const WATER_Y = 0;

export function padPos(cell: number): Vec3 {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  return [(c - 1) * GAP, WATER_Y, (r - 1) * GAP];
}

/** The mossy stone on the front bank where the frog waits before the first tap. */
export const FROG_HOME: Vec3 = [-2.6, 0.32, 3.2];

/** Each lantern glows in its own colour once lit. */
export const LANTERN_COLORS = ['#ffd36e', '#ff9f6e', '#ff7eb6', '#c39bff', '#ffe08a', '#7ee7ff', '#9dff8a', '#ffb36e', '#ff8fa3'];

/** Shared per-frame glow (0 dark .. 1 lit) of each lantern, read by the water and the fireflies. */
export type Glows = Float32Array;
export const makeGlows = () => new Float32Array(CELLS);

/** The latest ripple on the water, started when the frog lands or splashes. */
export interface Ripple {
  x: number;
  z: number;
  /** performance.now() when it started, -1 = none. */
  t: number;
  strength: number;
}
