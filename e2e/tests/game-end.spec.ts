import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * The end of the game: the last level's win, with every other level solved, says the game is finished, and the
 * sideways map then rings no level as next. Any other state of the map is as before.
 */

const last = LEVELS[LEVELS.length - 1];
const allBut = Object.fromEntries(LEVELS.slice(0, -1).map((l) => [l.id, 3]));
const FINALE = `That was the last riddle, and you have solved all ${LEVELS.length}. Well done, riddle master!`;
/** The gold "up next" ring of the sideways map. */
const ringed = (page: import('@playwright/test').Page) => page.locator('button.ring-amber-200');

test('the last win says every riddle is solved, and the map then rings no level', async ({ page }, testInfo) => {
  await seedProgress(page, allBut);

  // At 29 of 30 the map rings the last level, as before.
  await page.goto('?quality=low');
  await expect(ringed(page)).toHaveCount(1);
  await expect(ringed(page)).toHaveAccessibleName(new RegExp(`^Level ${last.number}: `));
  await page.screenshot({ path: testInfo.outputPath('1-map-before-the-last-win.png') });

  await page.goto(`?debug&quality=low#/level/${last.id}`);
  await waitForSession(page, last.id);
  await passRulesCard(page, last.title);
  for (const [i, move] of last.moves.entries()) await playMove(page, move, i + 1);

  const card = page.getByRole('dialog', { name: 'Solved!' });
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText(FINALE)).toBeVisible();
  await expect(card.getByText(FINALE)).toBeInViewport({ ratio: 1 });
  // VoiceOver reads the line as the card opens: it is the card's description, and the trophy is not read.
  await expect(card).toHaveAccessibleDescription(FINALE);
  await expect(card.getByRole('button', { name: 'Next level' })).toHaveCount(0);
  for (const name of ['Play again', 'All levels']) await expect(card.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath('2-last-win-card.png') });

  await card.getByRole('button', { name: 'All levels' }).tap();
  await expect(page.getByText(`${LEVELS.length * 3} / ${LEVELS.length * 3}`)).toBeVisible();
  await expect(ringed(page)).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('3-map-at-30-of-30.png') });
  // And after a fresh start.
  await page.goto('?quality=low');
  await expect(page.getByText(`${LEVELS.length * 3} / ${LEVELS.length * 3}`)).toBeVisible();
  await expect(ringed(page)).toHaveCount(0);
});

test('any other win card is as before', async ({ page }) => {
  // A win of any other level, here level 1 with all but one level solved, has no end line.
  await seedProgress(page, { ...allBut, [LEVELS[3].id]: 0 });
  const one = LEVELS[0];
  await page.goto(`?debug&all&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);
  for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
  const card = page.getByRole('dialog', { name: 'Solved!' });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/last riddle/)).toHaveCount(0);
  await expect(card).toHaveAccessibleDescription('');
  await expect(card.getByRole('button', { name: 'Next level' })).toBeVisible();
});
