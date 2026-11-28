import type { TapPlayer, Taps, Vec3 } from '../harness';
import { slot, waitSpot } from '../../../levels/09-bridge-five/src/layout';
import { MINUTES, NAMES, TRAVELLERS, type Move, type State, type Traveller } from '../../../levels/09-bridge-five/src/rules';

/** Polls a reading of the page until it gives something, for up to `ms`. */
async function until<T>(read: () => Promise<T | null | false>, ms = 10_000): Promise<T | null> {
  for (const end = Date.now() + ms; ; ) {
    const got = await read();
    if (got) return got;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** The travellers whose time badge is lit (the scene paints a picked traveller's badge #ffd166; the badge's title is the name). */
async function pickedNow(taps: Taps): Promise<Traveller[]> {
  const names = Object.fromEntries(TRAVELLERS.map((t) => [t, NAMES[t]]));
  return taps.page.evaluate((names) => {
    const lit: string[] = [];
    for (const t of Object.keys(names)) {
      const badge = document.querySelector<HTMLElement>(`div[title="${names[t]}"]`);
      if (badge && /255, 209, 102|ffd166/i.test(badge.style.background)) lit.push(t);
    }
    return lit;
  }, names) as Promise<Traveller[]>;
}

const near = (a: Vec3, b: Vec3, d: number) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= d;
const list = (ts: Traveller[]) => ts.map((t) => NAMES[t]).join(', ');

/**
 * Level 9: tap each traveller who is to walk (they hop to the bridge head and their badge lights up),
 * then the scene's own Cross button in the bottom bar. A traveller is found as the listening figure
 * that stands on its waiting place (layout.ts), and tapped in the middle of the part of it that shows, clear of the name labels, or on its own
 * time label where the labels cover all of it (`tapSeenOrLabel`).
 */
const bridgeFive: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const picked: Traveller[] = [];
    const figure: Partial<Record<Traveller, string>> = {};
    for (const t of move.walkers) {
      // The walkers of the last crossing may still be stepping off the bridge when the move lock opens: wait for them.
      const fig = await until(() => taps.targetNear(slot(t, state.lantern), { handler: 'onClick', within: 0.1 }));
      if (!fig) return taps.fault('no-response', `no figure that listens came to stand at ${NAMES[t]}'s place`);
      figure[t] = fig.uuid;
      await taps.tapSeenOrLabel(fig, NAMES[t], taps.page.getByRole('button', { name: `${NAMES[t]}, ${MINUTES[t]} ${MINUTES[t] === 1 ? 'minute' : 'minutes'}`, exact: true }));
      const want = [...picked, t];
      const lit = await until(async () => {
        const now = await pickedNow(taps);
        return now.length !== picked.length || now.some((x) => !picked.includes(x)) ? now : null;
      });
      if (!lit) return taps.fault('no-response', `the tap did not pick ${NAMES[t]} (no badge lit up): ${taps.lastTouch()}`);
      if ([...lit].sort().join() !== [...want].sort().join()) {
        return taps.fault('wrong-pick', `the tap on ${NAMES[t]} left [${list(lit)}] picked, not [${list(want)}]: ${taps.lastTouch()}`);
      }
      picked.push(t);
      // Let the picked ones reach their waiting spots before the next touch, so nobody is tapped in mid-hop.
      const there = await until(async () => {
        const all = await taps.targets();
        return picked.every((p, i) => {
          const f = all.find((x) => x.uuid === figure[p]);
          return !!f && near(f.world, waitSpot(state.lantern, i), 0.05);
        });
      });
      if (!there) return taps.fault('no-response', `${list(picked)} did not come to stand at the bridge head: ${taps.lastTouch()}`);
    }
    const minutes = Math.max(...move.walkers.map((w) => MINUTES[w]));
    await taps.tapButton(taps.page.getByRole('button', { name: /Cross/ }).filter({ hasText: `${minutes} min` }), 'the Cross button');
  },
};

export const players: Record<string, TapPlayer> = { 'bridge-five': bridgeFive };
