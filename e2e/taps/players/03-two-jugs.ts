import type { JugId, Move, State } from '../../../levels/03-two-jugs/src/rules';
import type { TapPlayer, Vec3 } from '../harness';

/** Where each jug stands in the yard. From levels/03-two-jugs/src/layout.ts (HOME, YARD_Y = 0.6). */
const HOME: Record<JugId, Vec3> = {
  small: [4.15, 0.6, 0.7],
  big: [5.45, 0.6, 0.7],
};
const NAME: Record<JugId, string> = { small: 'the 3 L jug', big: 'the 5 L jug' };
/** The words on the three buttons that float over a picked-up jug (Scene.tsx, ActionMenu). */
const BUTTON: Record<Move['kind'], RegExp> = { fill: /Fill at pump/, pour: /Pour into/, empty: /Empty in river/ };

/**
 * Level 3: tap a jug to pick it up (three buttons pop up over it), then tap Fill, Pour or Empty.
 * The jug is found as the listening object that stands on the jug's place, and tapped in the middle
 * of what it draws.
 */
const twoJugs: TapPlayer<State, Move> = {
  async move(taps, move) {
    const jug = await taps.targetNear(HOME[move.jug], { handler: 'onClick', within: 0.5 });
    if (!jug) return taps.fault('no-response', `nothing that listens stands at the place of ${NAME[move.jug]}`);
    await taps.tapTarget(jug, NAME[move.jug]);
    const button = taps.page.getByRole('button', { name: BUTTON[move.kind] });
    try {
      await button.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return taps.fault('no-response', `the tap did not pick up ${NAME[move.jug]} (its buttons did not show): ${taps.lastTouch()}`);
    }
    await taps.tapButton(button, `the ${move.kind} button`);
  },
};

export const players: Record<string, TapPlayer> = { 'two-jugs': twoJugs };
