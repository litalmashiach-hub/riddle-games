import type { Move, State } from '../../../levels/12-twelve-coins/src/rules';
import type { Point, TapPlayer, Taps, Target, Vec3 } from '../harness';

/** Where coin i lies on the table. From traySlot() in levels/12-twelve-coins/src/Scene.tsx (TABLE_Y 0.82, TABLE_Z 1.5 in Vault.tsx). */
const traySlot = (i: number): Vec3 => [((i % 6) - 2.5) * 0.8, 0.82 + 0.13, 1.5 - 0.35 + Math.floor(i / 6) * 0.72];

/** The scene's own lines of text over its buttons: "Left: 1, 5 · Right: 3", "Tap the coin you think is fake." and so on. */
const message = (taps: Taps) => taps.page.locator('.tc-controls');

/** The scene's line that names the coins on each pan, as it reads for these coins (numbered from 0 here, from 1 on the screen). */
export const pansLine = (left: number[], right: number[]) => {
  const list = (cs: number[]) => (cs.length ? [...cs].sort((a, b) => a - b).map((c) => c + 1).join(', ') : 'none');
  return new RegExp(`^Left: ${list(left)} · Right: ${list(right)}$`);
};
const pans = (taps: Taps) => taps.page.locator('.tc-pans');

/**
 * Level 12, as its card says: a tap on a coin puts it on the left pan, and a tap again where the player
 * tapped (the coin's empty place on the table, which shows a faint ring) moves it on to the right pan. So the
 * coins for the right pan go first, each with a tap on the coin and a tap on its empty place, then the coins
 * for the left pan with one tap each, then the scene's own "Weigh" button. After each tap the line that names
 * the coins on each pan must read as planned. To name the fake: the "Name the fake" button,
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

  /** The second tap: on the coin's empty place on the table, where its ring is drawn, while the coin is on the left pan. */
  async function tapPlace(taps: Taps, coin: number, sign: RegExp) {
    const spot = await taps.targetNear([traySlot(coin)[0], 0.82, traySlot(coin)[2]], { handler: 'onClick', within: 0.3 });
    if (!spot) return taps.fault('no-response', `nothing listens on coin ${coin + 1}'s empty place on the table`);
    // Wait until the coin has landed on its pan, so it does not fly between the finger and its place.
    await atRest(taps, coin);
    await taps.tapWorld([traySlot(coin)[0], 0.82 + 0.014, traySlot(coin)[2]], `coin ${coin + 1}'s empty place on the table`);
    try {
      await pans(taps).filter({ hasText: sign }).waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      taps.fault('no-response', `the pans line did not come to read ${sign} after the tap on coin ${coin + 1}'s empty place; it reads "${await pans(taps).innerText().catch(() => '')}": ${taps.lastTouch()}`);
    }
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
      await (typeof sign === 'string' ? message(taps) : pans(taps)).filter({ hasText: sign }).waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      taps.fault('no-response', `the scene's text did not come to say ${sign} after the tap on coin ${coin + 1} ${where}; it says "${(await message(taps).innerText().catch(() => '')).split('\n')[0]}": ${taps.lastTouch()}`);
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
      const right: number[] = [];
      for (const c of move.right) {
        await tapCoin(taps, c, 'on the table', pansLine([c], right));
        right.push(c);
        await tapPlace(taps, c, pansLine([], right));
      }
      const left: number[] = [];
      for (const c of move.left) {
        left.push(c);
        await tapCoin(taps, c, 'on the table', pansLine(left, right));
      }
      await taps.tapButton(button(/Weigh/), 'the "Weigh" button');
    },
  };
}

export const players: Record<string, TapPlayer> = { 'twelve-coins': coins() };
