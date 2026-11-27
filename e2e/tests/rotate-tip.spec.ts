import { LEVELS } from '../levels';
import { expect, passRulesCard, test } from './fixtures';

/**
 * The "Turn your phone sideways" tip, which an upright window up to 600 points wide shows once per visit.
 * On the website it is for a phone held upright, and an iPad window that narrow gets it too. The app locks
 * an iPhone sideways, so an upright window in the app is always an iPad's (Split View, Slide Over, a resized
 * window), where the words do not fit: the app never shows it.
 *
 * Played in the website's and the app's iPhone projects at their usual size only; each test sets its own
 * window. The rules card is passed with Playwright's touch.
 */
const level = LEVELS[0];
const SIZES = [
  { name: 'iPhone held upright', width: 390, height: 844 },
  { name: 'iPad, half of a Split View', width: 590, height: 820 },
  { name: 'iPad, Slide Over', width: 320, height: 820 },
];

for (const size of SIZES) {
  test(`the turn-your-phone tip, ${size.name} (${size.width} by ${size.height})`, async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(project !== 'iphone-landscape' && project !== 'app-iphone-landscape', 'one project each for the website and the app');
    const app = project.startsWith('app-');
    // The app never shows an iPhone upright: only its iPad windows are played there.
    test.skip(app && size.width === 390, 'the app holds an iPhone sideways');
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    // The app build has no debug hook: the rules card shows that the level is open.
    await passRulesCard(page, level.title);
    const tip = page.getByText('Turn your phone sideways for a bigger view');
    if (app) {
      // The tip comes as the card goes, and stays a few seconds: look for it every quarter second for 3 seconds.
      for (let i = 0; i < 12; i++) {
        // Counted once each time: an expect that waits would only wait for the tip to go.
        expect(await tip.count(), 'the app shows no turn-your-phone tip in an upright iPad window').toBe(0);
        await page.waitForTimeout(250);
      }
    } else {
      await expect(tip, 'the website shows the tip in an upright window up to 600 wide').toBeVisible({ timeout: 5000 });
    }
  });
}
