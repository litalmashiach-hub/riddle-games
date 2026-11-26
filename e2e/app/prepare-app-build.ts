/**
 * TEST ONLY. After `VITE_APP_TEST_HOOKS=1 pnpm build:app`, puts the run's read-only page hooks into
 * the app's content (apps/web/dist-app) as the first script of index.html, so they run before the
 * game's own code. Then `cap sync ios` copies that content into the iOS project.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { READ_SCENE } from '../taps/harness';
import { PAGE_HOOKS } from './page-hooks';
import { VCLOCK } from './preview/vclock';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'web', 'dist-app');
const js = `/* TEST ONLY: e2e/app/preview/vclock.ts, e2e/app/page-hooks.ts and READ_SCENE of e2e/taps/harness.ts */\nvar __name = function (f) { return f; };\n(${VCLOCK.toString()})();\n(${PAGE_HOOKS.toString()})();\n(${READ_SCENE.toString()})();\n`;
writeFileSync(join(dist, 'app-test-hooks.js'), js);
const indexFile = join(dist, 'index.html');
let html = readFileSync(indexFile, 'utf8');
if (!html.includes('app-test-hooks.js')) {
  html = html.replace(/<head>/i, '<head>\n    <script src="./app-test-hooks.js"></script>');
  writeFileSync(indexFile, html);
}
console.log(`page hooks put into ${indexFile} (${js.length} bytes)`);
