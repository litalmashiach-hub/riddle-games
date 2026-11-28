import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { expect, PROGRESS_KEY, SETTINGS_KEY, test } from './fixtures';

/**
 * The app's second copy of the stars and settings (docs/ios-app.md, "Keeping progress safe"), in the app build
 * with a stand-in for the native side of Capacitor's bridge that plays the Preferences plugin. The stand-in keeps
 * what the page stores in it in sessionStorage, which a reload keeps and the test's wipe of localStorage doesn't
 * touch, as UserDefaults outlives the web view's storage on iOS. What iOS itself does is shown only on a simulator.
 */

const APP_BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'web', 'dist-app');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

async function openAppBuild(page: Page) {
  await page.route('**/app-build/**', (route) => {
    const rel = normalize(decodeURIComponent(new URL(route.request().url()).pathname.replace(/^.*\/app-build\//, '')) || 'index.html');
    const file = join(APP_BUILD, rel);
    if (!file.startsWith(APP_BUILD + sep) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not in the app build' });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' });
  });
  await page.addInitScript(() => {
    const PREFIX = 'stand-in-userdefaults:';
    const calls: { plugin: string; method: string; key?: string }[] = [];
    Object.assign(window, {
      __native: calls,
      webkit: { messageHandlers: { bridge: { postMessage() {} } } },
      Capacitor: {
        PluginHeaders: [
          { name: 'Haptics', methods: [{ name: 'impact', rtype: 'promise' }] },
          { name: 'Preferences', methods: ['get', 'set', 'remove', 'keys', 'clear'].map((name) => ({ name, rtype: 'promise' })) },
        ],
        nativePromise: (plugin: string, method: string, options: { key?: string; value?: string }) => {
          calls.push({ plugin, method, key: options?.key });
          if (plugin !== 'Preferences') return Promise.resolve();
          if (method === 'get') return Promise.resolve({ value: sessionStorage.getItem(PREFIX + options.key) });
          if (method === 'set') sessionStorage.setItem(PREFIX + options.key!, options.value!);
          return Promise.resolve();
        },
      },
    });
  });
}

const copy = (page: Page) =>
  page.evaluate(([p, s]) => ({ progress: sessionStorage.getItem('stand-in-userdefaults:' + p), settings: sessionStorage.getItem('stand-in-userdefaults:' + s) }), [PROGRESS_KEY, SETTINGS_KEY]);
const local = (page: Page) => page.evaluate(([p, s]) => ({ progress: localStorage.getItem(p), settings: localStorage.getItem(s) }), [PROGRESS_KEY, SETTINGS_KEY]);
/** What iOS may do when the device is low on space: the web view's storage is gone, the app's own store stays. */
const wipeWebStorage = (page: Page) => page.evaluate(() => localStorage.clear());

test('the app build: stars and settings come back after the web storage is wiped, and a reset clears both copies', async ({ page }) => {
  test.skip(!existsSync(join(APP_BUILD, 'index.html')), 'needs the app build: pnpm build:app (pnpm test:e2e makes it)');
  const [one, two] = LEVELS;
  const total = LEVELS.length * 3;
  await openAppBuild(page);

  // A player with two levels won, from before the copy existed.
  await page.goto('app-build/index.html');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [PROGRESS_KEY, JSON.stringify({ stars: { [one.id]: 3, [two.id]: 2 } })] as const);
  await page.reload();
  await expect(page.getByText(`5 / ${total}`)).toBeVisible();
  // The start copies it into the app's own store, and the sound switch writes both copies.
  await page.getByRole('button', { name: 'Sound', pressed: true }).tap();
  await expect(page.getByRole('button', { name: 'Sound', pressed: false })).toBeVisible();
  await expect.poll(() => copy(page)).toEqual(await local(page));
  expect(JSON.parse((await copy(page)).settings!).sound).toBe(false);

  // The web storage is wiped. The next start puts everything back before the map is drawn.
  await wipeWebStorage(page);
  expect(await local(page)).toEqual({ progress: null, settings: null });
  await page.reload();
  await expect(page.getByText(`5 / ${total}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sound', pressed: false })).toBeVisible();
  expect(JSON.parse((await local(page)).progress!).stars).toEqual({ [one.id]: 3, [two.id]: 2 });
  expect(JSON.parse((await local(page)).settings!).sound).toBe(false);

  // Reset progress clears the stars in both copies; the settings stay in both.
  await page.getByRole('button', { name: 'About and settings' }).tap();
  await page.getByRole('button', { name: 'Reset progress' }).tap();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Erase stars' }).tap();
  await expect(page.getByTestId('progress-line')).toHaveText('Progress reset. Every star is gone.');
  await expect.poll(async () => JSON.parse((await copy(page)).progress!)).toEqual({ stars: {} });
  expect(JSON.parse((await local(page)).progress!)).toEqual({ stars: {} });

  // Wiped again: the stars stay gone, and the sound choice comes back.
  await wipeWebStorage(page);
  await page.goto('app-build/index.html');
  await expect(page.getByText(`0 / ${total}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sound', pressed: false })).toBeVisible();
  const prefCalls = await page.evaluate(() => (window as any).__native.filter((c: { plugin: string }) => c.plugin === 'Preferences').map((c: { method: string }) => c.method));
  // This start only read the copy back: both entries were missing, and nothing else is ever asked of the store.
  expect(prefCalls, 'the start asks the copy for the two entries').toEqual(['get', 'get']);
});

test('the website asks no native store and keeps its storage as before', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Riddle Games' })).toBeVisible();
  expect(await page.evaluate(() => 'Capacitor' in window)).toBe(false);
  await page.getByRole('button', { name: 'Sound', pressed: true }).tap();
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual([SETTINGS_KEY]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});
