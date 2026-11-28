import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * Real-tap run: every level is won by touches on its 3D scene, with no move made through the debug hook.
 * A run of its own, apart from the play-through tests (e2e/playwright.config.ts). See docs/real-tap-tests.md.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: '../../test-results/taps',
  // A level takes as long as its animations, and here every move is also aimed and tapped. Drawn in
  // software, the longest levels need several minutes.
  timeout: 900_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: Number(process.env.E2E_WORKERS ?? 3),
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../playwright-report/taps', open: 'never' }],
    ['json', { outputFile: '../../playwright-report/taps/results.json' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    browserName: 'chromium',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-landscape', use: { viewport: { width: 852, height: 393 } } },
    { name: 'iphone-small-landscape', use: { viewport: { width: 667, height: 375 } } },
    { name: 'iphone-large-landscape', use: { viewport: { width: 956, height: 440 } } },
    // The refused-tap notes on an iPad held sideways, at the standard text size and the largest.
    { name: 'ipad-landscape', testMatch: /silent-refusals\.spec\.ts$/, use: { viewport: { width: 1024, height: 768 } } },
    // Every level won by taps with the device's Reduce Motion on (see e2e/tests/reduced-motion.spec.ts).
    { name: 'iphone-landscape-reduce-motion', testMatch: /(levels-by-taps|quick-taps)\.spec\.ts$/, use: { viewport: { width: 852, height: 393 }, reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: `pnpm --filter @riddle/web exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
