import type { Flask, Move, State } from '../../../levels/08-three-jugs/src/rules';
import type { TapPlayer, Vec3 } from '../harness';

/** Where each flask stands: on its pedestal. From levels/08-three-jugs/src/Scene.tsx (X, PEDESTAL = 0.36). */
const X: Record<Flask, number> = { 0: -1.95, 1: 0, 2: 1.95 };
const place = (f: Flask): Vec3 => [X[f], 0.36, 0];
const NAME: Record<Flask, string> = { 0: 'the 8 L flask', 1: 'the 5 L flask', 2: 'the 3 L flask' };

/**
 * Level 8: tap a flask to pick it up (it rises and a "Pour into…" label shows over it), then tap the
 * flask to pour into. Each flask is found as the listening object on its pedestal and tapped in the
 * middle of what it draws.
 */
const threeJugs: TapPlayer<State, Move> = {
  async move(taps, move) {
    const from = await taps.targetNear(place(move.from), { handler: 'onClick', within: 0.5 });
    if (!from) return taps.fault('no-response', `nothing that listens stands at the place of ${NAME[move.from]}`);
    await taps.tapTarget(from, NAME[move.from]);
    try {
      await taps.page.getByText('Pour into…').waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return taps.fault('no-response', `the tap did not pick up ${NAME[move.from]} (no "Pour into…" label): ${taps.lastTouch()}`);
    }
    const to = await taps.targetNear(place(move.to), { handler: 'onClick', within: 0.5 });
    if (!to) return taps.fault('no-response', `nothing that listens stands at the place of ${NAME[move.to]}`);
    await taps.tapTarget(to, NAME[move.to]);
  },
};

export const players: Record<string, TapPlayer> = { 'three-jugs': threeJugs };
