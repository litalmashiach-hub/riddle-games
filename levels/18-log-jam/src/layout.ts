import type { Vec3 } from '@riddle/fx';
import { EXIT_ROW, PIECES, SIZE } from './rules';

/** One grid cell is one world unit. The pond is centred on the origin. */
export const HALF = SIZE / 2;
export const cellX = (c: number) => c - HALF + 0.5;
export const cellZ = (r: number) => r - HALF + 0.5;
export const EXIT_Z = cellZ(EXIT_ROW);

/** Logs float half sunk; this is the height of a log's axis. */
export const FLOAT_Y = 0.1;
export const LOG_R = 0.34;

/** World centre of piece `i` when its start is at `p`. */
export function pieceCenter(i: number, p: number): Vec3 {
  const pc = PIECES[i];
  const along = p + pc.len / 2 - HALF;
  return pc.axis === 'h' ? [along, FLOAT_Y, cellZ(pc.line)] : [cellX(pc.line), FLOAT_Y, along];
}

/** The lagoon past the gap in the bank, where the ducklings wait. */
export const LAGOON: { x: number; z: number; r: number } = { x: 6.5, z: EXIT_Z, r: 2.05 };
/** Half the width of the channel from the pond to the lagoon. */
export const CHANNEL_HALF = 0.56;
/** Where the raft parks in the lagoon after a win. */
export const RAFT_HOME: Vec3 = [LAGOON.x - 0.3, FLOAT_Y, EXIT_Z + 0.3];

/** Timing. */
export const SLIDE_MS = 560;
export const MOVE_MS = SLIDE_MS + 60;
export const SAIL_MS = 1800;
