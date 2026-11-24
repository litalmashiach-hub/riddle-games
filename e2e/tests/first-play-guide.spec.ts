import { LEVELS } from '../levels';
import { expect, passRulesCard, PROGRESS_KEY, test, waitForSession } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Level 1's first-play guide, by taps alone. On the very first play it rings the wolf, then the boat;
 * it goes after the first crossing, a tap on Skip, or leaving the level, and never shows again on that
 * device. No other level has one. The `?debug` hook is only read, for the camera, never used to play.
 *
 * Where things stand on the near bank, from levels/01-wolf-two-sheep/src/Scene.tsx.
 */
const WOLF: [number, number, number] = [-4.1, 0.75, -0.3];
const SHEEP_A: [number, number, number] = [-3.9, 0.75, 1.4];
const BOAT: [number, number, number] = [-1.55, 0.35, 0];

const guide = (page: Page) => page.getByTestId('first-play-guide');
const say = (page: Page) => page.getByTestId('first-play-guide-say');
const row = (page: Page) => page.getByRole('button', { name: /Row across|Row back/ });

/** The spot on the screen where a point of the 3D scene is drawn. */
async function screenPoint(page: Page, world: [number, number, number]) {
  return page.evaluate((w) => {
    const { camera } = window.__camera!;
    camera.updateMatrixWorld();
    const v = camera.position.clone().set(w[0], w[1], w[2]).project(camera);
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }, world);
}

/** The guide's ring: its centre and radius on the screen, once it has stopped moving. */
async function ring(page: Page) {
  const el = page.locator('.guide-ring');
  await expect(el).toBeVisible();
  let last = '';
  for (let i = 0; i < 20; i++) {
    const now = `${await el.getAttribute('data-x')},${await el.getAttribute('data-y')},${await el.getAttribute('data-r')}`;
    if (now === last) break;
    last = now;
    await page.waitForTimeout(150);
  }
  const [x, y, r] = last.split(',').map(Number);
  return { x, y, r };
}

/** Taps a spot as a finger would. Fails unless the scene itself is on top there: the guide must take no taps. */
async function tapScene(page: Page, at: { x: number; y: number }, what: string) {
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nothing', at);
  expect(top, `what is on top at ${what} (${Math.round(at.x)}, ${Math.round(at.y)})`).toBe('CANVAS');
  await page.touchscreen.tap(at.x, at.y);
}

/** The guide's words and Skip keep clear of every button and the move counter, and stay on the screen. */
async function expectPillClear(page: Page, when: string) {
  const faults = await page.evaluate(() => {
    const pill = document.querySelector('[data-testid="first-play-guide-say"]')!.parentElement!.getBoundingClientRect();
    const out: string[] = [];
    if (pill.left < 0 || pill.top < 0 || pill.right > innerWidth || pill.bottom > innerHeight) out.push('the guide is partly off the screen');
    const others: [string, Element][] = [...document.querySelectorAll('#root button')]
      .filter((b) => b.getAttribute('aria-label') !== 'Skip the guide')
      .map((b) => [`button "${(b.getAttribute('aria-label') || b.textContent || '').trim()}"`, b]);
    const counter = document.querySelector('#root .tabular-nums')?.parentElement;
    if (counter) others.push(['move counter', counter]);
    for (const [name, e] of others) {
      let hidden = false;
      for (let p: Element | null = e; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) < 0.05) hidden = true;
      }
      const r = e.getBoundingClientRect();
      if (hidden || r.width < 2) continue;
      const w = Math.min(r.right, pill.right) - Math.max(r.left, pill.left);
      const h = Math.min(r.bottom, pill.bottom) - Math.max(r.top, pill.top);
      if (w > 1 && h > 1) out.push(`the guide and ${name} overlap by ${Math.round(w)} by ${Math.round(h)}`);
    }
    return out;
  });
  expect(faults, when).toEqual([]);
}

async function guidesSeen(page: Page): Promise<string[] | undefined> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').guidesSeen, PROGRESS_KEY);
}

/** Opens a level, taps "Let's go!" and waits until its scene is drawn and the camera has landed. */
async function openLevel(page: Page, url: string, id: string, title: string) {
  await page.goto(url);
  await waitForSession(page, id);
  await passRulesCard(page, title);
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 60_000 });
  await page.waitForTimeout(3000);
}

const one = LEVELS[0];

