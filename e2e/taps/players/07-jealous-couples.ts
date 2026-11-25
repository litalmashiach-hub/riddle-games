import type { TapPlayer, Vec3 } from '../harness';
// The scene's own places: places.ts holds no React and no Three.js, so nothing is copied here.
import { seat, slot } from '../../../levels/07-jealous-couples/src/places';
import { nameOf, type Move, type State } from '../../../levels/07-jealous-couples/src/rules';

/** Polls a reading of the page until it gives something, for up to `ms`. */
async function until<T>(read: () => Promise<T | null | false>, ms = 10_000): Promise<T | null> {
  for (const end = Date.now() + ms; ; ) {
    const got = await read();
    if (got) return got;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 150));
  }
}

const near = (a: Vec3, b: Vec3, d: number) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= d;

/**
 * Level 7: tap each bird that is to fly (it hops into the basket and the Fly button names it), then
 * the scene's own Fly button. A bird is found as the listening figure that stands on its place on the
 * island. The birds stand in a bunch, and the middle of a bird in a back row can lie under the
 * bird in front of it, so a tap there would test a spot where the bird does not show. Each bird is
 * tapped on its visible middle instead (`tapVisible` in harness.ts): the middle of the part of it that
 * the screen shows, worked out from what is drawn.
 */
const jealousCouples: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const fly = taps.page.getByRole('button', { name: /Fly/ });
    for (const [i, b] of move.riders.entries()) {
      const fig = await until(() => taps.targetNear(slot(b, state.balloon), { handler: 'onClick', within: 0.1 }));
      if (!fig) return taps.fault('no-response', `no figure that listens came to stand at the place of ${nameOf(b)}`);
      const before = await fly.textContent();
      await taps.tapVisible(fig, nameOf(b));
      const want = move.riders.slice(0, i + 1).map(nameOf).join(' + ');
      const named = await until(async () => ((await fly.textContent().catch(() => null)) ?? '').endsWith(want));
      if (!named) {
        const after = await fly.textContent().catch(() => null);
        if (after !== before) return taps.fault('wrong-pick', `the tap on ${nameOf(b)} made the Fly button read "${after}", not "${want}": ${taps.lastTouch()}`);
        return taps.fault('no-response', `the tap did not put ${nameOf(b)} in the basket (the Fly button still reads "${after}"): ${taps.lastTouch()}`);
      }
      // Let it land in the basket before the next touch.
      const seated = await until(async () => {
        const now = (await taps.targets()).find((t) => t.uuid === fig.uuid);
        return !!now && near(now.world, seat(state.balloon, i), 0.05);
      });
      if (!seated) return taps.fault('no-response', `${nameOf(b)} was named on the Fly button and did not come to sit in the basket: ${taps.lastTouch()}`);
    }
    await taps.tapButton(fly, 'the Fly button');
  },
};

export const players: Record<string, TapPlayer> = { 'jealous-couples': jealousCouples };
