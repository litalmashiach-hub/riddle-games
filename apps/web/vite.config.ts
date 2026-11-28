import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { releaseChecks } from './releaseChecks';
import { nameForMode, withShownName } from './src/about/pageName';

/** Lists every built file into dist/sw.js so the installed app works offline. */
function offlineServiceWorker(): Plugin {
  let outDir = '';
  return {
    name: 'riddle-offline-sw',
    apply: 'build',
    configResolved(c) {
      outDir = join(c.root, c.build.outDir);
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
      // Launch screens are only read by iOS when the app is added to the home screen.
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && !f.startsWith('splash/'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const sw = readFileSync(new URL('./src/pwa/sw-template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

/**
 * App build only: the native shell has its own icon, launch screen and offline files, so the
 * home-screen-web-app parts (manifest, launch images, touch icons) are left out of the bundle.
 */
function stripWebAppParts(): Plugin {
  let outDir = '';
  return {
    name: 'riddle-app-shell',
    apply: 'build',
    configResolved(c) {
      outDir = join(c.root, c.build.outDir);
    },
    transformIndexHtml(html) {
      return html
        .split('\n')
        .filter((line) => !/rel="(manifest|apple-touch-icon|apple-touch-startup-image)"|name="(mobile-web-app-capable|apple-mobile-web-app-[a-z-]+)"|home-screen app/.test(line))
        .join('\n');
    },
    closeBundle() {
      for (const f of ['splash', 'icons', 'manifest.webmanifest']) rmSync(join(outDir, f), { recursive: true, force: true });
    },
  };
}

/**
 * The page title and the loading mark's spoken label carry the name this build shows: the working name in
 * the app, the website's name on the website (src/about/pageName.ts). In dev too, so the dev server matches.
 */
function shownNameInPage(mode: string): Plugin {
  return {
    name: 'riddle-shown-name',
    transformIndexHtml: { order: 'pre', handler: (html) => withShownName(html, nameForMode(mode)) },
  };
}

/**
 * Two builds from the same source:
 * - `vite build` (default): the website, into dist/, with the offline service worker. Unchanged.
 * - `vite build --mode app`: the content of the native app, into dist-app/. No service worker,
 *   no web-app manifest, and `?all` / `?debug` do nothing (see src/appShell.ts and docs/ios-app.md).
 */
export default defineConfig(({ mode }) => {
  const appShell = mode === 'app';
  return {
    // Relative base so the build works on GitHub Pages, Vercel or any static host.
    base: './',
    plugins: [shownNameInPage(mode), react(), tailwindcss(), appShell ? stripWebAppParts() : offlineServiceWorker(), releaseChecks()],
    build: {
      outDir: appShell ? 'dist-app' : 'dist',
      chunkSizeWarningLimit: 2000,
    },
  };
});
