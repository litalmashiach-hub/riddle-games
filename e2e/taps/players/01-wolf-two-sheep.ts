import type { TapPlayer } from '../harness';

type Animal = 'wolf' | 'sheepA' | 'sheepB';
type Side = 'L' | 'R';
interface State {
  farmer: Side;
  wolf: Side;
  sheepA: Side;
  sheepB: Side;
}
interface Move {
  passenger: Animal | null;
}

/** Where each animal stands on the right bank (mirrored on the left). From levels/01-wolf-two-sheep/src/Scene.tsx. */
const SLOTS: Record<Animal, { x: number; z: number }> = {
  wolf: { x: 4.1, z: -0.3 },
  sheepA: { x: 3.9, z: 1.4 },
  sheepB: { x: 5.0, z: 0.8 },
};

/**
 * Level 1: tap the animal that is to ride, then the scene's own "Row" button. The animal is found as
 * the listening figure that stands on its place, and tapped in the middle of what it draws.
 */
const wolfTwoSheep: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const row = taps.page.getByRole('button', { name: /Row across|Row back/ });
    if (move.passenger) {
      const s = SLOTS[move.passenger];
      const place: [number, number, number] = [(state.farmer === 'L' ? -1 : 1) * s.x, 0, s.z];
      const animal = await taps.targetNear(place, { handler: 'onClick', within: 1.2 });
      if (!animal) return taps.fault('no-response', `no figure that listens stands at ${move.passenger}'s place`);
      await taps.tapTarget(animal, `the ${move.passenger === 'wolf' ? 'wolf' : 'sheep'}`);
      const want = move.passenger === 'wolf' ? 'with wolf' : 'with sheep';
      try {
        await row.filter({ hasText: want }).waitFor({ state: 'visible', timeout: 10_000 });
      } catch {
        const reads = ((await row.textContent().catch(() => null)) ?? '').trim();
        if (!/alone/.test(reads)) return taps.fault('wrong-pick', `the tap on ${move.passenger} made the Row button read "${reads}": ${taps.lastTouch()}`);
        return taps.fault('no-response', `the tap did not put ${move.passenger} in the boat (the Row button reads "${reads}"): ${taps.lastTouch()}`);
      }
    }
    await taps.tapButton(row, 'the Row button');
  },
};

export const players: Record<string, TapPlayer> = { 'wolf-two-sheep': wolfTwoSheep };
