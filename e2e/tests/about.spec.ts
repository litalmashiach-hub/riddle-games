import type { Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ONLY_WORDS } from '../../apps/web/src/about/appInfo';
import { LEVELS } from '../levels';
import { expect, savedStars, seedProgress, SETTINGS_KEY, test } from './fixtures';

/**
 * The About and settings screen: reached from the level map, see docs/about-screen.md.
 *
 * This file runs against both builds. The `iphone-*` projects open the website build (apps/web/dist), which
 * shows Settings and Credits under the website's name. The `app-iphone-*` projects open the app build
 * (apps/web/dist-app), which shows all four pages under the working name.
 */

const ALL_PAGES = ['Settings', 'Privacy', 'Contact', 'Credits'] as const;
const WEBSITE_PAGES = ['Settings', 'Credits'] as const;

/** True in the projects that open the app build. */
const appBuild = () => test.info().project.name.startsWith('app-');
const pagesHere = () => (appBuild() ? ALL_PAGES : WEBSITE_PAGES);
const nameHere = () => (appBuild() ? APP_ONLY_WORDS.name : 'Riddle Games');

/** Every built file of a build, as text. */
function builtText(dir: string): string {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  return walk(dir)
    .filter((f) => /\.(js|css|html|json|webmanifest|txt|map)$/.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}

/** Sideways iPhones (small, standard, large), an upright phone in a browser, and an iPad both ways up. */
const SIZES = [
  { name: 'iPhone sideways, small', width: 667, height: 375 },
  { name: 'iPhone sideways', width: 852, height: 393 },
  { name: 'iPhone sideways, large', width: 956, height: 440 },
  { name: 'phone upright', width: 393, height: 852 },
  { name: 'iPad sideways', width: 1024, height: 768 },
  { name: 'iPad upright', width: 768, height: 1024 },
];

const STARS = { [LEVELS[0].id]: 3, [LEVELS[1].id]: 2 };

async function openAbout(page: Page) {
  await page.goto('');
  await page.getByRole('button', { name: 'About and settings' }).tap();
  await expect(page.getByRole('heading', { name: 'About & settings' })).toBeVisible();
}

const settings = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), SETTINGS_KEY);

test('the screen opens from the map, shows every section, and leads back', async ({ page }) => {
  await openAbout(page);
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.getByRole('tab')).toHaveText([...pagesHere()]);
  await expect(page.getByTestId('version').filter({ visible: true })).toHaveText(`${nameHere()} · Version 1.0`);

  // Settings: the two switches and the reset.
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('switch', { name: 'Sound' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'HD graphics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset progress' })).toBeVisible();

  if (appBuild()) {
    // Privacy: the whole policy, as text.
    await page.getByRole('tab', { name: 'Privacy' }).tap();
    await expect(page.getByRole('heading', { name: `${nameHere()} Privacy Policy` })).toBeVisible();
    for (const heading of ['What we collect', 'What is saved on your device', 'Sharing', 'Keeping and deleting', 'Children', 'Apple', 'Changes', 'Contact']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(1);
    }
    await expect(page.getByText('collects nothing about you')).toBeVisible();
    await expect(page.getByTestId('about-page')).not.toContainText(/\[[A-Z' ]+\]|null|undefined/);

    // Contact.
    await page.getByRole('tab', { name: 'Contact' }).tap();
    await expect(page.getByRole('heading', { name: 'Contact', exact: true })).toBeVisible();
    await expect(page.getByTestId('contact-line')).toBeVisible();
  }

  // Credits: every notice, and each licence in full once opened.
  await page.getByRole('tab', { name: 'Credits' }).tap();
  await expect(page.getByTestId('about-page')).toContainText(`${nameHere()} is built with these open-source libraries and fonts.`);
  const notices = page.getByTestId('notices').getByRole('listitem');
  expect(await notices.count()).toBeGreaterThanOrEqual(20);
  for (const name of ['three.js', 'React', 'postprocessing', 'Motion', 'Fredoka (font)', 'Nunito (font)', 'Capacitor']) {
    await expect(notices.filter({ hasText: name }).first()).toContainText(/Copyright/);
  }
  const texts: [string, string][] = [
    ['MIT License', 'The above copyright notice and this permission notice shall be included'],
    ['zlib License', 'Altered source versions must be plainly marked as such'],
    ['SIL Open Font License 1.1', 'SIL OPEN FONT LICENSE Version 1.1'],
    ['Apache License 2.0', 'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION'],
    ['CC0 1.0 Universal', 'Statement of Purpose'],
  ];
  for (const [licence, words] of texts) {
    await expect(page.getByText(words)).toHaveCount(0);
    await page.getByRole('button', { name: licence }).tap();
    await expect(page.getByText(words)).toBeVisible();
  }

  // The way back.
  await page.getByRole('button', { name: 'Back to levels' }).tap();
  await expect(page.getByRole('button', { name: /^Level 1:/ })).toBeVisible();
  await expect(page).not.toHaveURL(/about/);

  // The device's own back gesture works too, and the address opens the screen directly.
  await page.getByRole('button', { name: 'About and settings' }).tap();
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: /^Level 1:/ })).toBeVisible();
  await page.goto('#/about');
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
});

