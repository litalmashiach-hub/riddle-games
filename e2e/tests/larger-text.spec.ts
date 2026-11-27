import type { Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { lossCases } from '../loss-paths';
import { fontSizeOf, setSystemBodySize, SYSTEM_BODY, textFaults } from '../textFit';
import { expect, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * Larger Text (docs/larger-text.md): in the app, the words follow the iPhone's or iPad's text size setting,
 * up to twice their size, and every screen still shows every word whole, with every button in reach.
 *
 * The setting is played by giving the page's text size probe the size WebKit gives `-apple-system-body` at it
 * (e2e/textFit.ts). The map and the About screen are checked in the app build (`app-*` projects); the cards of
 * the play screen in the website build with `?debug`, the one way to reach a win and a loss by script, where
 * the website follows the setting as the app does.
 */

const appBuild = () => test.info().project.name.startsWith('app-');

/** The first accessibility size, and the largest. */
const GROWN = [
  { name: 'the first accessibility size', body: SYSTEM_BODY.ax1, grow: '1.647' },
  { name: 'the largest size', body: SYSTEM_BODY.ax5, grow: '2' },
];

async function expectFits(page: Page, where: string) {
  // Cards spring in; let them land.
  await page.waitForTimeout(600);
  expect(await textFaults(page), where).toEqual([]);
}

/**
 * The scene buttons (a level's own, laid over its canvas) that the hint toast lies over or touches, with the
 * toast's lift (hintPlace.ts). Read once the toast has sprung in.
 */
async function hintOverSceneButtons(page: Page) {
  await expect(page.getByTestId('hint-toast')).toBeVisible();
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const toast = document.querySelector('[data-testid="hint-toast"]')!.getBoundingClientRect();
    const scene = document.querySelector('canvas')!.parentElement!.parentElement!;
    const names = [...scene.querySelectorAll('button')].filter((b) => {
      const r = b.getBoundingClientRect();
      if (r.width < 2 || getComputedStyle(b).visibility === 'hidden') return false;
      return Math.min(r.right, toast.right) - Math.max(r.left, toast.left) > 0 && Math.min(r.bottom, toast.bottom) - Math.max(r.top, toast.top) > 0;
    }).map((b) => b.getAttribute('aria-label') ?? b.textContent);
    const lift = Number(document.querySelector('[data-hint-lift]')!.getAttribute('data-hint-lift'));
    return { names, lift, top: toast.top, bottom: toast.bottom };
  });
}

/** An iPad held sideways, as the app allows: the smallest window (1024 by 768) and the 13-inch. */
const IPADS = [
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
];

test.describe('at the standard size', () => {
  test('the app keeps every size as it was', async ({ page }) => {
    test.skip(!appBuild(), 'app build');
    await setSystemBodySize(page, SYSTEM_BODY.standard);
    await page.goto('./#/about');
    await expect(page.locator('html')).toHaveAttribute('data-text-grow', '1');
    expect(await fontSizeOf(page, 'body')).toBe(16);
    // A tab's label: 1rem from 640 points of width, as on every sideways iPhone.
    expect(await fontSizeOf(page, '[role="tab"]')).toBe(16);
  });

  test('the website does not follow the setting at all', async ({ page }) => {
    test.skip(appBuild(), 'website build');
    await setSystemBodySize(page, SYSTEM_BODY.ax5);
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'About and settings' })).toBeVisible();
    await expect(page.locator('[data-text-size-probe]')).toHaveCount(0);
    expect(await page.locator('html').getAttribute('data-text-grow')).toBeNull();
    expect(await fontSizeOf(page, 'body')).toBe(16);
  });

  test('the hint toast keeps its place on an iPad, where it covers no scene button', async ({ page }) => {
    test.skip(appBuild(), 'website build with ?debug');
    test.skip(test.info().project.name !== 'iphone-landscape', 'sets its own iPad size; once is enough');
    for (const size of IPADS) {
      await page.setViewportSize(size);
      const one = LEVELS[0];
      await page.goto(`?all&debug&quality=low#/level/${one.id}`);
      await waitForSession(page, one.id);
      await page.getByRole('button', { name: "Let's go!" }).tap();
      await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
      await expect(page.getByRole('button', { name: /^Row across/ })).toBeVisible();
      await page.keyboard.press('h');
      const seen = await hintOverSceneButtons(page);
      expect(seen.names, `scene buttons under the hint at ${size.width} by ${size.height}`).toEqual([]);
      expect(seen.lift, 'not lifted: the standard size is as it was').toBe(0);
    }
  });
});

