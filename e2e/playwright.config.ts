import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
/** The app build is served beside the website build, for the About screen's tests. */
const APP_PORT = Number(process.env.E2E_APP_PORT ?? PORT + 1);
const ABOUT_ONLY = /(about|voiceover|contrast)\.spec\.ts$/;

/**
 * Play-through tests: they run the production build (apps/web/dist) in Chromium with touch,
 * at the sizes of an iPhone held sideways. See docs/play-through-tests.md.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results',
  // A level takes as long as its animations. Drawn in software, the longest (30 slides, 31 moves) need
  // three to four minutes, and more when three of them run side by side.
  timeout: 480_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The scenes are drawn in software here (no graphics card), so more workers than this only slow each other down.
  workers: Number(process.env.E2E_WORKERS ?? 3),
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
    ['json', { outputFile: '../playwright-report/results.json' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    browserName: 'chromium',
    hasTouch: true,
    isMobile: true,
    // 1x keeps software rendering fast. The layout is the same as on a 2x or 3x phone screen.
    deviceScaleFactor: 1,
    // The offline cache would hand a later test the files of an earlier build. It has no part in a play-through.
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-landscape', use: { viewport: { width: 852, height: 393 } } },
    { name: 'iphone-small-landscape', use: { viewport: { width: 667, height: 375 } } },
    // The app build (apps/web/dist-app): only the About screen differs from the website, so only its tests run here, with the spoken-name checks.
    { name: 'app-iphone-landscape', testMatch: ABOUT_ONLY, use: { baseURL: `http://127.0.0.1:${APP_PORT}/`, viewport: { width: 852, height: 393 } } },
    { name: 'app-iphone-small-landscape', testMatch: ABOUT_ONLY, use: { baseURL: `http://127.0.0.1:${APP_PORT}/`, viewport: { width: 667, height: 375 } } },
    // The largest iPhone. Only the layout checks run here: a play-through would be the same as at 852 by 393.
    { name: 'iphone-largest-landscape', testMatch: /layout\.spec\.ts$/, use: { viewport: { width: 956, height: 440 } } },
  ],
  webServer: [
    {
      // Serves apps/web/dist as it is. Build first: `pnpm test:e2e` builds both.
      command: `pnpm --filter @riddle/web exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Serves apps/web/dist-app, the content of the iPhone and iPad app.
      command: `pnpm --filter @riddle/web exec vite preview --mode app --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      url: `http://127.0.0.1:${APP_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
