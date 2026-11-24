import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * Play-through tests: they run the production build (apps/web/dist) in Chromium with touch,
 * at the sizes of an iPhone held sideways. See docs/play-through-tests.md.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results',
  // A level takes as long as its animations: the longest (20 slides, 17 crossings) need about a minute.
  timeout: 240_000,
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
  ],
  webServer: {
    // Serves apps/web/dist as it is. Build first: `pnpm test:e2e` does both.
    command: `pnpm --filter @riddle/web exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
