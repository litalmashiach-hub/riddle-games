import { padPos } from '../../../levels/14-firefly-lanterns/src/layout';
import type { Move, State } from '../../../levels/14-firefly-lanterns/src/rules';
import type { TapPlayer } from '../harness';

/**
 * Level 14: one tap on a lily pad. The pad and the lantern that stands on it are one listening object;
 * it is tapped in the middle of what it draws (the pad with its lantern).
 */
const lanterns: TapPlayer<State, Move> = {
  async move(taps, move) {
    const pad = await taps.targetNear(padPos(move.cell), { handler: 'onClick', within: 0.5 });
    if (!pad) return taps.fault('no-response', `no lily pad that listens lies at cell ${move.cell}`);
    await taps.tapTarget(pad, `the lily pad of cell ${move.cell}`);
  },
};

export const players: Record<string, TapPlayer> = { 'firefly-lanterns': lanterns };
