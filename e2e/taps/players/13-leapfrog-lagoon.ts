import type { Move, State } from '../../../levels/13-leapfrog-lagoon/src/rules';
import type { TapPlayer, Vec3 } from '../harness';

/** Where pad i of a row of `pads` is. From padGap(), padX() and PAD_TOP in levels/13-leapfrog-lagoon/src/Lagoon.tsx. */
const padGap = (pads: number) => Math.min(1.42, 10.1 / (pads - 1));
const padPlace = (i: number, pads: number): Vec3 => [(i - (pads - 1) / 2) * padGap(pads), 0.07, 0];

/**
 * Levels 13 and 23: one tap on a frog makes it hop or leap. The row's length comes from the state
 * (seven pads in level 13, nine in level 23). The frog is found as the listening figure that sits on
 * its pad, and tapped in the middle of what it draws.
 */
const frogs: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const pads = state.length;
    const frog = await taps.targetNear(padPlace(move.from, pads), { handler: 'onClick', within: padGap(pads) / 2 });
    if (!frog) return taps.fault('no-response', `no frog that listens sits on pad ${move.from + 1}`);
    await taps.tapTarget(frog, `the ${state[move.from] === 'G' ? 'green' : 'orange'} frog on pad ${move.from + 1}`);
  },
};

export const players: Record<string, TapPlayer> = { 'leapfrog-lagoon': frogs, 'frog-parade': frogs };
