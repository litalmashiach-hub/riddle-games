import type { TapPlayer, Vec3 } from '../harness';
import type { Move, Person, Side, State } from '../../../levels/11-family-crossing/src/rules';

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

// The places below are copied from levels/11-family-crossing/src: SLOTS and slot from layout.ts (which
// imports Canal.tsx, a file that draws), QUAY_Y and CANAL_HALF from Canal.tsx, DECK_Y from Raft.tsx,
// seat and LABEL from Scene.tsx.
const sign = (s: Side) => (s === 'L' ? -1 : 1);
const QUAY_Y = 0.4;
const DECK_Y = 0.26;
const RAFT_X = 2.5 - 1.22;
const SLOTS: Record<Person, { x: number; z: number }> = {
  guard: { x: 3.25, z: -1.55 },
  thief: { x: 4.5, z: -1.7 },
  father: { x: 3.3, z: -0.4 },
  mother: { x: 4.45, z: -0.45 },
  sonA: { x: 3.2, z: 0.75 },
  sonB: { x: 4.15, z: 0.85 },
  daughterA: { x: 3.3, z: 1.9 },
  daughterB: { x: 4.3, z: 1.95 },
};
const slot = (p: Person, side: Side): Vec3 => [sign(side) * SLOTS[p].x, QUAY_Y, SLOTS[p].z];
/** The two places on the raft: 0 is nearest the bank it is docked at. */
const seat = (side: Side, i: number): Vec3 => [sign(side) * RAFT_X + sign(side) * (i === 0 ? 0.5 : -0.38), DECK_Y, 0.12];
/** The spoken names of the name labels, from SPOKEN in Scene.tsx. */
const SPOKEN: Record<Person, string> = {
  father: 'Dad',
  mother: 'Mom',
  sonA: 'First son',
  sonB: 'Second son',
  daughterA: 'First daughter',
  daughterB: 'Second daughter',
  guard: 'Guard',
  thief: 'Thief',
};
const LABEL: Record<Person, string> = { father: 'Dad', mother: 'Mom', sonA: 'Son', sonB: 'Son', daughterA: 'Daughter', daughterB: 'Daughter', guard: 'Guard', thief: 'Thief' };

/**
 * Level 11: tap each rider (it hops onto the raft and the Cast off button names it), then the scene's
 * own Cast off button. A rider is found as the listening figure that stands on its place on the quay
 * and tapped in the middle of the part of it that shows, clear of the name labels, or on its own
 * name label where the labels cover all of it (`tapSeenOrLabel`). The sign that the tap took: that same figure comes to
 * stand on its place on the raft.
 */
const familyCrossing: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const castOff = taps.page.getByRole('button', { name: /Cast off/ });
    for (const [i, p] of move.riders.entries()) {
      const what = `${LABEL[p]} (${p})`;
      const fig = await until(() => taps.targetNear(slot(p, state.raft), { handler: 'onClick', within: 0.1 }));
      if (!fig) return taps.fault('no-response', `no figure that listens came to stand at the place of ${what}`);
      const before = await castOff.textContent();
      await taps.tapSeenOrLabel(fig, what, taps.page.getByRole('button', { name: SPOKEN[p], exact: true }));
      const seated = await until(async () => {
        const now = (await taps.targets()).find((t) => t.uuid === fig.uuid);
        return !!now && near(now.world, seat(state.raft, i), 0.05);
      });
      if (!seated) {
        const after = await castOff.textContent().catch(() => null);
        if (after !== before) return taps.fault('wrong-pick', `the tap on ${what} did not put it on the raft; the Cast off button went from "${before}" to "${after}": ${taps.lastTouch()}`);
        return taps.fault('no-response', `the tap did not put ${what} on the raft (the Cast off button still reads "${after}"): ${taps.lastTouch()}`);
      }
    }
    await taps.tapButton(castOff, 'the Cast off button');
  },
};

export const players: Record<string, TapPlayer> = { 'family-crossing': familyCrossing };
