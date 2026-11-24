import type { TapPlayer, Vec3 } from '../harness';
import { JAM as JAM_18, type Jam, type Move, type State } from '../../../levels/18-log-jam/src/rules';
import { jam as JAM_27 } from '../../../levels/27-timber-tangle/src/rules';

/** The pond's grid in the world. From levels/18-log-jam/src/layout.ts (one cell is one unit) and rules.ts (SIZE). */
const HALF = 3;
const FLOAT_Y = 0.1;
const LOG_R = 0.34;
const cell = (k: number) => k - HALF + 0.5;
/** A ring lies at this height; what listens for it is an unseen box 0.2 above. From Scene.tsx (TargetMarker). */
const RING_Y = 0.03;

/**
 * Levels 18 and 27, by taps: tap a log, wait for its glowing rings, tap the ring on the cell where the
 * log's leading end is to go. The log is tapped at the middle of its top; the ring at its exact middle
 * on the water. (The level can also be played by drags; this player does not drag.)
 */
const logs = (jam: Jam): TapPlayer<State, Move> => ({
  async move(taps, move, state) {
    const pc = jam.pieces[move.piece];
    const from = state.pos[move.piece];
    const name = move.piece === 0 ? 'the duck raft' : `log ${move.piece}`;
    const along = from + pc.len / 2 - HALF;
    const top: Vec3 = pc.axis === 'h' ? [along, FLOAT_Y + LOG_R, cell(pc.line)] : [cell(pc.line), FLOAT_Y + LOG_R, along];
    await taps.tapWorld(top, name);

    // The ring is on the cell that the log's leading end moves into (leadCell in Scene.tsx).
    const k = move.to > from ? move.to + pc.len - 1 : move.to;
    const [r, c] = pc.axis === 'h' ? [pc.line, k] : [k, pc.line];
    const ring: Vec3 = [cell(c), RING_Y, cell(r)];
    const shown = async () => !!(await taps.targetNear([ring[0], RING_Y + 0.2, ring[2]], { handler: 'onClick', within: 0.3, visibleOnly: false }));
    const end = Date.now() + 10_000;
    while (!(await shown())) {
      if (Date.now() > end) return taps.fault('no-response', `the tap on ${name} lit no ring on row ${r + 1}, column ${c + 1}: ${taps.lastTouch()}`);
      await taps.page.waitForTimeout(100);
    }
    await taps.tapWorld(ring, `the ring on row ${r + 1}, column ${c + 1}`);
  },
});

export const players: Record<string, TapPlayer> = { 'log-jam': logs(JAM_18), 'timber-tangle': logs(JAM_27) };
