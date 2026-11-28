import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4174);

/**
 * Memory check, run by hand: `pnpm build && pnpm test:e2e:memory`.
 * It enters and leaves levels again and again, plays them for minutes, and writes what the page holds
 * (3D objects, their bytes, the JS heap, the drawing process) to test-results/memory/. See docs/memory-check.md.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /memory\.spec\.ts$/,
  outputDir: '../../test-results/memory-run',
  timeout: 0,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    browserName: 'chromium',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    trace: 'off',
    viewport: { width: 852, height: 393 },
    launchOptions: { args: ['--enable-precise-memory-info', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: `pnpm --filter @riddle/web exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