test('nothing overflows or is cut off, at every screen size', async ({ page }) => {
  await seedProgress(page, STARS);
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openAbout(page);
    for (const name of pagesHere()) {
      const at = `${name} at ${size.name}`;
      await page.getByRole('tab', { name }).tap();
      const card = page.getByTestId('about-page');
      await expect(card.getByRole('heading').first()).toBeAttached();
      // The page itself never scrolls: only the card does, and only up and down.
      const box = await page.evaluate(() => {
        const root = document.documentElement;
        const c = document.querySelector('[data-testid="about-page"]')!;
        const r = c.getBoundingClientRect();
        // Anything inside the card that sticks out sideways would be cut off by it.
        const wide = [...c.querySelectorAll('*')].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.left < r.left - 0.5 || b.right > r.right + 0.5);
        }).length;
        return { pageW: root.scrollWidth, pageH: root.scrollHeight, w: innerWidth, h: innerHeight, cardScrollW: c.scrollWidth, cardW: c.clientWidth, left: r.left, right: r.right, top: r.top, bottom: r.bottom, wide };
      });
      expect(box.pageW, `${at}: no sideways scroll of the page`).toBeLessThanOrEqual(box.w);
      expect(box.pageH, `${at}: no up-and-down scroll of the page`).toBeLessThanOrEqual(box.h);
      expect(box.cardScrollW, `${at}: no sideways scroll inside the card`).toBeLessThanOrEqual(box.cardW);
      expect(box.wide, `${at}: nothing sticks out of the card`).toBe(0);
      expect(box.left, at).toBeGreaterThanOrEqual(0);
      expect(box.top, at).toBeGreaterThanOrEqual(0);
      expect(box.right, at).toBeLessThanOrEqual(box.w);
      expect(box.bottom, at).toBeLessThanOrEqual(box.h);
      expect(box.bottom - box.top, `${at}: the card has room to read in`).toBeGreaterThanOrEqual(200);
      // The way back, every page name and the version stay on screen whatever the card shows.
      await expect(page.getByRole('button', { name: 'Back to levels' }), at).toBeInViewport({ ratio: 1 });
      for (const tab of pagesHere()) await expect(page.getByRole('tab', { name: tab }), at).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('version').filter({ visible: true }), at).toBeInViewport({ ratio: 1 });
    }
    // Long text scrolls inside the card, to its very end.
    if (appBuild()) {
      await page.getByRole('tab', { name: 'Privacy' }).tap();
      const last = page.getByText(/^Questions about this policy/);
      await last.scrollIntoViewIfNeeded();
      await expect(last, `the policy's last line at ${size.name}`).toBeInViewport({ ratio: 1 });
    }
    // The confirm card fits too, with both of its buttons.
    await page.getByRole('tab', { name: 'Settings' }).tap();
    await page.getByRole('button', { name: 'Reset progress' }).tap();
    await expect(page.getByRole('alertdialog'), size.name).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Keep my stars' }), size.name).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Erase stars' }), size.name).toBeInViewport({ ratio: 1 });
    // The card hides what is behind it: no see-through in its own colour.
    const alphas = await page.getByRole('alertdialog').evaluate((el) => [...getComputedStyle(el).backgroundImage.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1])));
    expect(alphas.filter((a) => a < 1), `${size.name}: the confirm card is solid`).toEqual([]);
    await page.getByRole('button', { name: 'Keep my stars' }).tap();
  }
  expect(await savedStars(page)).toEqual(STARS);
});

