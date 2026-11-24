import type { TapPlayer, Taps, Vec3 } from '../harness';
import { bridgehead, slot } from '../../../levels/05-bridge-and-torch/src/layout';
import { EXPLORERS, MINUTES, NAMES, type Explorer, type Move, type State } from '../../../levels/05-bridge-and-torch/src/rules';

/** Polls a reading of the page until it gives something, for up to `ms`. */
async function until<T>(read: () => Promise<T | null | false>, ms = 10_000): Promise<T | null> {
  for (const end = Date.now() + ms; ; ) {
    const got = await read();
    if (got) return got;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** The explorers whose name label is lit (the scene paints a picked explorer's label #ffd166). */
async function pickedNow(taps: Taps): Promise<Explorer[]> {
  const labels = Object.fromEntries(EXPLORERS.map((e) => [e, `${NAMES[e]} · ${MINUTES[e]} min`]));
  return taps.page.evaluate((labels) => {
    const lit: string[] = [];
    for (const d of document.querySelectorAll('div')) {
      if (d.children.length) continue;
      const who = Object.keys(labels).find((e) => labels[e] === d.textContent);
      if (who && /255, 209, 102|ffd166/i.test(d.style.background)) lit.push(who);
    }
    return lit;
  }, labels) as Promise<Explorer[]>;
}

const near = (a: Vec3, b: Vec3, d: number) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= d;
/** The lane a picked explorer waits in at the bridgehead. From laneOf in the level's Scene.tsx. */
const laneOf = (picked: Explorer[], e: Explorer) => (picked.length === 1 ? 0 : picked.indexOf(e) === 0 ? 1 : -1);

/**
 * Level 5: tap each explorer who is to walk (they step to the bridgehead and their label lights up),
 * then the scene's own Cross button. An explorer is found as the listening figure that stands on its
 * waiting place (layout.ts), and tapped in the middle of what it draws.
 */
const bridgeAndTorch: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const picked: Explorer[] = [];
    const figure: Partial<Record<Explorer, string>> = {};
    for (const e of move.walkers) {
      const fig = await until(() => taps.targetNear(slot(e, state.torch), { handler: 'onClick', within: 0.1 }));
      if (!fig) return taps.fault('no-response', `no figure that listens came to stand at ${NAMES[e]}'s place`);
      figure[e] = fig.uuid;
      await taps.tapTarget(fig, NAMES[e]);
      const want = EXPLORERS.filter((x) => picked.includes(x) || x === e);
      const lit = await until(async () => {
        const now = await pickedNow(taps);
        return now.length !== picked.length || now.some((x) => !picked.includes(x)) ? now : null;
      });
      if (!lit) return taps.fault('no-response', `the tap did not pick ${NAMES[e]} (no label lit up): ${taps.lastTouch()}`);
      if (lit.join() !== want.join()) {
        return taps.fault('wrong-pick', `the tap on ${NAMES[e]} left [${lit.map((x) => NAMES[x]).join(', ')}] picked, not [${want.map((x) => NAMES[x]).join(', ')}]: ${taps.lastTouch()}`);
      }
      picked.splice(0, picked.length, ...want);
      // Let the picked ones reach the bridgehead before the next touch, so nobody is tapped in mid-hop.
      const there = await until(async () => {
        const all = await taps.targets();
        return picked.every((p) => {
          const t = all.find((x) => x.uuid === figure[p]);
          return !!t && near(t.world, bridgehead(state.torch, laneOf(picked, p)), 0.05);
        });
      });
      if (!there) return taps.fault('no-response', `${picked.map((x) => NAMES[x]).join(' and ')} did not come to stand at the bridgehead: ${taps.lastTouch()}`);
    }
    const minutes = Math.max(...move.walkers.map((w) => MINUTES[w]));
    await taps.tapButton(taps.page.getByRole('button', { name: /Cross/ }).filter({ hasText: `${minutes} min` }), 'the Cross button');
  },
};

export const players: Record<string, TapPlayer> = { 'bridge-and-torch': bridgeAndTorch };
