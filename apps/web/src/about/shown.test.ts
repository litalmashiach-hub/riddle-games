import { afterEach, describe, expect, it, vi } from 'vitest';

/** Loads shown.ts as a build of the given mode would see it (`vite build` is "production", `--mode app` is "app"). */
async function shownIn(mode: string) {
  vi.resetModules();
  vi.stubEnv('MODE', mode);
  return import('./shown');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('what each build shows on the About screen', () => {
  it('the website build: Settings and Credits only, under the website name', async () => {
    const shown = await shownIn('production');
    expect(shown.PAGES.map((p) => p.label)).toEqual(['Settings', 'Credits']);
    expect(shown.SHOWN_NAME).toBe('Riddle Games');
  });

  it('the app build: all four pages, under the working name from appInfo.ts', async () => {
    const shown = await shownIn('app');
    const { APP_NAME } = await import('./appInfo');
    expect(shown.PAGES.map((p) => p.label)).toEqual(['Settings', 'Privacy', 'Contact', 'Credits']);
    expect(shown.SHOWN_NAME).toBe(APP_NAME);
  });

  it('any mode but the app build is treated as the website', async () => {
    const shown = await shownIn('development');
    expect(shown.PAGES.map((p) => p.id)).toEqual(['settings', 'credits']);
    expect(shown.SHOWN_NAME).toBe('Riddle Games');
  });
});
