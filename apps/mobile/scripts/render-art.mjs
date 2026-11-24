// Renders the app icon and the launch image from their vector sources.
// Only needed when the art changes: the PNGs it writes are committed.
//
//   NODE_PATH=$(npm root -g) node apps/mobile/scripts/render-art.mjs
//   (needs Playwright with its Chromium, and ImageMagick's `convert`)
//
// Apple refuses an app icon with an alpha channel, so both PNGs are flattened to opaque RGB.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is not a dependency of this repository: it is taken from wherever it is installed
// (for a global install: NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '../ios/App/App/Assets.xcassets');
const jobs = [
  { svg: join(here, '../../web/public/icons/icon.svg'), size: 1024, out: join(assets, 'AppIcon.appiconset/AppIcon-1024.png') },
  { svg: join(here, '../art/launch.svg'), size: 2732, out: join(assets, 'Splash.imageset/splash-2732x2732.png') },
];

const browser = await chromium.launch();
for (const { svg, size, out } of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const markup = readFileSync(svg, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<body style="margin:0;background:#0f2236">${markup}</body>`);
  const raw = `${out}.raw.png`;
  await page.screenshot({ path: raw });
  await page.close();
  execFileSync('convert', [raw, '-background', '#0f2236', '-alpha', 'remove', '-alpha', 'off', '-strip', '-define', 'png:color-type=2', out]);
  rmSync(raw);
  console.log('wrote', out);
}
await browser.close();
