import type { TapPlayer, Vec3 } from '../harness';
import { seat, slot } from '../../../levels/06-explorers-guardians/src/layout';
import { isExplorer, type Move, type State, type Who } from '../../../levels/06-explorers-guardians/src/rules';

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
const nameOf = (w: Who) => `${isExplorer(w) ? 'explorer' : 'guardian'} ${w}`;

/**
 * Level 6: tap each rider (it hops onto the barge), then the scene's own Sail button. A rider is found
 * as the listening figure that stands on its place on the bank (layout.ts) and tapped in the middle of
 * what it draws. The sign that the tap took: that same figure comes to sit on its seat in the barge.
 */
const explorersGuardians: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const sail = taps.page.getByRole('button', { name: /Sail/ });
    for (const [i, w] of move.riders.entries()) {
      const fig = await until(() => taps.targetNear(slot(w, state.boat), { handler: 'onClick', within: 0.1 }));
      if (!fig) return taps.fault('no-response', `no figure that listens came to stand at the place of ${nameOf(w)}`);
      const before = await sail.textContent();
      await taps.tapTarget(fig, nameOf(w));
      const seated = await until(async () => {
        const now = (await taps.targets()).find((t) => t.uuid === fig.uuid);
        return !!now && near(now.world, seat(state.boat, state.boat, i), 0.05);
      });
      if (!seated) {
        const after = await sail.textContent().catch(() => null);
        if (after !== before) return taps.fault('wrong-pick', `the tap on ${nameOf(w)} did not seat it; the Sail button went from "${before}" to "${after}": ${taps.lastTouch()}`);
        return taps.fault('no-response', `the tap did not seat ${nameOf(w)} in the barge (the Sail button still reads "${after}"): ${taps.lastTouch()}`);
      }
    }
    await taps.tapButton(sail, 'the Sail button');
  },
};

export const players: Record<string, TapPlayer> = { 'explorers-guardians': explorersGuardians };
