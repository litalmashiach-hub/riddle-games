import type { Vec3 } from '@riddle/fx';
import { BOARD, type Board } from './rules';

export const GAP = 1.55;
/** Height of a toadstool's flat top, where crickets sit. */
export const CAP_TOP = 0.62;
/** Height of the mossy islet the toadstools grow on. */
export const GROUND = 0.12;

/** Centre of a toadstool's top. */
export const capPos = (cell: number, board: Board = BOARD): Vec3 => [((cell % board.cols) - (board.cols - 1) / 2) * GAP, CAP_TOP, (Math.floor(cell / board.cols) - (board.rows - 1) / 2) * GAP - 0.15];
