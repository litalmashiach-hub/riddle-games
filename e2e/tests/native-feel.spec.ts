import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { APP_NAME } from '../../apps/web/src/about/appInfo';
import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, test, waitForSession } from './fixtures';

/**
 * The game as an app: clear of the notch and the home bar, no web-page gestures, and a touch
 * response in the native shell only. See docs/ios-app.md, "Feeling like an app".
 *
 * Chromium has no notch. Its developer tools can set the four safe-area insets that the styles read
 * (`env(safe-area-inset-*)`), which is what these tests do. They show that the layout obeys the insets
 * it is given; they do not show what an iPhone reports. That takes a simulator or a device.
 */

/** Screens and their insets in points: the phone held sideways with its status bar hidden, and an iPad both ways up. */
const SCREENS = [
  { name: 'iPhone 852 by 393', width: 852, height: 393, insets: { top: 0, right: 59, bottom: 21, left: 59 } },
  { name: 'iPhone 956 by 440', width: 956, height: 440, insets: { top: 0, right: 62, bottom: 21, left: 62 } },
  { name: 'small iPhone 667 by 375', width: 667, height: 375, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'iPad sideways 1024 by 768', width: 1024, height: 768, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
  { name: 'iPad upright 768 by 1024', width: 768, height: 1024, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
] as const;
type Insets = { top: number; right: number; bottom: number; left: number };

/** The tests that make their own screens run once, not once per project. */
const ONCE = 'iphone-landscape';

async function screenWithInsets(browser: Browser, baseURL: string, s: { width: number; height: number; insets: Insets }) {
  const context = await browser.newContext({ baseURL, viewport: { width: s.width, height: s.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
  const devtools = await context.newCDPSession(page);
  await devtools.send('Emulation.setSafeAreaInsetsOverride', { insets: s.insets });
  return { context, page, errors };
}

/**
 * Everything a player reads or taps that reaches into an inset, as "what [left, top, right, bottom] by how much".
 * Counted: buttons, links, tabs and switches, and every element with text of its own, as far as it shows
 * (cut by the boxes it scrolls or hides in). Not counted: the 3D canvas, decoration marked `aria-hidden`,
 * the loading curtain, and, along the way it scrolls, what rides in a list: a level card passes under the
 * notch or the home bar while the map is swiped, as in any app.
 */
async function underInsets(page: Page, insets: Insets): Promise<string[]> {
  return page.evaluate((ins) => {
    const W = innerWidth;
    const H = innerHeight;
    const shows = (el: Element) => {
      for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const out: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.tagName === 'CANVAS' || el.closest('[role="status"]')) continue;
      const control = el.matches('button, a[href], [role="button"], [role="switch"], [role="tab"]');
      if (!control && (el.closest('[aria-hidden="true"]') || el.closest('button, a[href]'))) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent!.trim()).join(' ').trim();
      if (!control && !text) continue;
      if (!shows(el)) continue;
      let box: DOMRect;
      if (control) box = el.getBoundingClientRect();
      else {
        const range = document.createRange();
        range.selectNodeContents(el);
        box = range.getBoundingClientRect();
      }
      let [x0, y0, x1, y1] = [box.left, box.top, box.right, box.bottom];
      let ridesX = false;
      let ridesY = false;
      for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e);
        const c = e.getBoundingClientRect();
        if (s.overflowX !== 'visible') {
          x0 = Math.max(x0, c.left);
          x1 = Math.min(x1, c.right);
          if (/auto|scroll/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1) ridesX = true;
        }
        if (s.overflowY !== 'visible') {
          y0 = Math.max(y0, c.top);
          y1 = Math.min(y1, c.bottom);
          if (/auto|scroll/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1) ridesY = true;
        }
      }
      if (x1 - x0 < 1 || y1 - y0 < 1 || x1 <= 0 || y1 <= 0 || x0 >= W || y0 >= H) continue;
      const over = Math.max(ridesX ? 0 : Math.max(ins.left - x0, x1 - (W - ins.right)), ridesY ? 0 : Math.max(ins.top - y0, y1 - (H - ins.bottom)));
      if (over > 0.5) out.push(`${(el.getAttribute('aria-label') || text || el.textContent || '').trim().slice(0, 40)} [${[x0, y0, x1, y1].map(Math.round)}] by ${Math.round(over)}`);
    }
    return out;
  }, insets);
}

/** A finger held still on a spot, as long as a long press takes, through the browser's own touch input. */
async function longPress(context: BrowserContext, page: Page, x: number, y: number) {
  const devtools = await context.newCDPSession(page);
  await devtools.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(1200);
  await devtools.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await devtools.detach();
}

/** A finger dragged up or down, in steps, through the browser's own touch input. */
async function drag(context: BrowserContext, page: Page, x: number, fromY: number, toY: number) {
  const devtools = await context.newCDPSession(page);
  await devtools.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: fromY }] });
  for (let i = 1; i <= 10; i++) {
    await devtools.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: fromY + ((toY - fromY) * i) / 10 }] });
    await page.waitForTimeout(30);
  }
  await devtools.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await devtools.detach();
  await page.waitForTimeout(600);
}

