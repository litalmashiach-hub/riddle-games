import type { Move, State } from '../../../levels/12-twelve-coins/src/rules';
import type { Point, TapPlayer, Taps, Target, Vec3 } from '../harness';

/** Where coin i lies on the table. From traySlot() in levels/12-twelve-coins/src/Scene.tsx (TABLE_Y 0.82, TABLE_Z 1.5 in Vault.tsx). */
const traySlot = (i: number): Vec3 => [((i % 6) - 2.5) * 0.8, 0.82 + 0.13, 1.5 - 0.35 + Math.floor(i / 6) * 0.72];

/** The scene's own line of text over its buttons: "Left 1 · Right 0: ...", "Tap the coin you think is fake." and so on. */
const message = (taps: Taps) => taps.page.locator('.tc-controls');

/**
 * Level 12: a tap on a coin puts it on the left pan, a second tap on it (now on the pan) moves it to the
 * right pan. So the coins for the right pan go first, each with two taps, then the coins for the left pan
 * with one tap each, then the scene's own "Weigh" button. To name the fake: the "Name the fake" button,
 * a tap on the coin, then "Heavier" or "Lighter". Every coin is tapped in the middle of what it draws,
 * where it is at that moment (table or pan), once it has come to rest.
 */
function coins(): TapPlayer<State, Move> {
  /** The listening object of each coin, found once while all twelve lie on the table. */
  let ids: string[] = [];

  /** The coin as it is now, once it has stopped moving (coins hop to the pans and fly back after a weighing). */
  async function atRest(taps: Taps, coin: number): Promise<Target> {
    let last: Point | null = null;
    const end = Date.now() + 10_000;
    for (;;) {
      const t = (await taps.targets()).find((x) => x.uuid === ids[coin]);
      if (!t) return taps.fault('no-response', `coin ${coin + 1} is no longer in the scene`);
      const now = taps.middleOf(t);
      if (last && Math.hypot(now.x - last.x, now.y - last.y) < 0.5) return t;
      if (Date.now() > end) return taps.fault('no-response', `coin ${coin + 1} never came to rest`);
      last = now;
      await taps.page.waitForTimeout(250);
    }
  }

  /** The coins that are off their places on the table right now (on a pan, or on the way). */
  async function offTable(taps: Taps): Promise<number[]> {
    const all = await taps.targets();
    return ids.flatMap((id, i) => {
      const t = all.find((x) => x.uuid === id);
      const home = traySlot(i);
      return t && Math.hypot(t.world[0] - home[0], t.world[1] - home[1], t.world[2] - home[2]) > 0.5 ? [i] : [];
    });
  }

  async function tapCoin(taps: Taps, coin: number, where: string, sign: string | RegExp, toPan = true) {
    const before = toPan ? await offTable(taps) : [];
    await taps.tapTarget(await atRest(taps, coin), `coin ${coin + 1} ${where}`);
    if (toPan && !before.includes(coin)) {
      // A coin tapped on the table must leave it for a pan. If another coin leaves instead, the game picked that one.
      const end = Date.now() + 10_000;
      for (;;) {
        const now = await offTable(taps);
        if (now.includes(coin)) break;
        const other = now.find((c) => !before.includes(c));
        if (other !== undefined) return taps.fault('wrong-pick', `the tap on coin ${coin + 1} ${where} sent coin ${other + 1} to the pan instead: ${taps.lastTouch()}`);
        if (Date.now() > end) return taps.fault('no-response', `coin ${coin + 1} did not leave the table after the tap: ${taps.lastTouch()}`);
        await taps.page.waitForTimeout(150);
      }
    }
    try {
      await message(taps).filter({ hasText: sign }).waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      taps.fault('no-response', `the scene's text did not come to say "${sign}" after the tap on coin ${coin + 1} ${where}; it says "${(await message(taps).innerText().catch(() => '')).split('\n')[0]}": ${taps.lastTouch()}`);
    }
  }

  return {
    async setup(taps) {
      ids = [];
      for (let i = 0; i < 12; i++) {
        const t = await taps.targetNear(traySlot(i), { handler: 'onClick', within: 0.3 });
        if (!t) return taps.fault('no-response', `no coin that listens lies on place ${i + 1} of the table`);
        ids.push(t.uuid);
      }
    },

    async move(taps, move) {
      const button = (name: RegExp) => taps.page.getByRole('button', { name });
      if (move.kind === 'accuse') {
        await taps.tapButton(button(/Name the fake/), 'the "Name the fake" button');
        await message(taps).filter({ hasText: 'Tap the coin you think is fake' }).waitFor({ state: 'visible', timeout: 10_000 });
        await tapCoin(taps, move.coin, 'on the table', `Coin ${move.coin + 1} is the fake`, false);
        await taps.tapButton(button(move.heavy ? /Heavier/ : /Lighter/), move.heavy ? 'the "Heavier" button' : 'the "Lighter" button');
        return;
      }
      let right = 0;
      for (const c of move.right) {
        await tapCoin(taps, c, 'on the table', `Left 1 · Right ${right}:`);
        right++;
        await tapCoin(taps, c, 'on the left pan', `Left 0 · Right ${right}:`);
      }
      let left = 0;
      for (const c of move.left) {
        left++;
        await tapCoin(taps, c, 'on the table', `Left ${left} · Right ${right}:`);
      }
      await taps.tapButton(button(/Weigh/), 'the "Weigh" button');
    },
  };
}

export const players: Record<string, TapPlayer> = { 'twelve-coins': coins() };
