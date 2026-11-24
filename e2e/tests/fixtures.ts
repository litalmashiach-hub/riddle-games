import { test as base, expect, type Page } from '@playwright/test';

export const PROGRESS_KEY = 'riddle-games:progress:v1';
export const SETTINGS_KEY = 'riddle-games:settings:v1';

/**
 * Console errors that are not faults of the game. Keep this list short, and say why for each entry.
 */
const IGNORED_CONSOLE_ERRORS: RegExp[] = [
  // Chromium's software renderer, used where there is no graphics card, reports its own slowness.
  /GPU stall due to ReadPixels/,
];

/** What went wrong in the page while a test ran. A clean play-through leaves every list empty. */
export interface PageFaults {
  /** Page errors that match a fault listed in e2e/known-faults.ts are kept here, apart from the rest. */
  known: string[];
  knownPattern: RegExp | null;
  pageErrors: string[];
  consoleErrors: string[];
  /** Requests that failed, or were answered with an error status. */
  badRequests: string[];
  /** Requests to anywhere but the game's own address: the game should make none. */
  outsideRequests: string[];
}

interface Fixtures {
  faults: PageFaults;
}

export const test = base.extend<Fixtures>({
  faults: [
    async ({ page, baseURL }, use) => {
      const faults: PageFaults = { known: [], knownPattern: null, pageErrors: [], consoleErrors: [], badRequests: [], outsideRequests: [] };
      const origin = new URL(baseURL!).origin;
      page.on('pageerror', (e) => {
        const text = `${e.name}: ${e.message}`;
        (faults.knownPattern?.test(text) ? faults.known : faults.pageErrors).push(e.stack || text);
      });
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (!IGNORED_CONSOLE_ERRORS.some((r) => r.test(text))) faults.consoleErrors.push(text);
      });
      page.on('request', (r) => {
        const url = r.url();
        if (/^https?:/.test(url) && new URL(url).origin !== origin) faults.outsideRequests.push(url);
      });
      page.on('requestfailed', (r) => faults.badRequests.push(`${r.url()} (${r.failure()?.errorText})`));
      page.on('response', (r) => {
        if (r.status() >= 400) faults.badRequests.push(`${r.url()} (${r.status()})`);
      });
      await use(faults);
      // Checked after every test, softly, so that the test's own result still shows.
      expectClean(faults, true);
    },
    { auto: true },
  ],
});

/** No error, failed request or outside request so far, bar a known fault's own page error. */
export function expectClean(faults: PageFaults, soft = false) {
  const check = soft ? expect.soft : expect;
  check(faults.pageErrors, 'page errors').toEqual([]);
  check(faults.consoleErrors, 'console errors').toEqual([]);
  check(faults.badRequests, 'failed requests').toEqual([]);
  check(faults.outsideRequests, 'requests to other hosts').toEqual([]);
}

export { expect };

/** The live play session that the game exposes with `?debug`. */
declare global {
  interface Window {
    __riddle?: { getState(): any };
    __camera?: { camera: any; controls: any };
  }
}

/** Puts saved stars in place before the game starts, unless the page already has saved progress. */
export async function seedProgress(page: Page, stars: Record<string, number>) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) == null) localStorage.setItem(key, value);
    },
    [PROGRESS_KEY, JSON.stringify({ stars })] as const,
  );
}

export async function savedStars(page: Page): Promise<Record<string, number>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"stars":{}}').stars ?? {}, PROGRESS_KEY);
}

/** Waits for the level's rules card and its 3D canvas, then taps "Let's go!" as a player would. */
export async function passRulesCard(page: Page, title: string) {
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  const go = page.getByRole('button', { name: "Let's go!" });
  await go.tap();
  await expect(go).toBeHidden();
}

/** Waits until the level's own session is the one behind the debug hook. */
export async function waitForSession(page: Page, id: string) {
  await page.waitForFunction((want) => window.__riddle?.getState().level.id === want, id);
}

/**
 * Plays one move through the debug hook and waits until the game takes input again
 * (or, after the last move, until the level is over).
 */
export async function playMove(page: Page, move: unknown, moveNumber: number) {
  const taken = await page.evaluate((m) => {
    const session = window.__riddle!;
    const before = session.getState().moves.length;
    session.getState().play(m);
    return session.getState().moves.length === before + 1;
  }, move);
  expect(taken, `move ${moveNumber} (${JSON.stringify(move)}) was accepted`).toBe(true);
  await page.waitForFunction(
    (n) => {
      const s = window.__riddle!.getState();
      return s.moves.length === n && (s.status.kind !== 'playing' || !s.busy);
    },
    moveNumber,
    { timeout: 30_000 },
  );
}
