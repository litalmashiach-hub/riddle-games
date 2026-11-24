import { LEVELS } from '../levels';
import { expect, test, waitForSession } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Levels 1 to 3 on a phone held sideways: nothing on the play screen lies over anything else, and
 * the rules card's button is in reach without scrolling. Runs at every size of the config, the
 * largest iPhone (956 by 440) among them.
 *
 * Seen in Apple's simulator before the sideways layout: the hint text behind level 1 and 2's Row
 * button, level 3's action buttons over the move counter, level 2's "Let's go!" cut by the bottom edge.
 */

interface Box {
  name: string;
  x: number;
  y: number;
  right: number;
  bottom: number;
}

/**
 * Every button on the screen, the move counter, the hint text and level 3's jug labels, each with its place.
 * Buttons that belong to a level's own scene (Row across, a jug's menu) are page elements too, so they are in.
 */
async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const seen = (e: Element) => {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      for (let p: Element | null = e; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) < 0.05) return false;
      }
      return true;
    };
    const out: Box[] = [];
    const add = (e: Element, name: string) => {
      if (!seen(e)) return;
      const r = e.getBoundingClientRect();
      out.push({ name, x: r.left, y: r.top, right: r.right, bottom: r.bottom });
    };
    for (const b of document.querySelectorAll('#root button')) add(b, `button "${(b.getAttribute('aria-label') || b.textContent || '').trim()}"`);
    const counter = document.querySelector('#root .tabular-nums')?.parentElement;
    if (counter) add(counter, 'move counter');
    for (const e of document.querySelectorAll('#root div')) {
      if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.includes('💡'))) add(e, 'hint text');
      // Level 3: what each jug holds, written over it ("0 / 5 L").
      if (/^\d+ \/ \d+ L$/.test(e.textContent!.trim()) && !e.querySelector('div')) add(e, `jug label "${e.textContent!.trim()}"`);
    }
    return out;
  });
}

/** No two of them overlap, and each is wholly on the screen. */
function expectApart(all: Box[], size: { width: number; height: number }, when: string) {
  const faults: string[] = [];
  for (const a of all) {
    if (a.x < -0.5 || a.y < -0.5 || a.right > size.width + 0.5 || a.bottom > size.height + 0.5) faults.push(`${a.name} is partly off the screen`);
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const [a, b] = [all[i], all[j]];
      const w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (w > 1 && h > 1) faults.push(`${a.name} and ${b.name} overlap by ${Math.round(w)} by ${Math.round(h)}`);
    }
  }
  expect(faults, when).toEqual([]);
}

/** Opens a level, checks its rules card, taps "Let's go!" and waits for the camera to land. */
async function start(page: Page, id: string, title: string) {
  const size = page.viewportSize()!;
  await page.goto(`?all&debug&quality=low#/level/${id}`);
  await waitForSession(page, id);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 60_000 });
  // The card has settled (it springs in). Its button is whole and on top, with no scrolling.
  const go = page.getByRole('button', { name: "Let's go!" });
  await page.waitForTimeout(800);
  const box = (await go.boundingBox())!;
  expect(box.y, 'the top of "Let\'s go!"').toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, 'the bottom of "Let\'s go!"').toBeLessThanOrEqual(size.height);
  for (const y of [box.y + 2, box.y + box.height - 2]) {
    const top = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.textContent ?? 'not a button', [box.x + box.width / 2, y]);
    expect(top, `what is on top at "Let's go!" (y ${Math.round(y)})`).toBe("Let's go!");
  }
  await go.tap();
  await expect(go).toBeHidden();
  await page.waitForTimeout(3000);
  return size;
}

/** Asks for a hint and checks the screen while its text is up. */
async function hintApart(page: Page, size: { width: number; height: number }, when: string) {
  await page.getByRole('button', { name: 'Hint' }).last().tap();
  await expect(page.getByText(/^💡/)).toBeVisible();
  await page.waitForTimeout(600);
  const all = await boxes(page);
  expect(all.map((b) => b.name), 'the hint text is on the screen').toContain('hint text');
  expectApart(all, size, when);
}

for (const level of LEVELS.slice(0, 2)) {
  test(`level ${level.number}: the hint text, the Row button and the bars keep apart`, async ({ page }) => {
    const size = await start(page, level.id, level.title);
    const row = page.getByRole('button', { name: /Row across/ });
    await expect(row).toBeVisible();
    expectApart(await boxes(page), size, 'at the start');
    await hintApart(page, size, 'with the hint text up');
    await expect(row).toBeVisible();
  });
}

/** Where level 3's jugs stand. From levels/03-two-jugs/src/layout.ts (HOME). */
const JUGS = { small: [4.15, 0.6, 0.7], big: [5.45, 0.6, 0.7] } as const;

for (const jug of ['big', 'small'] as const) {
  test(`level 3: the ${jug} jug's action buttons keep on the screen and clear of the counter, the bars and the hint text`, async ({ page }) => {
    const three = LEVELS[2];
    const size = await start(page, three.id, three.title);
    expectApart(await boxes(page), size, 'at the start');

    const at = await page.evaluate((w) => {
      const { camera } = window.__camera!;
      camera.updateMatrixWorld();
      const v = camera.position.clone().set(w[0], w[1] + 0.3, w[2]).project(camera);
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    }, JUGS[jug]);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.getByRole('button', { name: /Fill at pump/ }), `the ${jug} jug's menu`).toBeVisible();
    await page.waitForTimeout(600);
    const all = await boxes(page);
    expect(all.filter((b) => /Fill at pump|Pour into|Empty in river/.test(b.name))).toHaveLength(3);
    // Both jugs' labels are measured too, so the menu may not lie over what a jug holds.
    expect(all.filter((b) => /^jug label/.test(b.name))).toHaveLength(2);
    expectApart(all, size, `with the ${jug} jug's menu open`);
    await hintApart(page, size, `with the ${jug} jug's menu open and the hint text up`);
  });
}
