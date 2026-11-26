import { defineConfig } from '@playwright/test';
import whole from './playwright.config';

/**
 * The short play-through: the few tests that GitHub runs on every pull request and every merge
 * (.github/workflows/app-checks.yml). The whole suite (playwright.config.ts) takes about an hour;
 * this takes about five minutes. See docs/play-through-tests.md, "In GitHub's checks".
 *
 *   pnpm test:e2e:short          # builds the website and the app content, then the short set
 *   pnpm test:e2e:short:built    # the short set alone, against the builds that are already there
 *
 * The servers, the sizes and every other setting are the whole suite's own. Only three things differ:
 * which tests run, one browser at a time, and one second try.
 */

/**
 * Levels of different kinds, each among the quickest of its kind: pouring (3), weighing (12) and lighting lanterns (14).
 * Level 1, a river crossing, is played by taps alone and once more for the saved progress, so it is not listed here too.
 */
const SHORT_LEVELS = /level (03|12|14) .*plays to a three-star win/;

const project = (name: string) => {
  const found = whole.projects!.find((p) => p.name === name);
  if (!found) throw new Error(`e2e/playwright.config.ts has no project named ${name}`);
  return found;
};

export default defineConfig({
  ...whole,
  // One browser at a time. Side by side on a small machine the scenes starve each other, and a tap can hang.
  workers: 1,
  fullyParallel: false,
  // A test that fails gets one more try. A real fault fails twice and the check goes red; a hiccup of the
  // machine shows as "flaky" in the list and does not stop a merge.
  retries: 1,
  // The slowest of these takes about a minute and a half on a small machine. The whole suite allows eight.
  timeout: 240_000,
  projects: [
    // The website build at a current iPhone's size: level 1 by taps alone (a win and a loss), three more levels to their win, and saved progress.
    {
      ...project('iphone-landscape'),
      testMatch: /(levels|level-1-by-taps|progress)\.spec\.ts$/,
      grep: [SHORT_LEVELS, /level 1 by real taps/, /level 1: a loss/, /progress and settings/, /the map lists every level/],
    },
    // The app build (apps/web/dist-app, what Capacitor wraps): its About screen, with the privacy policy and the contact line.
    { ...project('app-iphone-landscape'), testMatch: /about\.spec\.ts$/ },
  ],
});
