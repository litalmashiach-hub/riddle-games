import { NO_WIN_LEFT } from '../../apps/web/src/hint';
import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, savedStars, seedProgress, test, waitForSession } from './fixtures';
import type { Page } from '@playwright/test';

/** Hint, where it has no move to give, and what a hint costs. Tapped as a player taps it. */

/** The largest iPhone held sideways. The two projects' own sizes are the current and the small one. */
const LARGEST = { width: 956, height: 440 };

const session = (page: Page) =>
  page.evaluate(() => {
    const s = window.__riddle!.getState();
    return { kind: s.status.kind as string, moves: s.moves.length as number, hint: s.hint, hintsUsed: s.hintsUsed as number };
  });

/** The Hint button a finger can reach: the shell has two, one for each layout, and shows one. */
const hintButton = (page: Page) => page.getByRole('button', { name: 'Hint' }).filter({ visible: true });

/** The hint's line is whole on the screen and shares no pixel with a button. */
async function expectClearOfButtons(page: Page, line: string) {
  const text = page.getByText(line);
  await expect(text).toBeVisible();
  // The line slides in: measure it once it stands still for a few frames.
  const box = await text.evaluate(
    (el) =>
      new Promise<{ x: number; y: number; width: number; height: number }>((done) => {
        let last = el.getBoundingClientRect();
        let same = 0;
        const frame = () => {
          const now = el.getBoundingClientRect();
          same = now.x === last.x && now.y === last.y ? same + 1 : 0;
          last = now;
          if (same >= 3) done({ x: now.x, y: now.y, width: now.width, height: now.height });
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
  const view = page.viewportSize()!;
  const size = `${view.width} by ${view.height}`;
  expect(box.x, `the line starts on the screen at ${size}`).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `the line ends on the screen at ${size}`).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  const buttons = page.getByRole('button').filter({ visible: true });
  expect(await buttons.count(), 'the buttons are up').toBeGreaterThanOrEqual(4);
  for (const button of await buttons.all()) {
    const b = (await button.boundingBox())!;
    const apart = b.x >= box.x + box.width || b.x + b.width <= box.x || b.y >= box.y + box.height || b.y + b.height <= box.y;
    expect(apart, `the line is clear of the "${await button.getAttribute('aria-label') ?? await button.innerText()}" button at ${size}`).toBe(true);
  }
}

test('level 20: Hint says so where no win is left, and that costs no star', async ({ page }) => {
  const level = LEVELS.find((l) => l.id === 'berry-bridges')!;
  await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
  await page.goto(`?debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await passRulesCard(page, level.title);

  // Starting on the shell islet, which has two bridges, can never collect every berry.
  await playMove(page, { to: 7 }, 1);
  expect((await session(page)).kind, 'the level is still being played').toBe('playing');

  await hintButton(page).tap();
  await expectClearOfButtons(page, NO_WIN_LEFT);
  expect(NO_WIN_LEFT).toMatch(/undo/i);
  expect(NO_WIN_LEFT).toMatch(/restart/i);
  expect(await session(page), 'no hint was given, and none is counted').toMatchObject({ hint: null, hintsUsed: 0 });

  // The line leaves by itself, and comes back at the next tap. On the largest iPhone it is clear too.
  await expect(page.getByText(NO_WIN_LEFT)).toBeHidden();
  await page.setViewportSize(LARGEST);
  await hintButton(page).tap();
  await expectClearOfButtons(page, NO_WIN_LEFT);
  expect((await session(page)).hintsUsed).toBe(0);
  await expect(page.getByText(NO_WIN_LEFT)).toBeHidden();

  // One step back there is a win again: Hint names a move, as before.
  await page.getByRole('button', { name: 'Undo' }).tap();
  await hintButton(page).tap();
  await expect(page.getByText(/Start on the (lantern|reed) islet/)).toBeVisible();
  await expect(page.getByText(NO_WIN_LEFT)).toHaveCount(0);
  expect((await session(page)).hintsUsed).toBe(1);
});

test('level 1: a restart forgets the hints, so the fresh run earns three stars', async ({ page }) => {
  const one = LEVELS[0];
  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);

  await playMove(page, one.moves[0], 1);
  await hintButton(page).tap();
  expect((await session(page)).hintsUsed).toBe(1);
  await page.getByRole('button', { name: 'Restart' }).tap();
  expect(await session(page)).toMatchObject({ moves: 0, hintsUsed: 0 });

  for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
  await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  await expect(page.getByText(/hint/)).toHaveCount(0);
  expect((await savedStars(page))[one.id]).toBe(3);
});
