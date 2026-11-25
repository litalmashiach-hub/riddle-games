import type { Locator, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastLines, measureContrast, type Reading } from '../contrast';
import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * Text contrast: every text, number and line icon of the level map, the About screen and the cards over
 * a level reads against what is drawn behind it at WCAG's bars, 4.5 to 1 for text and 3 to 1 for large
 * text and icons. Measured from pictures of the real page, see e2e/contrast.ts and docs/text-contrast.md.
 *
 * The sizes are set here, not by the project, so the file runs once against each build: in
 * `iphone-landscape` (the website build) and `app-iphone-landscape` (the app build, for the About pages
 * that only the app has).
 */

const SIZES = [
  { name: 'iPhone sideways', width: 852, height: 393 },
  { name: 'iPhone sideways, small', width: 667, height: 375 },
  { name: 'iPhone sideways, large', width: 956, height: 440 },
  { name: 'iPad sideways', width: 1024, height: 768 },
];

// Letters are a pixel or two thick at 1x, too thin to find their inside. iPhones and iPads draw at 2x or 3x.
test.use({ deviceScaleFactor: 2 });

const project = () => test.info().project.name;
const appBuild = () => project() === 'app-iphone-landscape';
test.beforeEach(() => {
  test.skip(project() !== 'iphone-landscape' && !appBuild(), 'the sizes are set in this file: one project a build is enough');
});

/** With CONTRAST_OUT set, every reading is also written there, pass or fail. */
const OUT = process.env.CONTRAST_OUT;
function record(where: string, readings: Reading[]) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  const name = `${appBuild() ? 'app' : 'website'} ${where}`.replace(/[^\w]+/g, '-').toLowerCase();
  writeFileSync(join(OUT, `${name}.txt`), contrastLines(where, readings).join('\n') + '\n');
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(readings));
}