test('nothing to read or tap sits under the notch or the home bar', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== ONCE, 'makes its own screens');
  test.setTimeout(600_000);
  const one = LEVELS[0];
  for (const s of SCREENS) {
    const { context, page, errors } = await screenWithInsets(browser, baseURL!, s);
    const clear = async (screen: string) => expect.soft(await underInsets(page, s.insets), `${s.name}, ${screen}`).toEqual([]);

    await page.goto('?all');
    await expect(page.getByRole('heading', { name: 'Riddle Games' })).toBeVisible();
    await page.waitForTimeout(1200);
    await clear('level map');
    // The map's list rests inside the insets at both of its ends, whichever way it scrolls.
    const rests = await page.evaluate((ins) => {
      const scrolls = (e: Element, way: 'X' | 'Y') => /auto|scroll/.test(getComputedStyle(e)[`overflow${way}`]) && (way === 'X' ? e.scrollWidth > e.clientWidth + 1 : e.scrollHeight > e.clientHeight + 1);
      const all = [...document.querySelectorAll('body *')];
      const sideways = all.find((e) => scrolls(e, 'X'));
      const list = sideways ?? all.find((e) => scrolls(e, 'Y'));
      if (!list) return null;
      const cards = [...list.querySelectorAll('button[aria-label^="Level "]')];
      list.scrollTo(0, 0);
      const a = cards[0].getBoundingClientRect();
      list.scrollTo(list.scrollWidth, list.scrollHeight);
      const b = cards[cards.length - 1].getBoundingClientRect();
      return sideways ? { first: a.left - ins.left, last: innerWidth - ins.right - b.right } : { first: a.top - ins.top, last: innerHeight - ins.bottom - b.bottom };
    }, s.insets);
    expect.soft(rests, `${s.name}: the level map scrolls`).not.toBeNull();
    if (rests) {
      expect.soft(rests.first, `${s.name}: the first level card rests clear of the inset`).toBeGreaterThanOrEqual(0);
      expect.soft(rests.last, `${s.name}: the last level card rests clear of the inset`).toBeGreaterThanOrEqual(0);
    }

    await page.goto(`?all&debug&quality=low#/level/${one.id}`);
    await waitForSession(page, one.id);
    await expect(page.getByRole('button', { name: "Let's go!" })).toBeVisible();
    await page.waitForTimeout(600);
    await clear('rules card');
    await passRulesCard(page, one.title);
    await page.waitForTimeout(600);
    await clear('level 1 in play');
    // A click, not a tap: after a tap this browser leaves the button in its pressed look, 3 px lower, which a real finger does not.
    await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).dispatchEvent('click');
    await expect(page.getByText(/^💡/)).toBeVisible();
    await page.waitForTimeout(1200);
    await clear('level 1 with its hint');
    for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await clear('win card');

    expect.soft(errors, `${s.name}: page errors`).toEqual([]);
    await context.close();
  }
});

