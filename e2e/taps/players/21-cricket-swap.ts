import type { TapPlayer, Vec3 } from '../harness';
import { BOARD as BOARD_21, cellName, freeLeaps, type Board, type Move, type State } from '../../../levels/21-cricket-swap/src/rules';
import { BOARD as BOARD_29 } from '../../../levels/29-cricket-crossing/src/rules';

/** Centre of a toadstool's flat top. From levels/21-cricket-swap/src/layout.ts. */
const GAP = 1.55;
const CAP_TOP = 0.62;
const capPos = (cell: number, board: Board): Vec3 => [((cell % board.cols) - (board.cols - 1) / 2) * GAP, CAP_TOP, (Math.floor(cell / board.cols) - (board.rows - 1) / 2) * GAP - 0.15];
/** The middle of a sitting cricket's body above its toadstool: 0.2 at scale 1.25. From Cricket.tsx. */
const BODY = 0.25;

/**
 * Levels 21 and 29: tap a cricket. If it has one place to land it leaps at once; if it has more, they
 * light up and a tap on the toadstool wanted makes the leap. What listens is an unseen cylinder around
 * each toadstool that draws nothing, so the taps go to what is seen: the middle of the cricket's body,
 * and the middle of the empty toadstool's top, where the ring lights up.
 */
const crickets = (board: Board): TapPlayer<State, Move> => ({
  async move(taps, move, state) {
    const [x, y, z] = capPos(move.from, board);
    await taps.tapWorld([x, y + BODY, z], `the cricket on the ${cellName(move.from, board)} toadstool`);
    if (freeLeaps(state, move.from, board).length < 2) return;
    // The rings that light up do not listen and nothing on the page tells of them: a short settle.
    await taps.page.waitForTimeout(400);
    await taps.tapWorld(capPos(move.to, board), `the ${cellName(move.to, board)} toadstool`);
  },
});

export const players: Record<string, TapPlayer> = { 'cricket-swap': crickets(BOARD_21), 'cricket-crossing': crickets(BOARD_29) };