/** Nothing on the screen reads under its bar. A disabled button is left out, as WCAG leaves it out. */
function expectReadable(where: string, readings: Reading[], atLeast: number) {
  record(where, readings);
  // Softly, so that one low text does not hide the screens after it.
  expect.soft(readings.length, `${where}: texts found`).toBeGreaterThanOrEqual(atLeast);
  const low = readings.filter((r) => !r.disabled && r.p5 < r.bar);
  expect.soft(contrastLines(where, low), `${where}: text under its contrast bar`).toEqual([]);
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

const mapList = (page: Page, size: { height: number }): Locator =>
  // Sideways the cards are one row that swipes; upright and on iPad the whole map scrolls.
  size.height <= 500 ? page.locator('.overflow-x-auto') : page.locator('.overflow-y-auto');

for (const size of SIZES) {
  const at = `${size.width}x${size.height}`;

  test(`level map at ${at}: a new player's map, with every level after the first locked`, async ({ page }) => {
    test.skip(appBuild(), 'the map is the same in both builds');
    await page.setViewportSize(size);
    await page.goto('');
    await settle(page);
    // The backing of the line beside the title must not cost it its last letters.
    const line = page.getByText('legendary puzzles');
    expect(await line.evaluate((e) => e.scrollWidth <= e.clientWidth), 'the line beside the title is whole').toBe(true);
    const readings = await measureContrast(page, mapList(page, size));
    // Each card has a title and a line under it; sideways it has its number too.
    expect(readings.filter((r) => r.state === 'locked').length).toBeGreaterThanOrEqual((LEVELS.length - 1) * 2);
    expectReadable(`map new ${at}`, readings, LEVELS.length * 2);
  });

  test(`level map at ${at}: every level open, some with stars`, async ({ page }) => {
    test.skip(appBuild(), 'the map is the same in both builds');
    await page.setViewportSize(size);
    await seedProgress(page, Object.fromEntries(LEVELS.map((l, i) => [l.id, i % 4]).filter(([, n]) => n)));
    await page.goto('?all');
    await settle(page);
    const readings = await measureContrast(page, mapList(page, size));
    expect(readings.filter((r) => r.state === 'open').length).toBeGreaterThanOrEqual(LEVELS.length * 2);
    expectReadable(`map open ${at}`, readings, LEVELS.length * 2);
  });

  test(`About screen at ${at}: every page and the reset question`, async ({ page }) => {
    await page.setViewportSize(size);
    await seedProgress(page, { [LEVELS[0].id]: 3 });
    await page.goto('');
    await page.getByRole('button', { name: 'About and settings' }).tap();
    await settle(page);
    const card = page.getByTestId('about-page');
    for (const tab of await page.getByRole('tab').all()) {
      const name = (await tab.innerText()).trim();
      await tab.tap();
      // The licence texts are folded away: open them all, so they are read too.
      const folded = card.getByRole('button', { expanded: false });
      if (name === 'Credits') while (await folded.count()) await folded.first().tap();
      expectReadable(`about ${name} ${at}`, await measureContrast(page, card), 5);
    }
    await page.getByRole('tab', { name: 'Settings' }).tap();
    await page.getByRole('button', { name: 'Reset progress' }).tap();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    // Only the question's own card: the page under it is dimmed on purpose while it is up.
    const words = (await page.getByRole('alertdialog').innerText()).replace(/\s+/g, ' ');
    const question = (await measureContrast(page)).filter((r) => words.includes(r.text.slice(0, 20)));
    expectReadable(`about reset question ${at}`, question, 4);
  });

  test(`cards over a level at ${at}: rules, hint, "Oh no!" and "Solved!"`, async ({ page }) => {
    test.skip(appBuild(), 'the play screen is the same in both builds');
    // The cards are solid and the same at every size, and a level is slow to draw without a graphics card:
    // one size guards them. CONTRAST_ALL_SIZES=1 measures them at all four.
    test.skip(size !== SIZES[0] && !process.env.CONTRAST_ALL_SIZES, 'the cards are measured at one size');
    test.setTimeout(900_000);
    const level = LEVELS[0];
    await page.setViewportSize(size);
    // The hint leaves by itself after five seconds, sooner than five pictures are taken here: its timer is never started.
    await page.addInitScript(() => {
      const start = window.setTimeout.bind(window);
      (window as any).setTimeout = (...args: Parameters<typeof setTimeout>) => (args[1] === 5000 ? 0 : start(...args));
    });
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await expect(page.getByRole('button', { name: "Let's go!" })).toBeVisible();
    await settle(page);
    /** Only what is on the card: the scene behind it is the level's own. */
    const onCard = async (dialog: Locator) => {
      await stillScene(page);
      const words = (await dialog.innerText()).replace(/\s+/g, ' ');
      const readings = (await measureContrast(page)).filter((r) => r.kind === 'text' && words.includes(r.text.slice(0, 20)));
      await movingScene(page);
      return readings;
    };
    expectReadable(`rules card ${at}`, await onCard(page.getByRole('dialog')), 5);
    await passRulesCard(page, level.title);
    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).tap();
    const hint = page.getByTestId('hint-spoken');
    await expect(hint).toContainText('💡');
    await page.waitForTimeout(600);
    expectReadable(`hint line ${at}`, await onCard(hint), 1);

    // A losing first move, from the level's own rules.
    const losing = await page.evaluate(() => {
      const { level, history } = window.__riddle!.getState() as any;
      const state = history[history.length - 1];
      return level.rules.legalMoves(state).find((m: unknown) => level.rules.status(level.rules.apply(state, m)).kind === 'lost');
    });
    expect(losing, 'level 1 can be lost by its first move').toBeTruthy();
    await page.evaluate((m) => (window.__riddle!.getState() as any).play(m), losing);
    const lost = page.getByRole('dialog', { name: 'Oh no!' });
    await expect(lost).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(800);
    expectReadable(`lose card ${at}`, await onCard(lost), 3);

    await page.getByRole('button', { name: 'Restart' }).filter({ visible: true }).first().tap();
    await page.waitForTimeout(1500);
    for (const [i, move] of level.moves.entries()) await playMove(page, move, i + 1);
    const won = page.getByRole('dialog', { name: 'Solved!' });
    await expect(won).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    expectReadable(`win card ${at}`, await onCard(won), 4);
  });
}

/** Puts a picture of the 3D scene in its place, so that nothing behind a card moves between two pictures. */
async function stillScene(page: Page) {
  const canvas = page.locator('canvas').first();
  const picture = (await canvas.screenshot()).toString('base64');
  await page.evaluate((url) => {
    const c = document.querySelector('canvas')!;
    const img = new Image();
    img.src = url;
    img.dataset.stillScene = '';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    c.parentElement!.insertBefore(img, c);
    c.style.visibility = 'hidden';
  }, `data:image/png;base64,${picture}`);
  await page.waitForTimeout(200);
}
async function movingScene(page: Page) {
  await page.evaluate(() => {
    document.querySelector('[data-still-scene]')?.remove();
    document.querySelector('canvas')!.style.visibility = '';
  });
}