test('text can be neither selected nor called out, and the page neither scrolls nor zooms', async ({ page, context }) => {
  const level = LEVELS[1];
  await page.goto(`?all&debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  const rule = page.locator('li span').filter({ hasText: /\w{4,}/ }).first();
  await expect(rule).toBeVisible();
  await page.waitForTimeout(600);

  // A line of the rules carries the two styles that make a long press do nothing on an iPhone. The long press
  // itself is made too, but this browser selects nothing on one even where it could, so the styles are the
  // check here; the gesture was tried in Apple's simulator (see the pull request that added this test).
  const box = (await rule.boundingBox())!;
  await longPress(context, page, box.x + Math.min(60, box.width / 2), box.y + box.height / 2);
  expect(await page.evaluate(() => getSelection()?.toString() ?? ''), 'text selected by a long press').toBe('');
  expect(await rule.evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
  expect(await rule.evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-touch-callout') || 'none')).toBe('none');

  // A double tap on text does not zoom, and a drag does not move the page.
  await page.touchscreen.tap(box.x + 30, box.y + box.height / 2);
  await page.touchscreen.tap(box.x + 30, box.y + box.height / 2);
  const size = page.viewportSize()!;
  await drag(context, page, size.width - 20, size.height / 2, 20);
  const pageState = await page.evaluate(() => ({ zoom: visualViewport!.scale, x: scrollX, y: scrollY, taller: document.documentElement.scrollHeight - innerHeight, wider: document.documentElement.scrollWidth - innerWidth }));
  expect(pageState, 'the page as a whole').toEqual({ zoom: 1, x: 0, y: 0, taller: 0, wider: 0 });

  // Long text still scrolls, inside its own box. The rules fit their card on today's phones, so the screen
  // is made lower than any of them for this part, until the card has to scroll.
  await page.setViewportSize({ width: size.width, height: 170 });
  await page.waitForTimeout(600);
  const scroller = page.locator('.panel .overflow-y-auto').first();
  const room = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(room, `the rules of level ${level.number} overflow their card on a screen 170 high`).toBeGreaterThan(20);
  const inner = (await scroller.boundingBox())!;
  await drag(context, page, inner.x + inner.width / 2, inner.y + inner.height - 30, inner.y + 10);
  expect(await scroller.evaluate((el) => el.scrollTop), 'the rules scrolled inside their card').toBeGreaterThan(10);
  expect(await page.evaluate(() => scrollY), 'the page stayed put').toBe(0);
});

test('the website gives no touch response and carries none of the app-only parts', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__buzz = 0;
    navigator.vibrate = () => {
      (window as any).__buzz++;
      return true;
    };
  });
  const one = LEVELS[0];
  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);
  await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).tap();
  await playMove(page, one.moves[0], 1);
  await page.getByRole('button', { name: 'Undo' }).tap();
  expect(await page.evaluate(() => (window as any).__buzz), 'calls to vibrate').toBe(0);
  expect(await page.evaluate(() => 'Capacitor' in window), 'the native bridge on the website').toBe(false);
  expect(await page.evaluate(() => document.documentElement.className)).not.toContain('app-shell');
  const scripts = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /\.js(\?|$)/.test(n)));
  expect(scripts.length, 'the website is still one script file').toBe(1);
});

// ---- The app build, with a stand-in for the native side of Capacitor's bridge ----

const APP_BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'web', 'dist-app');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

/**
 * Serves apps/web/dist-app under /app-build/ of the test's own address, and plays the native side of the bridge:
 * the page then believes it runs on iOS with the Haptics plugin installed, and every call it makes to the
 * plugin is written down in `window.__native`. This is the path the real app takes up to the bridge. What iOS
 * does with the call is not shown here.
 */
async function openAppBuild(page: Page) {
  await page.route('**/app-build/**', (route) => {
    const rel = normalize(decodeURIComponent(new URL(route.request().url()).pathname.replace(/^.*\/app-build\//, '')) || 'index.html');
    const file = join(APP_BUILD, rel);
    if (!file.startsWith(APP_BUILD + sep) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not in the app build' });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' });
  });
  await page.addInitScript(() => {
    const calls: { plugin: string; method: string; options: unknown }[] = [];
    Object.assign(window, {
      __native: calls,
      webkit: { messageHandlers: { bridge: { postMessage() {} } } },
      Capacitor: {
        PluginHeaders: [{ name: 'Haptics', methods: [{ name: 'impact', rtype: 'promise' }] }],
        nativePromise: (plugin: string, method: string, options: unknown) => {
          calls.push({ plugin, method, options });
          return Promise.resolve();
        },
      },
    });
  });
}

const ticks = (page: Page) => page.evaluate(() => (window as any).__native as { plugin: string; method: string; options: unknown }[]);

test('the app build: a tap that does something gives one light tick, and none with the sound off', async ({ page, browser, baseURL }, testInfo) => {
  test.skip(!existsSync(join(APP_BUILD, 'index.html')), 'needs the app build: pnpm build:app (pnpm test:e2e makes it)');
  const one = LEVELS[0];

  // Where the wolf stands on this screen, from the website build: the app build has no `?debug` to ask.
  const size = testInfo.project.use.viewport!;
  const web = await browser.newContext({ baseURL, viewport: size, hasTouch: true, isMobile: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const webPage = await web.newPage();
  await webPage.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(webPage, one.id);
  await passRulesCard(webPage, one.title);
  await webPage.waitForTimeout(3000);
  const spots = await webPage.evaluate(() => {
    const { camera } = window.__camera!;
    camera.updateMatrixWorld();
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    const at = (x: number, y: number, z: number) => {
      const v = camera.position.clone().set(x, y, z).project(camera);
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    // The wolf's place on the left bank (levels/01-wolf-two-sheep/src/Scene.tsx), and open sky above the scene.
    return { wolf: at(-4.1, 0.75, -0.3), sky: { x: r.left + r.width / 2, y: r.top + 70 } };
  });
  await web.close();

  await openAppBuild(page);
  await page.goto('app-build/index.html?all&debug&quality=low');
  // The app build's level map carries the app's own name (APP_NAME, as src/about/shown.ts picks it), not the website's.
  await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.className)).toContain('app-shell');
  expect(await page.evaluate(() => [getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow])).toEqual(['hidden', 'hidden']);
  expect(await page.evaluate(() => !document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), 'the long-press menu is refused').toBe(true);
  expect(await ticks(page)).toEqual([]);

  // The level map. A locked level answers with its "no" sound, and with a tick.
  await page.getByRole('button', { name: /^Level 2:/ }).tap();
  await expect.poll(() => ticks(page).then((t) => t.length), 'a tap on a level card').toBe(1);
  expect((await ticks(page))[0]).toEqual({ plugin: 'Haptics', method: 'impact', options: { style: 'LIGHT' } });
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /^Level 1:/ }).tap();
  await expect.poll(() => ticks(page).then((t) => t.length), 'opening level 1').toBe(2);

  // The rules card, then the scene.
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: "Let's go!" }).tap();
  await expect.poll(() => ticks(page).then((t) => t.length), "Let's go!").toBe(3);
  await page.waitForTimeout(3200);

  // A tap on open sky does nothing, and gives no tick. A tap on the wolf picks it, with a tick.
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, spots.sky)).toBe('CANVAS');
  await page.touchscreen.tap(spots.sky.x, spots.sky.y);
  await page.waitForTimeout(400);
  expect((await ticks(page)).length, 'after a tap on the sky').toBe(3);
  await page.touchscreen.tap(spots.wolf.x, spots.wolf.y);
  const row = page.getByRole('button', { name: /Row across/ });
  await expect(row).toContainText('with wolf');
  await expect.poll(() => ticks(page).then((t) => t.length), 'a tap on the wolf').toBe(4);

  // The crossing is a button and a move at once: still one tick.
  await page.waitForTimeout(150);
  await row.tap();
  await expect(page.locator('.tabular-nums')).toHaveText('1');
  await page.waitForTimeout(400);
  expect((await ticks(page)).length, 'after the crossing').toBe(5);

  // Sound off: the switch itself is silent on the way out, and so is everything after it.
  await page.getByRole('button', { name: 'Sound', pressed: true }).tap();
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Undo' }).tap();
  await page.waitForTimeout(300);
  expect((await ticks(page)).length, 'with the sound off').toBe(5);
  // Sound back on: the switch ticks, as it clicks.
  await page.getByRole('button', { name: 'Sound', pressed: false }).tap();
  await expect.poll(() => ticks(page).then((t) => t.length), 'turning the sound back on').toBe(6);
  expect(new Set((await ticks(page)).map((t) => JSON.stringify(t))).size, 'every call is the same light impact').toBe(1);
});
