import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, savedStars, SETTINGS_KEY, test, waitForSession } from './fixtures';

test('progress and settings survive a reload', async ({ page }) => {
  const [one, two, three] = LEVELS;

  await page.goto(`?debug#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);
  for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
  await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });

  // Back to the map, and turn the sound off there.
  await page.getByRole('button', { name: 'All levels' }).tap();
  await page.getByRole('button', { name: 'Mute' }).tap();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();

  // A fresh start of the app, with none of the test's address options.
  await page.goto('about:blank');
  await page.goto('');
  await expect(page.getByText(`3 / ${LEVELS.length * 3}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
  expect(await savedStars(page)).toEqual({ [one.id]: 3 });
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).sound, SETTINGS_KEY)).toBe(false);

  // Level 3 is still locked; level 2 is open.
  await page.getByRole('button', { name: new RegExp(`^Level ${three.number}:`) }).tap();
  await expect(page).not.toHaveURL(/#\/level\//);
  await page.getByRole('button', { name: new RegExp(`^Level ${two.number}:`) }).tap();
  await expect(page.getByRole('heading', { name: two.title, exact: true })).toBeVisible();
});

test('the map lists every level that the tests play', async ({ page }) => {
  await page.goto('');
  for (const level of LEVELS) {
    await expect(page.getByRole('button', { name: `Level ${level.number}: ${level.title}`, exact: true })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: /^Level \d+:/ })).toHaveCount(LEVELS.length);
});