test('reset clears the stars after the confirm, not before, and leaves the settings', async ({ page }) => {
  await seedProgress(page, STARS);
  await openAbout(page);
  await page.getByRole('switch', { name: 'Sound' }).tap();
  const before = await settings(page);
  expect(before.sound).toBe(false);

  await expect(page.getByTestId('progress-line')).toContainText('5 stars on 2 riddles');
  await page.getByRole('button', { name: 'Reset progress' }).tap();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('All 5 of your stars');
  expect(await savedStars(page), 'asking changes nothing').toEqual(STARS);

  // Saying no keeps everything.
  await dialog.getByRole('button', { name: 'Keep my stars' }).tap();
  await expect(dialog).toBeHidden();
  expect(await savedStars(page), 'saying no changes nothing').toEqual(STARS);
  await expect(page.getByTestId('progress-line')).toContainText('5 stars');

  // Saying yes clears the stars, at once and on the device.
  await page.getByRole('button', { name: 'Reset progress' }).tap();
  await dialog.getByRole('button', { name: 'Erase stars' }).tap();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('progress-line')).toHaveText('Progress reset. Every star is gone.');
  await expect(page.getByRole('button', { name: 'Reset progress' })).toBeDisabled();
  expect(await savedStars(page)).toEqual({});
  expect(await settings(page), 'the settings stay').toEqual(before);

  // The map agrees, also after a reload (the seeding above leaves saved progress alone): no stars, level 2 locked again, sound still off.
  await page.getByRole('button', { name: 'Back to levels' }).tap();
  await expect(page.getByText(`0 / ${LEVELS.length * 3}`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`0 / ${LEVELS.length * 3}`)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Level ${LEVELS[1].number}: .*\\(locked\\)$`) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
  expect(await savedStars(page)).toEqual({});
});

test('the sound and graphics switches work and are remembered', async ({ page }) => {
  await openAbout(page);
  const sound = page.getByRole('switch', { name: 'Sound' });
  const hd = page.getByRole('switch', { name: 'HD graphics' });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  const hdAtStart = (await hd.getAttribute('aria-checked')) === 'true';

  await sound.tap();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await hd.tap();
  await expect(hd).toHaveAttribute('aria-checked', String(!hdAtStart));
  expect(await settings(page)).toEqual({ sound: false, quality: hdAtStart ? 'low' : 'high' });

  // The map's own sound button shows the same choice, and a fresh start keeps both.
  await page.getByRole('button', { name: 'Back to levels' }).tap();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
  await page.goto('about:blank');
  await page.goto('#/about');
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await expect(hd).toHaveAttribute('aria-checked', String(!hdAtStart));
  await sound.tap();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  expect((await settings(page)).sound).toBe(true);
});

test('the screen has no link out but the contact', async ({ page }) => {
  await openAbout(page);
  const links: string[] = [];
  for (const name of pagesHere()) {
    await page.getByRole('tab', { name }).tap();
    if (name === 'Credits') for (const b of await page.getByRole('button', { name: /License|Universal/ }).all()) await b.tap();
    links.push(...(await page.locator('#root').locator('a[href], [src], form, iframe').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? e.outerHTML.slice(0, 80)))));
  }
  expect(links.filter((l) => !l.startsWith('mailto:'))).toEqual([]);
  expect(links.length, 'at most the one contact link').toBeLessThanOrEqual(1);
  // The fixture also fails this test on any request to another host.
});

test('the confirm card invites keeping the stars, not erasing them', async ({ page }) => {
  await seedProgress(page, STARS);
  await openAbout(page);
  await page.getByRole('button', { name: 'Reset progress' }).tap();
  const dialog = page.getByRole('alertdialog');
  const keep = dialog.getByRole('button', { name: 'Keep my stars' });
  const erase = dialog.getByRole('button', { name: 'Erase stars' });
  // Gold is the game's "go on" colour. Only the button that keeps the stars wears it, and it holds the focus.
  const gold = (b: typeof keep) => b.evaluate((el) => el.className.includes('amber'));
  expect(await gold(keep), 'keeping is the gold button').toBe(true);
  expect(await gold(erase), 'erasing is not').toBe(false);
  await expect(keep).toBeFocused();
  // Behind the card, the page's own words are covered: the point at the card's middle belongs to the card.
  const box = (await dialog.boundingBox())!;
  const top = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role="alertdialog"]'), [box.x + box.width / 2, box.y + box.height / 2] as const);
  expect(top).toBe(true);
});

test('the website build leaves the policy, the contact and the working name out; the app build has them', async ({ page }) => {
  // On screen. No tab leads to them, and their words are on no page.
  await openAbout(page);
  if (appBuild()) {
    await expect(page.getByRole('tab', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Contact' })).toBeVisible();
  } else {
    await expect(page.getByRole('tab', { name: /Privacy|Contact/ })).toHaveCount(0);
    for (const name of pagesHere()) {
      await page.getByRole('tab', { name }).tap();
      await expect(page.locator('#root')).not.toContainText(/privacy|contact|Riddlebrook/i);
    }
    // No address opens them either.
    for (const hash of ['#/about/privacy', '#/about/contact', '#/privacy', '#/contact', '#/about?page=privacy']) {
      await page.goto('about:blank');
      await page.goto(hash);
      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(page.locator('#root')).not.toContainText(/privacy policy|contact address|Riddlebrook/i);
    }
  }
  // In the built files themselves, as served.
  const web = builtText(fileURLToPath(new URL('../../apps/web/dist', import.meta.url)));
  const app = builtText(fileURLToPath(new URL('../../apps/web/dist-app', import.meta.url)));
  for (const [what, words] of Object.entries(APP_ONLY_WORDS)) {
    expect(web.includes(words), `the website's files hold no ${what} text`).toBe(false);
    expect(app.includes(words), `the app's files hold the ${what} text`).toBe(true);
  }
  expect(web).not.toMatch(/Privacy Policy|Questions about this policy|Write an email/);
});
