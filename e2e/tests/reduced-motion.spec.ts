import type { Page } from '@playwright/test';
import { lossCases } from '../loss-paths';
import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * Reduce Motion (Settings > Accessibility > Motion on an iPhone or iPad; the browser reports it as
 * `prefers-reduced-motion: reduce`). With it on, the game must hold still unless the player moves
 * something: no camera fly-in at the start, no ambient loops (water, bobbing, swaying, twinkling,
 * pulsing hint marks), no camera zoom on a loss. With it off, everything is as before.
 *
 * "Still" is measured on the drawn scene: two pictures of the canvas a second apart, once the scene
 * has settled, and the share of pixels that differ between them. Every level is won by taps with the
 * setting on in the real-tap run's `iphone-landscape-reduce-motion` project (e2e/taps/playwright.config.ts).
 */

/** Share of the canvas's pixels that may differ between two pictures a second apart, with Reduce Motion on. */
const STILL = 0.002;

const CASES = await lossCases();

/** Two pictures of the canvas `gapMs` apart; the share of pixels where a colour channel differs by more than 8. */
async function changedShare(page: Page, gapMs = 1000): Promise<number> {
  const canvas = page.locator('canvas');
  const a = (await canvas.screenshot()).toString('base64');
  await page.waitForTimeout(gapMs);
  const b = (await canvas.screenshot()).toString('base64');
  return page.evaluate(async ([pa, pb]) => {
    const load = async (s: string) => {
      const blob = await (await fetch(`data:image/png;base64,${s}`)).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      return g.getImageData(0, 0, bmp.width, bmp.height).data;
    };
    const [x, y] = await Promise.all([load(pa), load(pb)]);
    let changed = 0;
    for (let i = 0; i < x.length; i += 4) {
      if (Math.abs(x[i] - y[i]) > 8 || Math.abs(x[i + 1] - y[i + 1]) > 8 || Math.abs(x[i + 2] - y[i + 2]) > 8) changed++;
    }
    return changed / (x.length / 4);
  }, [a, b] as const);
}

/**
 * Every camera position drawn for `ms`, from the moment the scene's camera exists: the rules card is
 * still up then, and the fly-in (when there is one) plays behind it. Returns how many differ.
 */
async function cameraPoses(page: Page, ms: number): Promise<number> {
  await page.waitForFunction(() => !!window.__camera);
  return page.evaluate(
    (ms) =>
      new Promise<number>((done) => {
        const seen = new Set<string>();
        const end = performance.now() + ms;
        const look = () => {
          const p = window.__camera!.camera.position;
          seen.add([p.x, p.y, p.z].map((n: number) => n.toFixed(3)).join(','));
          if (performance.now() < end) requestAnimationFrame(look);
          else done(seen.size);
        };
        requestAnimationFrame(look);
      }),
    ms,
  );
}

const cameraAt = (page: Page) =>
  page.evaluate(() => {
    const p = window.__camera!.camera.position;
    return [p.x, p.y, p.z].map((n: number) => Math.round(n * 1000) / 1000);
  });

/** Opens a level past its rules card and waits until the loading curtain has gone. `whileCard` runs as the rules card shows. */
async function openLevel(page: Page, level: (typeof LEVELS)[number], whileCard?: () => Promise<void>) {
  await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
  await page.goto(`?debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await whileCard?.();
  await passRulesCard(page, level.title);
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 60_000 });
}

test.describe('with Reduce Motion on', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const level of LEVELS) {
    const nn = String(level.number).padStart(2, '0');
    test(`level ${nn} ${level.id}: no fly-in, and the scene holds still`, async ({ page }) => {
      let poses = 0;
      await openLevel(page, level, async () => {
        poses = await cameraPoses(page, 2600);
      });
      // No fly-in: over the 2.6 s the fly-in would take, the camera has one position.
      expect(poses, 'camera positions while the level opens').toBe(1);
      const first = await cameraAt(page);
      // Whatever eases into place at the start has done so; after that nothing moves.
      await page.waitForTimeout(1500);
      const share = await changedShare(page);
      expect(share, `share of the scene that changed in a second (at most ${STILL})`).toBeLessThanOrEqual(STILL);
      expect(await cameraAt(page), 'the camera stays where it started').toEqual(first);
    });
  }

  test('level 02 wolf-goat-cabbage: the hint mark is shown and holds still', async ({ page }) => {
    const level = LEVELS.find((l) => l.id === 'wolf-goat-cabbage')!;
    await openLevel(page, level);
    await page.waitForTimeout(1500);
    const before = (await page.locator('canvas').screenshot()).length;
    await page.getByRole('button', { name: 'Hint' }).first().tap();
    await expect(page.getByTestId('hint-spoken')).not.toBeEmpty();
    await page.waitForTimeout(600);
    // The mark is drawn (the picture changed from before the hint) ...
    expect((await page.locator('canvas').screenshot()).length).not.toBe(before);
    // ... and it does not pulse.
    expect(await changedShare(page, 800)).toBeLessThanOrEqual(STILL);
  });

  for (const { level, path, kind } of CASES) {
    const nn = String(level.number).padStart(2, '0');
    test(`level ${nn} ${level.id}${kind ? ` (${kind})` : ''}: a loss does not zoom or shake the camera`, async ({ page }) => {
      await openLevel(page, level);
      const before = path.slice(0, -1);
      // Set the position just before the loss at once, as an undo would show it.
      await page.evaluate((moves) => {
        const store = window.__riddle as any;
        const s = store.getState();
        const rules = s.level.rules;
        const history = [rules.initialState];
        for (const m of moves) history.push(rules.apply(history[history.length - 1], m));
        store.setState({ history, moves, future: [], status: rules.status(history[history.length - 1]), hint: null });
      }, before);
      await page.waitForTimeout(800);
      const rest = await cameraAt(page);
      await playMove(page, path[path.length - 1], before.length + 1);
      // Through the loss scene to its card, the camera stays put.
      const seen: number[][] = [];
      for (let i = 0; i < 8; i++) {
        seen.push(await cameraAt(page));
        await page.waitForTimeout(250);
      }
      for (const at of seen) expect(at, 'the camera during the loss scene').toEqual(rest);
      await expect(page.getByRole('heading', { name: 'Oh no!' })).toBeVisible({ timeout: 30_000 });
    });
  }
});

test.describe('with Reduce Motion off', () => {
  test.use({ reducedMotion: 'no-preference' });

  // The same measures see motion when the setting is off, so a pass above is not a blind spot.
  // (The fly-in is not checked here: drawn in software, the scene's first frames can come after the 2.2 s
  // the fly-in lasts, and the camera then starts at its end, setting or no setting.)
  test('level 01 wolf-two-sheep: the scene moves as before', async ({ page }) => {
    const level = LEVELS.find((l) => l.id === 'wolf-two-sheep')!;
    await openLevel(page, level);
    await page.waitForTimeout(1500);
    expect(await changedShare(page)).toBeGreaterThan(STILL * 5);
  });
});
