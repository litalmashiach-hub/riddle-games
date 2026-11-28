import type { Move } from '../../../levels/12-twelve-coins/src/rules';
import { LEVELS } from '../../levels';
import { expect, expectClean, passRulesCard, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, waitCameraStill, waitIdle, type Vec3 } from '../harness';
import { pansLine } from '../players/12-twelve-coins';

/**
 * Level 12 loads a chosen weighing the way its card says: "Tap a coin to put it on the left pan. Tap again,
 * on the coin or on its empty place, for the right pan, and once more to take it back."
 *
 * A newcomer's play at 852 by 393 tapped coins 1, 2 and 3 once and coins 4, 5 and 6 twice, each time
 * where the coin lay, and got all six on the left pan: the first tap had sent the coin away, so the second
 * landed on bare cloth. Nor could the pans' coins be told apart. Here the same taps must give 1, 2, 3
 * against 4, 5, 6, with the coins named on each pan, and a third tap must take a coin back.
 *
 * Every tap is a touch-screen tap at the place on the screen where the coin lay on the table.
 */
const level = LEVELS.find((l) => l.id === 'twelve-coins')!;
/** Where coin i lies on the table (traySlot in levels/12-twelve-coins/src/Scene.tsx). */
const place = (i: number): Vec3 => [((i % 6) - 2.5) * 0.8, 0.82 + 0.13, 1.5 - 0.35 + Math.floor(i / 6) * 0.72];

test('level 12: tap once for the left pan, tap again in the same place for the right pan, and the pans line names the coins', async ({ page, faults }) => {
  const size = page.viewportSize()!;
  const taps = new Taps(page, level, size);
  await page.addInitScript(READ_SCENE);
  await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
  await page.goto(`?debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await passRulesCard(page, level.title);
  await page.waitForFunction(() => window.__taps.ready());
  await waitCameraStill(page);
  await waitIdle(page);

  const pans = page.locator('.tc-pans');
  const status = page.locator('.tc-controls');

  // Coins 1, 2 and 3: one tap each, to the left pan.
  for (const c of [0, 1, 2]) {
    await taps.tapWorld(place(c), `coin ${c + 1} on the table`);
    await expect(pans).toHaveText(pansLine([0, 1, 2].slice(0, c + 1), []));
  }
  // Coins 4, 5 and 6: two taps each in the same place. The first a quick second tap, as a double tap is;
  // the others once the coin has flown, so the second tap lands on the coin's empty place.
  for (const [c, gap] of [
    [3, 250],
    [4, 900],
    [5, 900],
  ] as const) {
    await taps.tapWorld(place(c), `coin ${c + 1} on the table`);
    await page.waitForTimeout(gap);
    await taps.tapWorld(place(c), `coin ${c + 1}'s place again`);
    await expect(pans).toHaveText(pansLine([0, 1, 2], [3, 4, 5].slice(0, c - 2)));
  }
  await expect(status).toContainText('3 against 3: ready to weigh.');

  // A third tap in the same place takes coin 6 back to the table; one more puts it on the left pan.
  await page.waitForTimeout(600);
  await taps.tapWorld(place(5), "coin 6's place, a third time");
  await expect(pans).toHaveText(pansLine([0, 1, 2], [3, 4]));
  await expect(status).toContainText('3 against 2: the pans need the same number.');
  await page.waitForTimeout(900);
  await taps.tapWorld(place(5), 'coin 6, back on the table');
  await expect(pans).toHaveText(pansLine([0, 1, 2, 5], [3, 4]));
  await page.waitForTimeout(900);
  await taps.tapWorld(place(5), "coin 6's place again");
  await expect(pans).toHaveText(pansLine([0, 1, 2], [3, 4, 5]));

  // Weigh: the move made is the weighing the taps chose.
  await taps.tapButton(page.getByRole('button', { name: /Weigh/ }), 'the "Weigh" button');
  await page.waitForFunction(() => window.__riddle!.getState().moves.length >= 1, undefined, { timeout: 15_000 });
  const made = (await page.evaluate(() => window.__riddle!.getState().moves)) as Move[];
  expect(made).toHaveLength(1);
  expect(made[0]).toMatchObject({ kind: 'weigh' });
  const w = made[0] as Extract<Move, { kind: 'weigh' }>;
  expect([...w.left].sort()).toEqual([0, 1, 2]);
  expect([...w.right].sort()).toEqual([3, 4, 5]);
  await waitIdle(page);
  expectClean(faults);
});
