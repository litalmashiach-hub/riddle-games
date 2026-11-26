import type { Move, State, Item } from '../../../levels/02-wolf-goat-cabbage/src/rules';
import type { TapPlayer } from '../harness';

/** Where each passenger stands on the right bank (mirrored on the left). From levels/02-wolf-goat-cabbage/src/Scene.tsx (SLOTS). */
const SLOTS: Record<Item, { x: number; z: number }> = {
  wolf: { x: 4.3, z: -0.7 },
  goat: { x: 3.8, z: 1.4 },
  cabbage: { x: 4.85, z: 0.45 },
};
const LABEL: Record<Item, string> = { wolf: 'with wolf', goat: 'with goat', cabbage: 'with cabbage' };

/**
 * Level 2: tap the passenger that is to ride (it hops into the boat and the Row button names it), then
 * the scene's own "Row" button. The passenger is found as the listening figure that stands on its place
 * on the bank, and tapped on its clear middle: the middle of the part of it that lies outside the
 * other figures' boxes. On the left bank the goat stands in front of the cabbage, close by: its head,
 * which turns all the time, is drawn over the cabbage's middle in some frames and not in others, and its
 * unseen tap sphere (radius 0.6) ends right at that middle. A tap on the middle of the cabbage's box
 * therefore picks the cabbage in one run and the goat in the next. A person taps the cabbage where it is
 * clear of the goat, and so does this player.
 */
const wolfGoatCabbage: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const row = taps.page.getByRole('button', { name: /Row across|Row back/ });
    if (move.passenger) {
      const s = SLOTS[move.passenger];
      // The bank's ground height is not known here (it comes from a props package), so the place is
      // given at height 0 and the nearest listening figure within reach is taken.
      const place: [number, number, number] = [(state.farmer === 'L' ? -1 : 1) * s.x, 0, s.z];
      const figure = await taps.targetNear(place, { handler: 'onClick', within: 1.2 });
      if (!figure) return taps.fault('no-response', `no figure that listens stands at the ${move.passenger}'s place`);
      await taps.tapClear(figure, `the ${move.passenger}`);
      try {
        await row.filter({ hasText: LABEL[move.passenger] }).waitFor({ state: 'visible', timeout: 10_000 });
      } catch {
        const reads = ((await row.textContent().catch(() => null)) ?? '').trim();
        if (!/alone/.test(reads)) return taps.fault('wrong-pick', `the tap on the ${move.passenger} made the Row button read "${reads}": ${taps.lastTouch()}`);
        return taps.fault('no-response', `the tap did not put the ${move.passenger} in the boat (the Row button reads "${reads}"): ${taps.lastTouch()}`);
      }
    }
    await taps.tapButton(row, 'the Row button');
  },
};

export const players: Record<string, TapPlayer> = { 'wolf-goat-cabbage': wolfGoatCabbage };
