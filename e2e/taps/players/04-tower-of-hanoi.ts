import type { Move, Peg, State } from '../../../levels/04-tower-of-hanoi/src/rules';
import type { TapPlayer, Taps, Vec3 } from '../harness';

/** Where the three pillars stand. From levels/04-tower-of-hanoi/src/Scene.tsx (PEG_X). */
const PEG_X = [-2.7, 0, 2.7];
const NAME = ['the left pillar', 'the middle pillar', 'the right pillar'];

async function tapPillar(taps: Taps, p: Peg) {
  const place: Vec3 = [PEG_X[p], 0, 0];
  const pillar = await taps.targetNear(place, { handler: 'onClick', within: 0.3 });
  if (!pillar) return taps.fault('no-response', `nothing that listens stands at the place of ${NAME[p]}`);
  await taps.tapTarget(pillar, NAME[p]);
}

/**
 * Levels 4 and 30 (the same scene with five discs): tap a pillar to lift its top disc, then tap the
 * pillar it goes to. Only the pillars listen (the discs do not), so each tap goes to the middle of the
 * pillar as drawn: plinth, rod and orb.
 */
const tower: TapPlayer<State, Move> = {
  async move(taps, move) {
    await tapPillar(taps, move.from);
    // The lifted disc is not a listening object and nothing on the page changes, so there is no sign
    // to wait for: a short settle only.
    await taps.page.waitForTimeout(300);
    await tapPillar(taps, move.to);
  },
};

export const players: Record<string, TapPlayer> = { 'tower-of-hanoi': tower, 'moonlit-tower': tower };