test('level 1 on a fresh start: the guide rings the wolf, then the boat, and goes after the first crossing, for good', async ({ page }) => {
  // A fresh start, from the level map, by taps.
  await page.goto('?debug');
  await page.getByRole('button', { name: /^Level 1:/ }).tap();
  await passRulesCard(page, one.title);
  await waitForSession(page, one.id);
  await page.waitForTimeout(3000);

  await expect(guide(page)).toBeVisible();
  await expect(say(page)).toHaveText('Tap the wolf');
  await expectPillClear(page, 'first step');
  expect(await guidesSeen(page), 'shown once is seen: saved with the stars').toEqual([one.id]);

  // The ring is over the wolf. A tap in its middle reaches the wolf, through the guide.
  let r = await ring(page);
  const wolf = await screenPoint(page, WOLF);
  expect(Math.hypot(r.x - wolf.x, r.y - wolf.y), 'ring centre to the wolf, in pixels').toBeLessThan(r.r);
  await tapScene(page, r, 'the ring over the wolf');
  await expect(row(page), 'the tap put the wolf in the boat').toContainText('with wolf');

  // Now the boat.
  await expect(say(page)).toHaveText('Tap the boat');
  await expectPillClear(page, 'second step');
  r = await ring(page);
  const boat = await screenPoint(page, BOAT);
  expect(Math.hypot(r.x - boat.x, r.y - boat.y), 'ring centre to the boat, in pixels').toBeLessThan(r.r);
  await tapScene(page, r, 'the ring over the boat');
  await expect(page.locator('.tabular-nums'), 'the move counter').toHaveText('1');
  await expect(guide(page), 'gone after the first crossing').toHaveCount(0);

  // An undo back to the start does not bring it back.
  await expect(row(page)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Undo' }).tap();
  await expect(page.locator('.tabular-nums')).toHaveText('0');
  await page.waitForTimeout(1500);
  await expect(guide(page)).toHaveCount(0);

  // A fresh start of the app: never again.
  await page.goto('about:blank');
  await openLevel(page, `?debug#/level/${one.id}`, one.id, one.title);
  await expect(row(page)).toBeVisible();
  await expect(guide(page), 'absent after a restart').toHaveCount(0);
});

test('level 1: a wrong first pick keeps the ring on the wolf; leaving the level ends the guide for good', async ({ page }) => {
  await openLevel(page, `?debug#/level/${one.id}`, one.id, one.title);
  await expect(say(page)).toHaveText('Tap the wolf');

  await tapScene(page, await screenPoint(page, SHEEP_A), 'a sheep');
  await expect(row(page)).toContainText('with sheep');
  await page.waitForTimeout(600);
  await expect(say(page), 'a sheep is not the right first passenger').toHaveText('Tap the wolf');

  await page.getByRole('button', { name: 'Back to levels' }).tap();
  await expect(page.getByRole('heading', { name: 'Riddle Games' })).toBeVisible();
  await page.getByRole('button', { name: /^Level 1:/ }).tap();
  await passRulesCard(page, one.title);
  await page.waitForTimeout(3000);
  await expect(row(page)).toBeVisible();
  await expect(guide(page), 'absent after leaving and coming back').toHaveCount(0);
});

test('level 1: Skip takes the guide away, and it stays away after a restart', async ({ page }) => {
  await openLevel(page, `?debug#/level/${one.id}`, one.id, one.title);
  await expect(guide(page)).toBeVisible();
  await page.getByRole('button', { name: 'Skip the guide' }).tap();
  await expect(guide(page)).toHaveCount(0);
  expect(await guidesSeen(page)).toEqual([one.id]);
  expect(await page.evaluate(() => window.__riddle!.getState().moves.length), 'Skip is not a move').toBe(0);

  await page.goto('about:blank');
  await openLevel(page, `?debug#/level/${one.id}`, one.id, one.title);
  await expect(row(page)).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
});

test('no other level shows a guide, on a fresh start', async ({ page }) => {
  test.setTimeout(LEVELS.length * 40_000);
  for (const level of LEVELS.slice(1)) {
    await openLevel(page, `?all&debug&quality=low#/level/${level.id}`, level.id, level.title);
    await expect(guide(page), `level ${level.number} (${level.title})`).toHaveCount(0);
    expect(await guidesSeen(page), `level ${level.number} saved no guide`).toBeUndefined();
    await page.goto('about:blank');
  }
});
