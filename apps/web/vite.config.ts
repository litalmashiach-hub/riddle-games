import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

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

export default defineConfig({
  // Relative base so the build works on GitHub Pages, Vercel or any static host.
  base: './',
  plugins: [react(), tailwindcss(), offlineServiceWorker()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