for (const size of GROWN) {
  test.describe(`at ${size.name}`, () => {
    test.beforeEach(async ({ page }) => setSystemBodySize(page, size.body));

    test('the map and every About page fit', async ({ page }) => {
      test.skip(!appBuild(), 'app build');
      await seedProgress(page, Object.fromEntries(LEVELS.slice(0, 6).map((l) => [l.id, 3])));
      await page.goto('./');
      await expect(page.locator('html')).toHaveAttribute('data-text-grow', size.grow);
      // The words have grown: the body's 16px by the growth.
      expect(await fontSizeOf(page, 'body')).toBeCloseTo(16 * Number(size.grow), 1);
      await expect(page.getByRole('button', { name: 'About and settings' })).toBeVisible();
      await expectFits(page, 'level map, at its start');
      await page.locator('.no-scrollbar').evaluate((row) => row.scrollBy({ left: 1e5 }));
      await expectFits(page, 'level map, at its end');

      await page.getByRole('button', { name: 'About and settings' }).tap();
      await expect(page.getByTestId('about-page')).toBeVisible();
      await expectFits(page, 'About: Settings');
      await page.getByRole('button', { name: 'Reset progress' }).tap();
      await expectFits(page, 'About: the reset question');
      await page.getByRole('button', { name: 'Keep my stars' }).tap();
      for (const tab of ['Privacy', 'Contact', 'Credits']) {
        await page.getByRole('tab', { name: tab }).tap();
        await expectFits(page, `About: ${tab}`);
      }
    });

    test('on an iPad the hint toast covers no scene button, and stays under the top bar', async ({ page }) => {
      test.skip(appBuild(), 'website build with ?debug');
      test.skip(test.info().project.name !== 'iphone-landscape', 'sets its own iPad size; once is enough');
      // Levels 1 and 2 pin their Row button just above the bottom bar, where the grown toast reached.
      for (const size of IPADS) {
        await page.setViewportSize(size);
        for (const level of LEVELS.slice(0, 2)) {
          await page.goto(`?all&debug&quality=low#/level/${level.id}`);
          await waitForSession(page, level.id);
          await page.getByRole('button', { name: "Let's go!" }).tap();
          await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
          const row = page.getByRole('button', { name: /^Row across/ });
          await expect(row).toBeVisible();
          await page.keyboard.press('h');
          const where = `level ${level.number} at ${size.width} by ${size.height}`;
          const seen = await hintOverSceneButtons(page);
          expect(seen.names, `scene buttons under the hint, ${where}`).toEqual([]);
          const rowBox = (await row.boundingBox())!;
          expect(seen.bottom, `the hint sits above "Row across", ${where}`).toBeLessThanOrEqual(rowBox.y);
          const bar = (await page.getByRole('button', { name: 'Rules' }).boundingBox())!;
          expect(seen.top, `the hint stays under the top bar, ${where}`).toBeGreaterThan(bar.y + bar.height);
          // The button is still the thing a touch at its middle meets.
          const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') ?? 'not a button', [rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2]);
          expect(top, where).toMatch(/^Row across/);
        }
      }
    });

    test('the rules, win and loss cards fit, and their buttons stay in view', async ({ page }) => {
      test.skip(appBuild(), 'website build with ?debug');
      // The longest rules (level 7), and a level with two columns of words (level 12).
      for (const id of ['jealous-couples', 'twelve-coins']) {
        const level = LEVELS.find((l) => l.dir.endsWith(id))!;
        await page.goto(`?all&debug&quality=low#/level/${level.id}`);
        await expect(page.getByRole('heading', { name: level.title, exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-text-grow', size.grow);
        await expectFits(page, `rules card of level ${level.number}`);
        await expect(page.getByRole('button', { name: "Let's go!" })).toBeInViewport({ ratio: 1 });
      }

      // A loss, on the level with the longest reason.
      const loss = (await lossCases()).find((c) => c.level.dir.endsWith('jealous-couples'))!;
      await page.goto(`?all&debug&quality=low#/level/${loss.level.id}`);
      await waitForSession(page, loss.level.id);
      await page.getByRole('button', { name: "Let's go!" }).tap();
      await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
      await expectFits(page, `play screen of level ${loss.level.number}`);
      for (const [i, move] of loss.path.entries()) await playMove(page, move, i + 1);
      await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeVisible();
      await expectFits(page, 'loss card');
      for (const name of ['Undo', 'Restart']) await expect(page.getByRole('dialog').getByRole('button', { name })).toBeInViewport({ ratio: 1 });

      // A win, with the first-play guide and a hint on the way.
      const one = LEVELS[0];
      await page.goto(`?all&debug&quality=low#/level/${one.id}`);
      await waitForSession(page, one.id);
      await page.getByRole('button', { name: "Let's go!" }).tap();
      await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
      await expect(page.getByTestId('first-play-guide-say')).toBeVisible();
      await page.keyboard.press('h');
      await expectFits(page, 'play screen with the guide and a hint');
      for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
      await expect(page.getByRole('dialog', { name: 'Solved!' })).toBeVisible();
      await expectFits(page, 'win card');
      for (const name of ['Next level', 'Play again', 'All levels']) await expect(page.getByRole('dialog').getByRole('button', { name })).toBeInViewport({ ratio: 1 });
    });
  });
}
