import type { Vec3 } from '@riddle/fx';
import { SIZE, STEP, type Dir } from './rules';

/** Width of one ice tile in world units. */
export const CELL = 1.05;
/** Half the width of the ice sheet. */
export const HALF = (SIZE * CELL) / 2;
/** Height of the open water around and under the ice. */
export const WATER_Y = -0.16;

/** Centre of a tile on the ice. Column x grows to the right, row y grows towards the camera. */
export const cellPos = (x: number, y: number): Vec3 => [(x - (SIZE - 1) / 2) * CELL, 0, (y - (SIZE - 1) / 2) * CELL];

/** Which tile a point on the ice is over. */
export const posCell = (wx: number, wz: number) => ({
  x: Math.round(wx / CELL + (SIZE - 1) / 2),
  y: Math.round(wz / CELL + (SIZE - 1) / 2),
});

/** Yaw that makes a character (facing +z) look along a slide direction. */
export const dirYaw = (d: Dir) => {
  const [dx, dy] = STEP[d];
  return Math.atan2(dx, dy);
};

// Animation timing (ms).
export const WIND_MS = 220;
export const PER_CELL_MS = 125;
export const SLIDE_EXTRA_MS = 140;
export const REACT_MS = 420;
export const slideMs = (steps: number) => steps * PER_CELL_MS + SLIDE_EXTRA_MS;
/** Longest slide on a 7-wide pond is 6 tiles. */
export const MOVE_MS = WIND_MS + slideMs(SIZE - 1) + REACT_MS;
/** The fall into the water: wobble on the edge, drop, then pop back up shivering. */
export const TEETER_MS = 620;
export const DROP_MS = 330;
export const UNDER_MS = 520;
export const FAIL_MS = TEETER_MS + DROP_MS + UNDER_MS + 1100;
